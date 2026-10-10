import { Schema, model, Types, type InferSchemaType } from "mongoose";

const questionOptionSchema = new Schema(
  {
    id: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const questionSchema = new Schema(
  {
    course: { type: Types.ObjectId, ref: "Course", required: true, index: true },
    type: { type: String, enum: ["single", "multiple"], required: true },
    text: { type: String, required: true, trim: true },
    options: {
      type: [questionOptionSchema],
      default: [],
      validate: {
        validator: (value: unknown[]) => Array.isArray(value) && value.length >= 2 && value.length <= 6,
        message: "Questions must have between 2 and 6 options",
      },
    },
    correctOptionIds: { type: [String], default: [] },
    marks: { type: Number, required: true, min: 1, default: 1 },
    explanation: { type: String, default: "" },
    topic: { type: String, trim: true, default: "" },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    archivedAt: { type: Date, default: null },
    createdBy: { type: Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

questionSchema.index({ course: 1, status: 1, topic: 1, difficulty: 1, type: 1 });
questionSchema.index({ text: "text", topic: "text", explanation: "text" });

export type QuestionDoc = InferSchemaType<typeof questionSchema>;

export const Question = model("Question", questionSchema);
