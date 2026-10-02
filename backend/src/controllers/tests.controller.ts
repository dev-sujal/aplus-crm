import { Course } from "../models/Course.model.js";
import { Question } from "../models/Question.model.js";
import { Test } from "../models/Test.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { buildTestQuestionSnapshots } from "../utils/testSnapshots.js";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import type {
  CreateTestInput,
  ListTestsQuery,
  UpdateTestInput,
} from "../validators/test.validator.js";

async function loadCourseQuestions(courseId: string, questionIds: string[]) {
  const uniqueIds = [...new Set(questionIds)];
  if (uniqueIds.length === 0) return [];

  const questions = await Question.find({
    _id: { $in: uniqueIds },
    course: courseId,
    status: { $ne: "archived" },
  }).sort({ createdAt: 1 });

  if (questions.length !== uniqueIds.length) {
    throw ApiError.badRequest("One or more selected questions are invalid for this course");
  }
  return questions;
}

async function buildQuestions(courseId: string, questionIds: string[]) {
  const questions = await loadCourseQuestions(courseId, questionIds);
  return buildTestQuestionSnapshots(questions);
}

export const listTests = asyncHandler(async (req, res) => {
  const { course, status, search, page, limit } = req.query as unknown as ListTestsQuery;
  const filter: Record<string, unknown> = {};
  if (course) filter.course = course;
  if (status) filter.status = status;
  if (search) filter.$text = { $search: search };

  const [items, total] = await Promise.all([
    Test.find(filter)
      .sort(search ? { score: { $meta: "textScore" } } : { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Test.countDocuments(filter),
  ]);

  res.json({
    items: items.map((test) => ({
      ...test.toObject(),
      questionCount: test.questions.length,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

export const getTest = asyncHandler(async (req, res) => {
  const test = await Test.findById(req.params.id);
  if (!test) throw ApiError.notFound("Test not found");
  res.json(test);
});

export const createTest = asyncHandler(async (req: AuthedRequest, res) => {
  const body = req.body as CreateTestInput;

  const course = await Course.findById(body.course);
  if (!course) throw ApiError.notFound("Course not found");

  const questions = await buildQuestions(body.course, body.questionIds ?? []);
  if (body.status === "published" && questions.length === 0) {
    throw ApiError.badRequest("Published tests must contain at least one question");
  }

  const test = await Test.create({
    course: body.course,
    title: body.title,
    instructions: body.instructions ?? "",
    timeLimitMinutes: body.timeLimitMinutes ?? 30,
    passPercentage: body.passPercentage ?? 40,
    multiAnswerScoring: body.multiAnswerScoring ?? "partial",
    negativeMarking: body.negativeMarking ?? false,
    negativeMarkingRate: body.negativeMarkingRate ?? 0.25,
    shuffleQuestions: body.shuffleQuestions ?? false,
    shuffleOptions: body.shuffleOptions ?? false,
    showResultImmediately: body.showResultImmediately ?? true,
    status: body.status ?? "draft",
    publishedAt: body.status === "published" ? new Date() : null,
    questions,
    createdBy: req.user!.id,
    updatedBy: req.user!.id,
  });

  res.status(201).json(test);
});

export const updateTest = asyncHandler(async (req: AuthedRequest, res) => {
  const body = req.body as UpdateTestInput;
  const test = await Test.findById(req.params.id);
  if (!test) throw ApiError.notFound("Test not found");

  if (body.course !== undefined) {
    const course = await Course.findById(body.course);
    if (!course) throw ApiError.notFound("Course not found");
    (test as any).course = body.course;
  }
  if (body.title !== undefined) test.title = body.title;
  if (body.instructions !== undefined) test.instructions = body.instructions;
  if (body.timeLimitMinutes !== undefined) test.timeLimitMinutes = body.timeLimitMinutes;
  if (body.passPercentage !== undefined) test.passPercentage = body.passPercentage;
  if (body.multiAnswerScoring !== undefined) test.multiAnswerScoring = body.multiAnswerScoring;
  if (body.negativeMarking !== undefined) test.negativeMarking = body.negativeMarking;
  if (body.negativeMarkingRate !== undefined) test.negativeMarkingRate = body.negativeMarkingRate;
  if (body.shuffleQuestions !== undefined) test.shuffleQuestions = body.shuffleQuestions;
  if (body.shuffleOptions !== undefined) test.shuffleOptions = body.shuffleOptions;
  if (body.showResultImmediately !== undefined) test.showResultImmediately = body.showResultImmediately;
  if (body.questionIds !== undefined) {
    (test as any).questions = await buildQuestions(String(test.course), body.questionIds);
  }
  if (body.status !== undefined) test.status = body.status;
  if (test.status === "published" && !test.publishedAt) {
    test.publishedAt = new Date();
  }
  if (test.status === "published" && test.questions.length === 0) {
    throw ApiError.badRequest("Published tests must contain at least one question");
  }

  (test as any).updatedBy = req.user!.id;
  await test.save();
  res.json(test);
});

export const publishTest = asyncHandler(async (req, res) => {
  const test = await Test.findById(req.params.id);
  if (!test) throw ApiError.notFound("Test not found");
  if (test.questions.length === 0) throw ApiError.badRequest("Published tests must contain at least one question");
  test.status = "published";
  test.publishedAt = new Date();
  await test.save();
  res.json(test);
});

export const archiveTest = asyncHandler(async (req, res) => {
  const test = await Test.findById(req.params.id);
  if (!test) throw ApiError.notFound("Test not found");
  test.status = "archived";
  await test.save();
  res.json(test);
});
