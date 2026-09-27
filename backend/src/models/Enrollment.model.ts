import { Schema, model, Types, type InferSchemaType } from "mongoose";

const enrollmentSchema = new Schema(
  {
    student: { type: Types.ObjectId, ref: "Student", required: true, index: true },
    course: { type: Types.ObjectId, ref: "Course", required: true, index: true },
    registrationDate: { type: Date, default: () => new Date() },
    batch: { type: String, default: "" },
    status: { type: String, enum: ["ongoing", "completed", "dropped"], default: "ongoing" },
    createdBy: { type: Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

export type EnrollmentDoc = InferSchemaType<typeof enrollmentSchema>;

export const Enrollment = model("Enrollment", enrollmentSchema);
