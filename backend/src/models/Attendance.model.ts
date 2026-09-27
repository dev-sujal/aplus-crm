import { Schema, model, Types, type InferSchemaType } from "mongoose";

const attendanceSchema = new Schema(
  {
    enrollment: { type: Types.ObjectId, ref: "Enrollment", required: true, index: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["present", "absent", "late"], required: true },
    markedBy: { type: Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// One attendance record per enrollment per calendar day.
attendanceSchema.index({ enrollment: 1, date: 1 }, { unique: true });

export type AttendanceDoc = InferSchemaType<typeof attendanceSchema>;

export const Attendance = model("Attendance", attendanceSchema);
