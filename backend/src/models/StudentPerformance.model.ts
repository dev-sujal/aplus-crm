import { Schema, model, Types, type InferSchemaType } from "mongoose";

const scoreTrendSchema = new Schema(
  {
    attempt: { type: Types.ObjectId, ref: "TestAttempt", required: true },
    test: { type: Types.ObjectId, ref: "Test", required: true },
    title: { type: String, required: true, trim: true },
    score: { type: Number, required: true, default: 0 },
    percentage: { type: Number, required: true, default: 0 },
    takenAt: { type: Date, required: true },
    passed: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

const topicPerformanceSchema = new Schema(
  {
    topic: { type: String, required: true },
    averagePercentage: { type: Number, required: true, default: 0 },
    attemptsCount: { type: Number, required: true, default: 0 },
    weakCount: { type: Number, required: true, default: 0 },
    strongCount: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const studentPerformanceSchema = new Schema(
  {
    student: { type: Types.ObjectId, ref: "Student", required: true, unique: true, index: true },
    testsTaken: { type: Number, required: true, default: 0 },
    averagePercentage: { type: Number, required: true, default: 0 },
    bestPercentage: { type: Number, required: true, default: 0 },
    latestPercentage: { type: Number, required: true, default: 0 },
    passedCount: { type: Number, required: true, default: 0 },
    failedCount: { type: Number, required: true, default: 0 },
    scoreTrend: { type: [scoreTrendSchema], default: [] },
    weakTopics: { type: [topicPerformanceSchema], default: [] },
    strongTopics: { type: [topicPerformanceSchema], default: [] },
    updatedAtSummary: { type: Date, default: null },
  },
  { timestamps: true }
);

export type StudentPerformanceDoc = InferSchemaType<typeof studentPerformanceSchema>;

export const StudentPerformance = model("StudentPerformance", studentPerformanceSchema);
