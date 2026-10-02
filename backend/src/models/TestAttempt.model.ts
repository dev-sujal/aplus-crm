import { Schema, model, Types, type InferSchemaType } from "mongoose";

const questionOptionSnapshotSchema = new Schema(
  {
    id: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const questionSnapshotSchema = new Schema(
  {
    type: { type: String, enum: ["single", "multiple"], required: true },
    text: { type: String, required: true, trim: true },
    options: { type: [questionOptionSnapshotSchema], default: [] },
    correctOptionIds: { type: [String], default: [] },
    marks: { type: Number, required: true, min: 1, default: 1 },
    explanation: { type: String, default: "" },
    topic: { type: String, trim: true, default: "" },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
  },
  { _id: false }
);

const attemptQuestionSchema = new Schema(
  {
    questionId: { type: Types.ObjectId, ref: "Question", required: true },
    snapshot: { type: questionSnapshotSchema, required: true },
    order: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const selectedOptionOrderSchema = new Schema(
  {
    questionId: { type: Types.ObjectId, ref: "Question", required: true },
    optionIds: { type: [String], default: [] },
  },
  { _id: false }
);

const testSnapshotSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    instructions: { type: String, default: "" },
    timeLimitMinutes: { type: Number, required: true, min: 1, default: 30 },
    passPercentage: { type: Number, required: true, min: 0, max: 100, default: 40 },
    multiAnswerScoring: { type: String, enum: ["all_correct", "partial"], default: "partial" },
    negativeMarking: { type: Boolean, default: false },
    negativeMarkingRate: { type: Number, min: 0, default: 0.25 },
    shuffleQuestions: { type: Boolean, default: false },
    shuffleOptions: { type: Boolean, default: false },
    showResultImmediately: { type: Boolean, default: true },
    questions: { type: [attemptQuestionSchema], default: [] },
  },
  { _id: false }
);

const answerSchema = new Schema(
  {
    questionId: { type: Types.ObjectId, ref: "Question", required: true },
    selectedOptionIds: { type: [String], default: [] },
    markedForReview: { type: Boolean, default: false },
    answeredAt: { type: Date, default: null },
  },
  { _id: false }
);

const questionResultSchema = new Schema(
  {
    questionId: { type: Types.ObjectId, ref: "Question", required: true },
    selectedOptionIds: { type: [String], default: [] },
    correctOptionIds: { type: [String], default: [] },
    isCorrect: { type: Boolean, default: false },
    isPartiallyCorrect: { type: Boolean, default: false },
    isUnanswered: { type: Boolean, default: false },
    marksAwarded: { type: Number, required: true, default: 0 },
    maxMarks: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const topicPerformanceSchema = new Schema(
  {
    topic: { type: String, required: true, default: "Uncategorized" },
    questionCount: { type: Number, required: true, default: 0 },
    correctCount: { type: Number, required: true, default: 0 },
    wrongCount: { type: Number, required: true, default: 0 },
    partiallyCorrectCount: { type: Number, required: true, default: 0 },
    unansweredCount: { type: Number, required: true, default: 0 },
    marksAwarded: { type: Number, required: true, default: 0 },
    maxMarks: { type: Number, required: true, default: 0 },
    percentage: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const attemptResultSchema = new Schema(
  {
    score: { type: Number, required: true, default: 0 },
    totalMarks: { type: Number, required: true, default: 0 },
    percentage: { type: Number, required: true, default: 0 },
    passed: { type: Boolean, required: true, default: false },
    correctCount: { type: Number, required: true, default: 0 },
    wrongCount: { type: Number, required: true, default: 0 },
    partiallyCorrectCount: { type: Number, required: true, default: 0 },
    unansweredCount: { type: Number, required: true, default: 0 },
    timeTakenSeconds: { type: Number, required: true, default: 0 },
    submissionMode: { type: String, enum: ["manual", "auto"], required: true, default: "manual" },
    questionResults: { type: [questionResultSchema], default: [] },
    topicPerformance: { type: [topicPerformanceSchema], default: [] },
  },
  { _id: false }
);

const testAttemptSchema = new Schema(
  {
    assignment: { type: Types.ObjectId, ref: "TestAssignment", required: true, index: true },
    test: { type: Types.ObjectId, ref: "Test", required: true, index: true },
    course: { type: Types.ObjectId, ref: "Course", required: true, index: true },
    student: { type: Types.ObjectId, ref: "Student", required: true, index: true },
    attemptNumber: { type: Number, required: true, min: 1, default: 1 },
    status: { type: String, enum: ["in_progress", "submitted", "auto_submitted", "expired"], default: "in_progress" },
    startedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    lastSavedAt: { type: Date, default: null },
    currentQuestionIndex: { type: Number, default: 0, min: 0 },
    testSnapshot: { type: testSnapshotSchema, required: true },
    answers: { type: [answerSchema], default: [] },
    presentation: {
      questionOrder: { type: [String], default: [] },
      optionOrder: { type: [selectedOptionOrderSchema], default: [] },
    },
    result: { type: attemptResultSchema, default: null },
  },
  { timestamps: true }
);

testAttemptSchema.index({ assignment: 1, attemptNumber: 1 }, { unique: true });
testAttemptSchema.index({ student: 1, test: 1, status: 1 });

export type TestAttemptDoc = InferSchemaType<typeof testAttemptSchema>;

export const TestAttempt = model("TestAttempt", testAttemptSchema);
