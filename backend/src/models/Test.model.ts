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

const testQuestionSchema = new Schema(
  {
    questionId: { type: Types.ObjectId, ref: "Question", required: true },
    snapshot: { type: questionSnapshotSchema, required: true },
    order: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const testSchema = new Schema(
  {
    course: { type: Types.ObjectId, ref: "Course", required: true, index: true },
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
    status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
    publishedAt: { type: Date, default: null },
    questions: { type: [testQuestionSchema], default: [] },
    createdBy: { type: Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

testSchema.index({ course: 1, status: 1, title: 1 });

export type TestDoc = InferSchemaType<typeof testSchema>;

export const Test = model("Test", testSchema);
