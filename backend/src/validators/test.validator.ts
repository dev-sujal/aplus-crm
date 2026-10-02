import { z } from "zod";
import {
  QUESTION_DIFFICULTIES,
  QUESTION_TYPES,
  MULTI_ANSWER_SCORING,
  TEST_STATUSES,
  ATTEMPT_STATUSES,
} from "../types/tests.js";

const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id format");

const questionOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

function questionRefine(data: {
  type?: string | undefined;
  options?: { id: string; text: string }[] | undefined;
  correctOptionIds?: string[] | undefined;
}) {
  return (ctx: z.RefinementCtx) => {
    if (!data.type || !data.options || !data.correctOptionIds) return;

    const optionIds = new Set(data.options.map((option) => option.id));
    for (const id of data.correctOptionIds) {
      if (!optionIds.has(id)) {
        ctx.addIssue({ code: "custom", message: `Unknown correct option id: ${id}`, path: ["correctOptionIds"] });
      }
    }
    if (data.type === "single" && data.correctOptionIds.length !== 1) {
      ctx.addIssue({ code: "custom", message: "Single answer questions must have exactly one correct option", path: ["correctOptionIds"] });
    }
    if (data.type === "multiple" && data.correctOptionIds.length < 1) {
      ctx.addIssue({ code: "custom", message: "Multiple answer questions must have at least one correct option", path: ["correctOptionIds"] });
    }
  };
}

export const createQuestionSchema = z
  .object({
    course: objectIdString,
    type: z.enum(QUESTION_TYPES),
    text: z.string().min(1),
    options: z.array(questionOptionSchema).min(2).max(6),
    correctOptionIds: z.array(z.string().min(1)).min(1),
    marks: z.coerce.number().min(1).default(1),
    explanation: z.string().optional().default(""),
    topic: z.string().optional().default(""),
    difficulty: z.enum(QUESTION_DIFFICULTIES).optional().default("medium"),
  })
  .superRefine((data, ctx) => questionRefine(data)(ctx));
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

const updateQuestionBaseSchema = z.object({
  course: objectIdString.optional(),
  type: z.enum(QUESTION_TYPES).optional(),
  text: z.string().min(1).optional(),
  options: z.array(questionOptionSchema).min(2).max(6).optional(),
  correctOptionIds: z.array(z.string().min(1)).min(1).optional(),
  marks: z.coerce.number().min(1).optional(),
  explanation: z.string().optional(),
  topic: z.string().optional(),
  difficulty: z.enum(QUESTION_DIFFICULTIES).optional(),
});

export const updateQuestionSchema = updateQuestionBaseSchema.superRefine((data, ctx) => {
  if (!data.type || !data.options || !data.correctOptionIds) return;
  questionRefine(data)(ctx);
});
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;

export const listQuestionsQuerySchema = z.object({
  course: objectIdString.optional(),
  type: z.enum(QUESTION_TYPES).optional(),
  topic: z.string().optional(),
  difficulty: z.enum(QUESTION_DIFFICULTIES).optional(),
  status: z.enum(["active", "archived"]).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});
export type ListQuestionsQuery = z.infer<typeof listQuestionsQuerySchema>;

export const questionIdParamSchema = z.object({ id: objectIdString });

export const createTestSchema = z.object({
  course: objectIdString,
  title: z.string().min(1),
  instructions: z.string().optional().default(""),
  timeLimitMinutes: z.coerce.number().min(1).default(30),
  passPercentage: z.coerce.number().min(0).max(100).default(40),
  multiAnswerScoring: z.enum(MULTI_ANSWER_SCORING).default("partial"),
  negativeMarking: z.coerce.boolean().default(false),
  negativeMarkingRate: z.coerce.number().min(0).default(0.25),
  shuffleQuestions: z.coerce.boolean().default(false),
  shuffleOptions: z.coerce.boolean().default(false),
  showResultImmediately: z.coerce.boolean().default(true),
  status: z.enum(TEST_STATUSES).optional().default("draft"),
  questionIds: z.array(objectIdString).default([]),
});
export type CreateTestInput = z.infer<typeof createTestSchema>;

export const updateTestSchema = createTestSchema.partial();
export type UpdateTestInput = z.infer<typeof updateTestSchema>;
export const testIdParamSchema = z.object({ id: objectIdString });

export const listTestsQuerySchema = z.object({
  course: objectIdString.optional(),
  status: z.enum(TEST_STATUSES).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});
export type ListTestsQuery = z.infer<typeof listTestsQuerySchema>;

export const assignTestSchema = z.object({
  studentIds: z.array(objectIdString).min(1),
  availabilityStart: z.string().optional().nullable(),
  availabilityEnd: z.string().optional().nullable(),
  attemptsAllowed: z.coerce.number().min(1).default(1),
});
export type AssignTestInput = z.infer<typeof assignTestSchema>;

export const assignmentIdParamSchema = z.object({ id: objectIdString });

export const assignmentTokenParamSchema = z.object({ shareToken: z.string().min(1) });

export const saveProgressSchema = z.object({
  currentQuestionIndex: z.coerce.number().min(0).optional(),
  answers: z.array(
    z.object({
      questionId: objectIdString,
      selectedOptionIds: z.array(z.string()).default([]),
      markedForReview: z.boolean().optional().default(false),
    })
  ),
});
export type SaveProgressInput = z.infer<typeof saveProgressSchema>;

export const submitAttemptSchema = z.object({
  answers: saveProgressSchema.shape.answers.optional(),
});
export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;

export const listAttemptsQuerySchema = z.object({
  test: objectIdString.optional(),
  course: objectIdString.optional(),
  student: objectIdString.optional(),
  status: z.enum(ATTEMPT_STATUSES).optional(),
  passed: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});
export type ListAttemptsQuery = z.infer<typeof listAttemptsQuerySchema>;

export const attemptIdParamSchema = z.object({ id: objectIdString });
