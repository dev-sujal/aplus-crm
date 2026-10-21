import { randomUUID } from "node:crypto";
import { Enrollment } from "../models/Enrollment.model.js";
import { Student } from "../models/Student.model.js";
import { Test } from "../models/Test.model.js";
import { TestAssignment } from "../models/TestAssignment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { stripCorrectAnswersFromQuestions, toPlain } from "../utils/testSnapshots.js";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import type { AssignTestInput, ListAssignmentsQuery } from "../validators/test.validator.js";

const TEST_FIELDS = "title course timeLimitMinutes status publishedAt showResultImmediately";
const STUDENT_FIELDS = "firstName lastName email phone";

export const listAssignments = asyncHandler(async (req, res) => {
  const { test, course, student, page, limit } = req.query as unknown as ListAssignmentsQuery;
  const filter: Record<string, unknown> = {};
  if (test) filter.test = test;
  if (course) filter.course = course;
  if (student) filter.student = student;

  const [items, total] = await Promise.all([
    TestAssignment.find(filter)
      .populate("test", TEST_FIELDS)
      .populate("course", "title")
      .populate("student", STUDENT_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    TestAssignment.countDocuments(filter),
  ]);

  res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
});

/**
 * Students that can be assigned a given test: everyone enrolled (and not
 * dropped) in the test's course. Powers the student picker on the assign page.
 */
export const listEligibleStudents = asyncHandler(async (req, res) => {
  const test = await Test.findById(req.params.id).select("course");
  if (!test) throw ApiError.notFound("Test not found");

  const enrollments = await Enrollment.find({ course: test.course, status: { $ne: "dropped" } })
    .populate("student", "firstName lastName email phone")
    .sort({ createdAt: -1 });

  const seen = new Set<string>();
  const students = [];
  for (const enrollment of enrollments) {
    const student = enrollment.student as unknown as { id?: string } | null;
    if (!student?.id || seen.has(student.id)) continue; // student deleted or duplicate
    seen.add(student.id);
    students.push(student);
  }
  students.sort((a: any, b: any) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  res.json(students);
});

/** Lightweight list of every student (for filter dropdowns on the results page). */
export const listStudentLookup = asyncHandler(async (_req, res) => {
  const students = await Student.find().select("firstName lastName email").sort({ firstName: 1, lastName: 1 });
  res.json(students);
});

export const assignTestToStudents = asyncHandler(async (req: AuthedRequest, res) => {
  const body = req.body as AssignTestInput;
  const test = await Test.findById(req.params.testId);
  if (!test) throw ApiError.notFound("Test not found");
  if (test.status !== "published") throw ApiError.badRequest("Only published tests can be assigned");

  const studentIds = [...new Set(body.studentIds)];

  const enrollments = await Enrollment.find({
    course: test.course,
    student: { $in: studentIds },
    status: { $ne: "dropped" },
  }).select("student");

  const enrolledStudentIds = new Set(enrollments.map((enrollment) => enrollment.student.toString()));
  const missingStudentIds = studentIds.filter((studentId) => !enrolledStudentIds.has(studentId));
  if (missingStudentIds.length > 0) {
    const missing = await Student.find({ _id: { $in: missingStudentIds } }).select("firstName lastName");
    const names = missing.map((student) => `${student.firstName} ${student.lastName}`);
    throw ApiError.badRequest(
      `These students are not enrolled in this test's course: ${names.length ? names.join(", ") : missingStudentIds.join(", ")}`
    );
  }

  const availabilityStart = body.availabilityStart ? new Date(body.availabilityStart) : null;
  const availabilityEnd = body.availabilityEnd ? new Date(body.availabilityEnd) : null;

  const assignments = [];
  for (const studentId of studentIds) {
    const existing = await TestAssignment.findOne({ test: test.id, student: studentId });
    let assignment;
    if (existing) {
      // Re-assigning refreshes the window and restores revoked/expired links,
      // but never resets progress of a student who has started or finished.
      existing.availabilityStart = availabilityStart as never;
      existing.availabilityEnd = availabilityEnd as never;
      existing.attemptsAllowed = Math.max(body.attemptsAllowed ?? 1, 1);
      if (existing.status === "revoked" || existing.status === "expired") existing.status = "not_started";
      existing.revokedAt = null;
      existing.assignedBy = req.user!.id as never;
      assignment = await existing.save();
    } else {
      assignment = await TestAssignment.create({
        test: test.id,
        course: test.course,
        student: studentId,
        shareToken: randomUUID(),
        availabilityStart,
        availabilityEnd,
        attemptsAllowed: body.attemptsAllowed ?? 1,
        status: "not_started",
        assignedBy: req.user!.id,
      });
    }
    await assignment.populate([
      { path: "test", select: TEST_FIELDS },
      { path: "course", select: "title" },
      { path: "student", select: STUDENT_FIELDS },
    ]);
    assignments.push(assignment);
  }

  res.status(201).json(assignments);
});

export const revokeAssignment = asyncHandler(async (req, res) => {
  const assignment = await TestAssignment.findByIdAndUpdate(
    req.params.id,
    { status: "revoked", revokedAt: new Date() },
    { new: true }
  );
  if (!assignment) throw ApiError.notFound("Assignment not found");
  res.json(assignment);
});

export const allowRetake = asyncHandler(async (req, res) => {
  const assignment = await TestAssignment.findById(req.params.id);
  if (!assignment) throw ApiError.notFound("Assignment not found");
  if (assignment.status === "revoked") {
    throw ApiError.badRequest("This assignment is revoked. Re-assign the test to restore access.");
  }
  assignment.attemptsAllowed += 1;
  if (assignment.status === "submitted" || assignment.status === "expired") {
    assignment.status = "not_started";
  }
  // A retake must be usable: if the availability window already closed, reopen it.
  if (assignment.availabilityEnd && assignment.availabilityEnd.getTime() < Date.now()) {
    assignment.availabilityEnd = null as never;
  }
  await assignment.save();
  res.json(assignment);
});

export const getPublicAssignment = asyncHandler(async (req, res) => {
  const { shareToken } = req.params as { shareToken: string };
  const assignment = await TestAssignment.findOne({ shareToken })
    .populate("test")
    .populate("student", "firstName lastName")
    .populate("course", "title");

  if (!assignment) throw ApiError.notFound("This test link is not valid");
  if (assignment.status === "revoked") throw ApiError.forbidden("This test link has been revoked");

  const test = toPlain(assignment.test) as unknown as {
    id: string;
    title: string;
    instructions: string;
    timeLimitMinutes: number;
    passPercentage: number;
    showResultImmediately: boolean;
    questions: never[];
  };
  if (!test) throw ApiError.notFound("Test not found");
  const testId = String((assignment.test as unknown as { _id: unknown })._id);

  // Explicit allow-list: never leak createdBy, answers, settings, etc.
  res.json({
    shareToken: assignment.shareToken,
    assignmentId: assignment.id,
    status: assignment.status,
    availabilityStart: assignment.availabilityStart,
    availabilityEnd: assignment.availabilityEnd,
    attemptsAllowed: assignment.attemptsAllowed,
    test: {
      id: testId,
      title: test.title,
      instructions: test.instructions,
      timeLimitMinutes: test.timeLimitMinutes,
      passPercentage: test.passPercentage,
      showResultImmediately: test.showResultImmediately,
      questions: stripCorrectAnswersFromQuestions(test.questions),
    },
    student: assignment.student,
    course: assignment.course,
  });
});
