import { randomUUID } from "node:crypto";
import { Question } from "../models/Question.model.js";
import { TestAttempt } from "../models/TestAttempt.model.js";
import { containsFilter } from "../utils/search.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import type {
  CreateQuestionInput,
  ListQuestionsQuery,
  UpdateQuestionInput,
} from "../validators/test.validator.js";

function normalizeOptions(options: { id: string; text: string }[]) {
  return options.map((option) => ({ id: option.id || randomUUID(), text: option.text }));
}

export const listQuestions = asyncHandler(async (req, res) => {
  const { course, type, topic, difficulty, status, search, page, limit } = req.query as unknown as ListQuestionsQuery;

  const filter: Record<string, unknown> = {};
  if (course) filter.course = course;
  if (type) filter.type = type;
  if (topic?.trim()) filter.topic = containsFilter(topic);
  if (difficulty) filter.difficulty = difficulty;
  if (status) filter.status = status;
  if (search?.trim()) {
    const pattern = containsFilter(search);
    filter.$or = [{ text: pattern }, { topic: pattern }, { explanation: pattern }];
  }

  const [items, total] = await Promise.all([
    Question.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Question.countDocuments(filter),
  ]);

  res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
});

export const getQuestion = asyncHandler(async (req, res) => {
  const question = await Question.findById(req.params.id);
  if (!question) throw ApiError.notFound("Question not found");
  res.json(question);
});

export const createQuestion = asyncHandler(async (req: AuthedRequest, res) => {
  const body = req.body as CreateQuestionInput;
  const question = await Question.create({
    ...body,
    options: normalizeOptions(body.options),
    correctOptionIds: [...new Set(body.correctOptionIds)],
    explanation: body.explanation ?? "",
    topic: body.topic ?? "",
    difficulty: body.difficulty ?? "medium",
    createdBy: req.user!.id,
    updatedBy: req.user!.id,
  });
  res.status(201).json(question);
});

export const updateQuestion = asyncHandler(async (req: AuthedRequest, res) => {
  const body = req.body as UpdateQuestionInput;
  const question = await Question.findById(req.params.id);
  if (!question) throw ApiError.notFound("Question not found");

  const editableQuestion = question as any;
  if (body.course !== undefined) editableQuestion.course = body.course;
  if (body.type !== undefined) editableQuestion.type = body.type;
  if (body.text !== undefined) editableQuestion.text = body.text;
  if (body.options !== undefined) editableQuestion.options = normalizeOptions(body.options);
  if (body.correctOptionIds !== undefined) editableQuestion.correctOptionIds = [...new Set(body.correctOptionIds)];
  if (body.marks !== undefined) editableQuestion.marks = body.marks;
  if (body.explanation !== undefined) editableQuestion.explanation = body.explanation;
  if (body.topic !== undefined) editableQuestion.topic = body.topic;
  if (body.difficulty !== undefined) editableQuestion.difficulty = body.difficulty;
  editableQuestion.updatedBy = req.user!.id;

  // Re-validate the merged question (a partial PATCH can otherwise leave a
  // single-answer question with several answers, or answers that no longer exist).
  const optionIds = new Set(question.options.map((option) => option.id));
  if (question.correctOptionIds.some((id) => !optionIds.has(id))) {
    throw ApiError.badRequest("Correct answers must be among the options");
  }
  if (question.type === "single" && question.correctOptionIds.length !== 1) {
    throw ApiError.badRequest("Single answer questions must have exactly one correct option");
  }
  if (question.type === "multiple" && question.correctOptionIds.length < 1) {
    throw ApiError.badRequest("Multiple answer questions must have at least one correct option");
  }

  await question.save();
  res.json(question);
});

export const archiveQuestion = asyncHandler(async (req, res) => {
  const question = await Question.findById(req.params.id);
  if (!question) throw ApiError.notFound("Question not found");
  const archivedQuestion = question as any;
  archivedQuestion.status = "archived";
  archivedQuestion.archivedAt = new Date();
  await question.save();
  res.json(question);
});

export const deleteQuestion = asyncHandler(async (req, res) => {
  const questionId = req.params.id;
  const usedInTakenTest = await TestAttempt.exists({ "testSnapshot.questions.questionId": questionId });
  if (usedInTakenTest) {
    const archived = await Question.findById(questionId);
    if (!archived) throw ApiError.notFound("Question not found");
    const archivedQuestion = archived as any;
    archivedQuestion.status = "archived";
    archivedQuestion.archivedAt = new Date();
    await archived.save();
    return res.json(archived);
  }

  const result = await Question.deleteOne({ _id: questionId });
  if (result.deletedCount === 0) throw ApiError.notFound("Question not found");
  res.status(204).send();
});
