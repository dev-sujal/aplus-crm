import mongoose from "mongoose";
import { Course } from "../models/Course.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import type {
  CreateCourseInput,
  ListCoursesQuery,
  UpdateCourseInput,
} from "../validators/course.validator.js";

/**
 * Enrollment model doesn't exist until the Students module is built. Count
 * safely against the raw collection so this keeps working once it does,
 * without a hard import-time dependency between modules.
 */
async function countEnrolled(courseId: string): Promise<number> {
  const collections = await mongoose.connection.db?.listCollections({ name: "enrollments" }).toArray();
  if (!collections || collections.length === 0) return 0;
  return mongoose.connection
    .collection("enrollments")
    .countDocuments({ course: new mongoose.Types.ObjectId(courseId) });
}

export const listCourses = asyncHandler(async (req, res) => {
  const { search, status, category, page, limit } = req.query as unknown as ListCoursesQuery;

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (search) filter.$text = { $search: search };

  const [items, total] = await Promise.all([
    Course.find(filter)
      .sort(search ? { score: { $meta: "textScore" } } : { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Course.countDocuments(filter),
  ]);

  res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
});

export const getCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw ApiError.notFound("Course not found");
  const enrolledCount = await countEnrolled(course.id);
  res.json({ ...course.toObject(), enrolledCount });
});

export const createCourse = asyncHandler(async (req: AuthedRequest, res) => {
  const body = req.body as CreateCourseInput;
  const course = await Course.create({
    ...body,
    durationWeeks: body.durationWeeks ?? null,
    maxSeats: body.maxSeats ?? null,
    startDate: body.startDate ?? null,
    endDate: body.endDate ?? null,
    createdBy: req.user!.id,
  });
  res.status(201).json(course);
});

export const updateCourse = asyncHandler(async (req, res) => {
  const body = req.body as UpdateCourseInput;
  const course = await Course.findByIdAndUpdate(req.params.id, body, { new: true });
  if (!course) throw ApiError.notFound("Course not found");
  res.json(course);
});

export const deleteCourse = asyncHandler(async (req, res) => {
  const result = await Course.deleteOne({ _id: req.params.id });
  if (result.deletedCount === 0) throw ApiError.notFound("Course not found");
  res.status(204).send();
});
