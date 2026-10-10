import { Course } from "../models/Course.model.js";
import { Question } from "../models/Question.model.js";
import { Test } from "../models/Test.model.js";
import { containsFilter } from "../utils/search.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { buildTestQuestionSnapshots } from "../utils/testSnapshots.js";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import type {
  CreateTestInput,
  ListTestsQuery,
  UpdateTestInput,
} from "../validators/test.validator.js";

/**
 * Loads the chosen questions in the order the owner picked them.
 * Archived questions are rejected unless they are already part of the test
 * being edited (`keepIds`), so old tests stay editable.
 */
async function loadCourseQuestions(courseId: string, questionIds: string[], keepIds: string[] = []) {
  const uniqueIds = [...new Set(questionIds)];
  if (uniqueIds.length === 0) return [];

  const found = await Question.find({
    _id: { $in: uniqueIds },
    course: courseId,
    $or: [{ status: { $ne: "archived" } }, { _id: { $in: keepIds } }],
  });

  const byId = new Map(found.map((question) => [question.id as string, question]));
  const ordered = uniqueIds.map((id) => byId.get(id));
  if (ordered.some((question) => !question)) {
    throw ApiError.badRequest("One or more selected questions are archived or do not belong to this course");
  }
  return ordered as typeof found;
}

async function buildQuestions(courseId: string, questionIds: string[], keepIds: string[] = []) {
  const questions = await loadCourseQuestions(courseId, questionIds, keepIds);
  return buildTestQuestionSnapshots(questions);
}

export const listTests = asyncHandler(async (req, res) => {
  const { course, status, search, page, limit } = req.query as unknown as ListTestsQuery;
  const filter: Record<string, unknown> = {};
  if (course) filter.course = course;
  if (status) filter.status = status;
  if (search?.trim()) filter.title = containsFilter(search);

  const [items, total] = await Promise.all([
    Test.find(filter)
      .populate("course", "title")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Test.countDocuments(filter),
  ]);

  res.json({
    items: items.map((test) => ({
      ...test.toJSON(),
      questionCount: test.questions.length,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

export const getTest = asyncHandler(async (req, res) => {
  const test = await Test.findById(req.params.id).populate("course", "title");
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

  if (body.course !== undefined && body.course !== String(test.course)) {
    const course = await Course.findById(body.course);
    if (!course) throw ApiError.notFound("Course not found");
    if (body.questionIds === undefined) {
      throw ApiError.badRequest("Pick questions from the new course when changing a test's course");
    }
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
    const existingIds = test.questions.map((item) => String(item.questionId));
    (test as any).questions = await buildQuestions(String(test.course), body.questionIds, existingIds);
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
