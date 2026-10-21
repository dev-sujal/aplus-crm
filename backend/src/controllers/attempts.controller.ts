import { TestAttempt } from "../models/TestAttempt.model.js";
import { TestAssignment } from "../models/TestAssignment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { applyAttemptPerformanceUpdate } from "../utils/testPerformance.js";
import { buildAttemptQuestionSnapshots, stripCorrectAnswersFromQuestions, toPlain } from "../utils/testSnapshots.js";
import { scoreTestAttempt } from "../utils/mcqScoring.js";
import type { SaveProgressInput, SubmitAttemptInput } from "../validators/test.validator.js";

function now() {
  return new Date();
}

function minutesToMs(minutes: number) {
  return minutes * 60 * 1000;
}

/**
 * Keeps only answers for questions that exist in the attempt and only option
 * ids that exist on that question; single-answer questions keep one option.
 */
function sanitizeAnswers(
  answers: { questionId: string; selectedOptionIds?: string[]; markedForReview?: boolean }[],
  questions: { questionId: unknown; snapshot: { type: string; options: { id: string }[] } }[]
) {
  const byId = new Map(questions.map((question) => [String(question.questionId), question.snapshot]));
  const seen = new Set<string>();
  const clean: { questionId: string; selectedOptionIds: string[]; markedForReview: boolean; answeredAt: Date | null }[] = [];
  for (const answer of answers) {
    const snapshot = byId.get(answer.questionId);
    if (!snapshot || seen.has(answer.questionId)) continue;
    seen.add(answer.questionId);
    const validIds = new Set(snapshot.options.map((option) => option.id));
    let selected = [...new Set(answer.selectedOptionIds ?? [])].filter((id) => validIds.has(id));
    if (snapshot.type === "single") selected = selected.slice(0, 1);
    clean.push({
      questionId: answer.questionId,
      selectedOptionIds: selected,
      markedForReview: Boolean(answer.markedForReview),
      answeredAt: selected.length ? now() : null,
    });
  }
  return clean;
}

async function getAssignmentForToken(shareToken: string) {
  const assignment = await TestAssignment.findOne({ shareToken })
    .populate("test")
    .populate("student", "firstName lastName email phone")
    .populate("course", "title");
  if (!assignment) throw ApiError.notFound("This test link is not valid");
  if (!assignment.test) throw ApiError.notFound("The test for this link no longer exists");
  return assignment;
}

function getTestFromAssignment(assignment: Awaited<ReturnType<typeof getAssignmentForToken>>) {
  const plain = toPlain(assignment.test) as unknown as Record<string, unknown> & { _id: unknown };
  return { ...plain, id: String(plain._id) } as unknown as {
    id: string;
    title: string;
    instructions: string;
    timeLimitMinutes: number;
    passPercentage: number;
    multiAnswerScoring: "all_correct" | "partial";
    negativeMarking: boolean;
    negativeMarkingRate: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showResultImmediately: boolean;
    questions: { questionId: string; snapshot: any; order: number }[];
  };
}

async function persistAttemptResult(
  attempt: any,
  submissionMode: "manual" | "auto"
) {
  if (!attempt) throw ApiError.notFound("Attempt not found");
  if (attempt.result && (attempt.status === "submitted" || attempt.status === "auto_submitted")) {
    return attempt;
  }

  const test = toPlain(attempt.testSnapshot) as unknown as {
    title: string;
    passPercentage: number;
    multiAnswerScoring: "all_correct" | "partial";
    negativeMarking: boolean;
    negativeMarkingRate: number;
    questions: { questionId: string; snapshot: any; order: number }[];
  };

  const scored = scoreTestAttempt(test.questions, (attempt.answers as any[]).map((answer) => ({
    questionId: answer.questionId.toString(),
    selectedOptionIds: answer.selectedOptionIds,
    markedForReview: answer.markedForReview,
    answeredAt: answer.answeredAt,
  })), {
    passPercentage: test.passPercentage,
    multiAnswerScoring: test.multiAnswerScoring,
    negativeMarking: test.negativeMarking,
    negativeMarkingRate: test.negativeMarkingRate,
    submissionMode,
    timeTakenSeconds: attempt.startedAt ? Math.max(0, Math.round((now().getTime() - new Date(attempt.startedAt).getTime()) / 1000)) : 0,
  });

  attempt.result = scored as never;
  attempt.status = submissionMode === "manual" ? "submitted" : "auto_submitted";
  attempt.submittedAt = now();
  attempt.lastSavedAt = now();
  await attempt.save();

  const assignment = await TestAssignment.findById(attempt.assignment);
  if (assignment) {
    assignment.status = assignment.status === "revoked" ? "revoked" : "submitted";
    assignment.latestAttemptId = attempt.id;
    assignment.lastAttemptAt = attempt.submittedAt;
    await assignment.save();
  }

  await applyAttemptPerformanceUpdate({
    attemptId: attempt.id,
    test: attempt.test.toString(),
    course: attempt.course.toString(),
    student: attempt.student.toString(),
    testTitle: test.title,
    score: scored.score,
    percentage: scored.percentage,
    passed: scored.passed,
    submittedAt: attempt.submittedAt!,
    questionResults: scored.questionResults,
    topicPerformance: scored.topicPerformance,
    testSnapshot: { questions: test.questions },
  });

  return attempt.populate([
    { path: "student", select: "firstName lastName email phone" },
    { path: "course", select: "title" },
    { path: "assignment" },
  ]);
}

export async function finalizeExpiredAttemptById(attemptId: string) {
  const attempt: any = await TestAttempt.findById(attemptId);
  if (!attempt) return null;
  if (attempt.status !== "in_progress") return attempt;
  return persistAttemptResult(attempt, "auto");
}

async function ensureAttemptOpen(shareToken: string) {
  const assignment = await getAssignmentForToken(shareToken);
  const test = getTestFromAssignment(assignment);

  if (assignment.status === "revoked") throw ApiError.forbidden("This test link has been revoked");
  if ((assignment.test as unknown as { status: string }).status !== "published") {
    throw ApiError.forbidden("This test is not available");
  }

  if (assignment.availabilityStart && now() < new Date(assignment.availabilityStart)) {
    throw ApiError.forbidden("Test is not available yet");
  }
  if (assignment.availabilityEnd && now() > new Date(assignment.availabilityEnd)) {
    assignment.status = "expired";
    await assignment.save();
    throw ApiError.forbidden("Test availability has expired");
  }

  const existingAttempt: any = await TestAttempt.findOne({ assignment: assignment.id, status: "in_progress" });
  if (existingAttempt) {
    if (existingAttempt.expiresAt && now() > new Date(existingAttempt.expiresAt)) {
      // Time ran out while the student was away: score it, then fall through
      // to the "attempts remaining" check below.
      await persistAttemptResult(existingAttempt, "auto");
    } else {
      return { assignment, test, existingAttempt };
    }
  }

  const totalAttempts = await TestAttempt.countDocuments({ assignment: assignment.id });
  if (totalAttempts >= assignment.attemptsAllowed) {
    throw ApiError.forbidden("You have no attempts remaining for this test");
  }

  const questionSnapshots = buildAttemptQuestionSnapshots(test.questions, test.shuffleQuestions, test.shuffleOptions);
  const attempt: any = await TestAttempt.create({
    assignment: assignment.id,
    test: test.id,
    course: (assignment.course as unknown as { _id: string })._id,
    student: (assignment.student as unknown as { _id: string })._id,
    attemptNumber: totalAttempts + 1,
    status: "in_progress",
    startedAt: now(),
    expiresAt: new Date(now().getTime() + minutesToMs(test.timeLimitMinutes)),
    lastSavedAt: now(),
    currentQuestionIndex: 0,
    testSnapshot: {
      title: test.title,
      instructions: test.instructions,
      timeLimitMinutes: test.timeLimitMinutes,
      passPercentage: test.passPercentage,
      multiAnswerScoring: test.multiAnswerScoring,
      negativeMarking: test.negativeMarking,
      negativeMarkingRate: test.negativeMarkingRate,
      shuffleQuestions: test.shuffleQuestions,
      shuffleOptions: test.shuffleOptions,
      showResultImmediately: test.showResultImmediately,
      questions: questionSnapshots,
    },
    answers: [],
    presentation: {
      questionOrder: questionSnapshots.map((question) => question.questionId),
      optionOrder: questionSnapshots.map((question) => ({
        questionId: question.questionId,
        optionIds: question.snapshot.options.map((option: { id: string }) => option.id),
      })),
    },
  });

  assignment.status = "in_progress";
  assignment.latestAttemptId = attempt._id as never;
  assignment.lastAttemptAt = now();
  await assignment.save();

  return { assignment, test, existingAttempt: attempt };
}

export const startAttempt = asyncHandler(async (req, res) => {
  const { shareToken } = req.params as { shareToken: string };
  const { assignment, test, existingAttempt } = await ensureAttemptOpen(shareToken);
  const attempt = existingAttempt;
  const testSnapshot = toPlain(attempt.testSnapshot) as { questions: any[] };

  res.json({
    assignmentId: assignment.id,
    shareToken,
    attemptId: attempt.id,
    status: attempt.status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    currentQuestionIndex: attempt.currentQuestionIndex,
    test: {
      title: test.title,
      instructions: test.instructions,
      timeLimitMinutes: test.timeLimitMinutes,
      passPercentage: test.passPercentage,
      showResultImmediately: test.showResultImmediately,
      questions: stripCorrectAnswersFromQuestions(testSnapshot.questions as never),
    },
    student: assignment.student,
    course: assignment.course,
    answers: (attempt.answers as any[]).map((answer) => ({
      questionId: String(answer.questionId),
      selectedOptionIds: answer.selectedOptionIds,
      markedForReview: answer.markedForReview,
      answeredAt: answer.answeredAt,
    })),
  });
});

export const saveAttemptProgress = asyncHandler(async (req, res) => {
  const body = req.body as SaveProgressInput;
  const assignment = await getAssignmentForToken((req.params as { shareToken: string }).shareToken);
  const attempt: any = await TestAttempt.findOne({ assignment: assignment.id, status: "in_progress" }).sort({ createdAt: -1 });
  if (!attempt) throw ApiError.notFound("Active attempt not found");
  if (attempt.expiresAt && now() > new Date(attempt.expiresAt)) {
    await persistAttemptResult(attempt, "auto");
    return res.json({ expired: true, saved: false });
  }

  attempt.answers = sanitizeAnswers(body.answers, toPlain(attempt.testSnapshot).questions as never) as never;
  attempt.currentQuestionIndex = body.currentQuestionIndex ?? attempt.currentQuestionIndex;
  attempt.lastSavedAt = now();
  await attempt.save();
  res.json({ saved: true });
});

export const submitAttempt = asyncHandler(async (req, res) => {
  const body = req.body as SubmitAttemptInput;
  const assignment = await getAssignmentForToken((req.params as { shareToken: string }).shareToken);
  const attempt: any = await TestAttempt.findOne({ assignment: assignment.id, status: "in_progress" }).sort({ createdAt: -1 });
  if (!attempt) throw ApiError.notFound("Active attempt not found");
  // Late submissions (timer ran out) are still scored with whatever was sent,
  // but recorded as auto-submitted.
  const late = Boolean(attempt.expiresAt && now().getTime() > new Date(attempt.expiresAt).getTime() + 30_000);
  if (body.answers && !late) {
    attempt.answers = sanitizeAnswers(body.answers, toPlain(attempt.testSnapshot).questions as never) as never;
    await attempt.save();
  }
  const finalAttempt = await persistAttemptResult(attempt, late ? "auto" : "manual");

  if (!getTestFromAssignment(assignment).showResultImmediately) {
    return res.json({ submitted: true, visible: false });
  }

  res.json({ submitted: true, visible: true, result: finalAttempt.result });
});

export const getPublicAttemptResult = asyncHandler(async (req, res) => {
  const assignment = await getAssignmentForToken((req.params as { shareToken: string }).shareToken);
  const attempt: any = await TestAttempt.findOne({ assignment: assignment.id, result: { $ne: null } }).sort({ createdAt: -1 });
  if (!attempt || !attempt.result) throw ApiError.notFound("Result not found");

  const test = getTestFromAssignment(assignment);
  if (!test.showResultImmediately) {
    return res.json({ submitted: true, visible: false });
  }

  res.json({ submitted: true, visible: true, result: attempt.result });
});

export const listAttempts = asyncHandler(async (req, res) => {
  const { test, course, student, status, passed, page = 1, limit = 20 } = req.query as unknown as {
    test?: string;
    course?: string;
    student?: string;
    status?: string;
    passed?: boolean;
    page?: number;
    limit?: number;
  };
  const filter: Record<string, unknown> = {};
  if (test) filter.test = test;
  if (course) filter.course = course;
  if (student) filter.student = student;
  if (status) filter.status = status;
  if (passed !== undefined) filter["result.passed"] = passed;

  const [items, total] = await Promise.all([
    TestAttempt.find(filter)
      .populate("test", "title course")
      .populate("course", "title")
      .populate("student", "firstName lastName email phone")
      .populate("assignment", "shareToken attemptsAllowed status")
      .sort({ createdAt: -1, _id: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit)),
    TestAttempt.countDocuments(filter),
  ]);

  res.json({ items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) });
});

export const getAttempt = asyncHandler(async (req, res) => {
  const attempt = await TestAttempt.findById(req.params.id)
    .populate("test", "title course")
    .populate("course", "title")
    .populate("student", "firstName lastName email phone")
    .populate("assignment", "shareToken attemptsAllowed status availabilityStart availabilityEnd");
  if (!attempt) throw ApiError.notFound("Attempt not found");
  res.json(attempt);
});
