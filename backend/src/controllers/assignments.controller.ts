import { randomUUID } from "node:crypto";
import { Course } from "../models/Course.model.js";
import { Enrollment } from "../models/Enrollment.model.js";
import { Test } from "../models/Test.model.js";
import { TestAssignment } from "../models/TestAssignment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { stripCorrectAnswersFromQuestions } from "../utils/testSnapshots.js";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import type { AssignTestInput } from "../validators/test.validator.js";

export const listAssignments = asyncHandler(async (req, res) => {
  const { test, course, student } = req.query as { test?: string; course?: string; student?: string };
  const filter: Record<string, unknown> = {};
  if (test) filter.test = test;
  if (course) filter.course = course;
  if (student) filter.student = student;

  const assignments = await TestAssignment.find(filter)
    .populate("test", "title course timeLimitMinutes status publishedAt showResultImmediately")
    .populate("course", "title")
    .populate("student", "firstName lastName email phone")
    .sort({ createdAt: -1 });

  res.json(
    assignments.map((assignment) => ({
      ...assignment.toObject(),
      status: assignment.status,
    }))
  );
});

export const assignTestToStudents = asyncHandler(async (req: AuthedRequest, res) => {
  const body = req.body as AssignTestInput;
  const test = await Test.findById(req.params.testId);
  if (!test) throw ApiError.notFound("Test not found");
  if (test.status !== "published") throw ApiError.badRequest("Only published tests can be assigned");

  const enrollments = await Enrollment.find({
    course: test.course,
    student: { $in: body.studentIds },
  }).select("student");

  const enrolledStudentIds = new Set(enrollments.map((enrollment) => enrollment.student.toString()));
  const missingStudentIds = body.studentIds.filter((studentId) => !enrolledStudentIds.has(studentId));
  if (missingStudentIds.length > 0) {
    throw ApiError.badRequest(`Students must be enrolled in the course: ${missingStudentIds.join(", ")}`);
  }

  const assignments = await Promise.all(
    body.studentIds.map(async (studentId) => {
      const existing = await TestAssignment.findOne({ test: test.id, student: studentId });
      const shareToken = existing?.shareToken ?? randomUUID();
      const assignment = await TestAssignment.findOneAndUpdate(
        { test: test.id, student: studentId },
        {
          $set: {
            course: test.course,
            availabilityStart: body.availabilityStart ? new Date(body.availabilityStart) : null,
            availabilityEnd: body.availabilityEnd ? new Date(body.availabilityEnd) : null,
            attemptsAllowed: body.attemptsAllowed ?? 1,
            status: "not_started",
            revokedAt: null,
            assignedBy: req.user!.id,
          },
          $setOnInsert: {
            shareToken,
          },
        },
        { upsert: true, new: true }
      )
        .populate("test", "title course timeLimitMinutes status publishedAt showResultImmediately")
        .populate("course", "title")
        .populate("student", "firstName lastName email phone");

      return assignment;
    })
  );

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
  assignment.attemptsAllowed += 1;
  if (assignment.status === "submitted" || assignment.status === "expired") {
    assignment.status = "not_started";
  }
  await assignment.save();
  res.json(assignment);
});

export const getPublicAssignment = asyncHandler(async (req, res) => {
  const assignment = await TestAssignment.findOne({ shareToken: (req.params as { shareToken: string }).shareToken } as any)
    .populate("test")
    .populate("student", "firstName lastName email phone")
    .populate("course", "title");

  if (!assignment) throw ApiError.notFound("Assignment not found");
  if (assignment.status === "revoked") throw ApiError.forbidden("Assignment has been revoked");

  const test = assignment.test as any;
  const questions = stripCorrectAnswersFromQuestions((test.questions ?? []) as never);

  res.json({
    shareToken: assignment.shareToken,
    assignmentId: assignment._id.toString(),
    status: assignment.status,
    availabilityStart: assignment.availabilityStart,
    availabilityEnd: assignment.availabilityEnd,
    attemptsAllowed: assignment.attemptsAllowed,
    test: {
      ...test,
      questions,
    },
    student: assignment.student,
    course: assignment.course,
  });
});
