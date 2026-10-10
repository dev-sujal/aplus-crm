import { Schema, model, Types, type InferSchemaType } from "mongoose";

const testAssignmentSchema = new Schema(
  {
    test: { type: Types.ObjectId, ref: "Test", required: true, index: true },
    course: { type: Types.ObjectId, ref: "Course", required: true, index: true },
    student: { type: Types.ObjectId, ref: "Student", required: true, index: true },
    shareToken: { type: String, required: true, unique: true, index: true },
    availabilityStart: { type: Date, default: null },
    availabilityEnd: { type: Date, default: null },
    attemptsAllowed: { type: Number, min: 1, default: 1 },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "submitted", "expired", "revoked"],
      default: "not_started",
    },
    revokedAt: { type: Date, default: null },
    latestAttemptId: { type: Types.ObjectId, ref: "TestAttempt", default: null },
    lastAttemptAt: { type: Date, default: null },
    assignedBy: { type: Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

testAssignmentSchema.index({ test: 1, student: 1 }, { unique: true });
testAssignmentSchema.index({ course: 1, student: 1, status: 1 });

export type TestAssignmentDoc = InferSchemaType<typeof testAssignmentSchema>;

export const TestAssignment = model("TestAssignment", testAssignmentSchema);
