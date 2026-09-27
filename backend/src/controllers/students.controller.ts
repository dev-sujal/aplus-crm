import mongoose from "mongoose";
import { Student } from "../models/Student.model.js";
import { Enrollment } from "../models/Enrollment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type {
  CreateStudentInput,
  ListStudentsQuery,
  UpdateStudentInput,
} from "../validators/student.validator.js";

export const listStudents = asyncHandler(async (req, res) => {
  const { search, page, limit } = req.query as unknown as ListStudentsQuery;

  const filter: Record<string, unknown> = {};
  if (search) filter.$text = { $search: search };

  const [items, total] = await Promise.all([
    Student.find(filter)
      .sort(search ? { score: { $meta: "textScore" } } : { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Student.countDocuments(filter),
  ]);

  res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
});

export const getStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw ApiError.notFound("Student not found");

  const enrollments = await Enrollment.find({ student: student.id }).populate("course");
  res.json({ ...student.toObject(), enrollments });
});

export const createStudent = asyncHandler(async (req, res) => {
  const body = req.body as CreateStudentInput;
  const student = await Student.create({ ...body, dob: body.dob ?? null });
  res.status(201).json(student);
});

export const updateStudent = asyncHandler(async (req, res) => {
  const body = req.body as UpdateStudentInput;
  const student = await Student.findByIdAndUpdate(req.params.id, body, { new: true });
  if (!student) throw ApiError.notFound("Student not found");
  res.json(student);
});

export const deleteStudent = asyncHandler(async (req, res) => {
  const result = await Student.deleteOne({ _id: req.params.id });
  if (result.deletedCount === 0) throw ApiError.notFound("Student not found");
  await Enrollment.deleteMany({ student: new mongoose.Types.ObjectId(req.params.id as string) });
  res.status(204).send();
});
