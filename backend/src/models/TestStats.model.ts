import { Schema, model, Types, type InferSchemaType } from "mongoose";

const scoreBucketSchema = new Schema(
  {
    label: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const questionStatsSchema = new Schema(
  {
    questionId: { type: Types.ObjectId, ref: "Question", required: true },
    correctCount: { type: Number, required: true, default: 0 },
    wrongCount: { type: Number, required: true, default: 0 },
    partiallyCorrectCount: { type: Number, required: true, default: 0 },
    unansweredCount: { type: Number, required: true, default: 0 },
    wrongOptionCounts: {
      type: [
        new Schema(
          {
            optionId: { type: String, required: true },
            count: { type: Number, required: true, default: 0 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    mostChosenWrongOptionId: { type: String, default: "" },
    mostChosenWrongOptionText: { type: String, default: "" },
  },
  { _id: false }
);

const topicStatsSchema = new Schema(
  {
    topic: { type: String, required: true },
    attemptCount: { type: Number, required: true, default: 0 },
    averagePercentage: { type: Number, required: true, default: 0 },
    strongCount: { type: Number, required: true, default: 0 },
    weakCount: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const testStatsSchema = new Schema(
  {
    test: { type: Types.ObjectId, ref: "Test", required: true, unique: true, index: true },
    course: { type: Types.ObjectId, ref: "Course", required: true, index: true },
    attemptsCount: { type: Number, required: true, default: 0 },
    averageScore: { type: Number, required: true, default: 0 },
    highestScore: { type: Number, required: true, default: 0 },
    lowestScore: { type: Number, required: true, default: 0 },
    passedCount: { type: Number, required: true, default: 0 },
    failedCount: { type: Number, required: true, default: 0 },
    passRate: { type: Number, required: true, default: 0 },
    scoreDistribution: { type: [scoreBucketSchema], default: [] },
    questionStats: { type: [questionStatsSchema], default: [] },
    topicStats: { type: [topicStatsSchema], default: [] },
    updatedAtSummary: { type: Date, default: null },
  },
  { timestamps: true }
);

export type TestStatsDoc = InferSchemaType<typeof testStatsSchema>;

export const TestStats = model("TestStats", testStatsSchema);
