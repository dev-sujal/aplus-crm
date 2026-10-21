import { Enrollment } from "../models/Enrollment.model.js";
import { Course } from "../models/Course.model.js";
import { Student } from "../models/Student.model.js";
import { Fee } from "../models/Fee.model.js";
import { ensureFeeForEnrollment, validateFeeCap } from "../utils/fee.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import type {
  CreateEnrollmentInput,
  ListEnrollmentsQuery,
  UpdateEnrollmentInput,
} from "../validators/student.validator.js";

export const listEnrollments = asyncHandler(async (req, res) => {
  const { student, course } = req.query as unknown as ListEnrollmentsQuery;
  const filter: Record<string, unknown> = {};
  if (student) filter.student = student;
  if (course) filter.course = course;

  const enrollments = await Enrollment.find(filter)
    .populate("student", "firstName lastName email phone photoUrl")
    .populate("course", "title fee status")
    .sort({ createdAt: -1 });

  res.json(enrollments);
});

export const createEnrollment = asyncHandler(async (req: AuthedRequest, res) => {
  const body = req.body as CreateEnrollmentInput;

  const [student, course] = await Promise.all([
    Student.findById(body.student),
    Course.findById(body.course),
  ]);
  if (!student) throw ApiError.notFound("Student not found");
  if (!course) throw ApiError.notFound("Course not found");

  if (course.maxSeats != null) {
    const activeCount = await Enrollment.countDocuments({
      course: course.id,
      status: { $ne: "dropped" },
    });
    if (activeCount >= course.maxSeats) {
      throw ApiError.conflict("This course has no seats remaining");
    }
  }

  const finalFee = body.fee ?? course.fee;
  validateFeeCap(finalFee, course.fee);

  const enrollment = await Enrollment.create({
    student: body.student,
    course: body.course,
    fee: finalFee,
    batch: body.batch ?? "",
    registrationDate: body.registrationDate ?? new Date(),
    createdBy: req.user!.id,
  });

  await ensureFeeForEnrollment(enrollment.id, enrollment.fee ?? course.fee);

  const populated = await enrollment.populate([
    { path: "student", select: "firstName lastName email phone photoUrl" },
    { path: "course", select: "title fee status" },
  ]);

  res.status(201).json(populated);
});

export const updateEnrollment = asyncHandler(async (req: AuthedRequest, res) => {
  const body = req.body as UpdateEnrollmentInput;
  const enrollment = await Enrollment.findById(req.params.id);
  if (!enrollment) throw ApiError.notFound("Enrollment not found");

  // Validate everything that touches money *before* writing anything, so a
  // rejected fee change never leaves the enrollment and its fee record out of sync.
  let feeRecord: Awaited<ReturnType<typeof Fee.findOne>> = null;
  const feeChanged = body.fee !== undefined && body.fee !== enrollment.fee;
  if (feeChanged) {
    const newFee = body.fee as number;
    // The Fees module is owner-only, so changing what a student owes is too.
    if (req.user?.role !== "owner") {
      throw ApiError.forbidden("Only the owner can change a student's course fee");
    }

    const course = await Course.findById(enrollment.course).select("fee");
    if (course && newFee > course.fee) {
      throw ApiError.badRequest(`Fee cannot exceed the course fee (${course.fee})`);
    }

    feeRecord = await Fee.findOne({ enrollment: enrollment.id });
    if (feeRecord && newFee < feeRecord.amountPaid) {
      throw ApiError.badRequest(
        `Fee cannot be lower than the amount already collected (${feeRecord.amountPaid})`
      );
    }
  }

  if (body.status !== undefined) enrollment.status = body.status;
  if (body.batch !== undefined) enrollment.batch = body.batch;
  if (feeChanged) enrollment.fee = body.fee as number;
  await enrollment.save();

  if (feeChanged) {
    const newFee = body.fee as number;
    if (feeRecord) {
      feeRecord.totalFee = newFee;
      feeRecord.amountRemaining = Math.max(newFee - feeRecord.amountPaid, 0);
      await feeRecord.save();
    } else {
      await ensureFeeForEnrollment(enrollment.id, newFee);
    }
  }

  const populated = await enrollment.populate([
    { path: "student", select: "firstName lastName email phone photoUrl" },
    { path: "course", select: "title fee status" },
  ]);
  res.json(populated);
});

export const deleteEnrollment = asyncHandler(async (req, res) => {
  const result = await Enrollment.deleteOne({ _id: req.params.id });
  if (result.deletedCount === 0) throw ApiError.notFound("Enrollment not found");
  res.status(204).send();
});
