import { Schema, model, Types, type InferSchemaType } from "mongoose";

const courseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    durationWeeks: { type: Number, min: 0, default: null },
    fee: { type: Number, required: true, min: 0 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    category: { type: String, trim: true, default: "" },
    tags: { type: [String], default: [] },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    maxSeats: { type: Number, min: 0, default: null },
    instructorName: { type: String, trim: true, default: "" },
    createdBy: { type: Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

courseSchema.index({ title: "text", description: "text", category: "text" });
courseSchema.index({ status: 1, category: 1 });

export type CourseDoc = InferSchemaType<typeof courseSchema>;

export const Course = model("Course", courseSchema);
