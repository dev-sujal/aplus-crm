import { Enrollment } from "../models/Enrollment.model.js";
import { Course } from "../models/Course.model.js";
import { Student } from "../models/Student.model.js";
import { ensureFeeForEnrollment } from "../utils/fee.js";
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

  const enrollment = await Enrollment.create({
    student: body.student,
    course: body.course,
    batch: body.batch ?? "",
    registrationDate: body.registrationDate ?? new Date(),
    createdBy: req.user!.id,
  });

  await ensureFeeForEnrollment(enrollment.id, course.fee);

  const populated = await enrollment.populate([
    { path: "student", select: "firstName lastName email phone photoUrl" },
    { path: "course", select: "title fee status" },
  ]);

  res.status(201).json(populated);
});

export const updateEnrollment = asyncHandler(async (req, res) => {
  const body = req.body as UpdateEnrollmentInput;
  const enrollment = await Enrollment.findByIdAndUpdate(req.params.id, body, { new: true }).populate(
    [
      { path: "student", select: "firstName lastName email phone photoUrl" },
      { path: "course", select: "title fee status" },
    ]
  );
  if (!enrollment) throw ApiError.notFound("Enrollment not found");
  res.json(enrollment);
});

export const deleteEnrollment = asyncHandler(async (req, res) => {
  const result = await Enrollment.deleteOne({ _id: req.params.id });
  if (result.deletedCount === 0) throw ApiError.notFound("Enrollment not found");
  res.status(204).send();
});
