import { Schema, model, type InferSchemaType } from "mongoose";

const studentSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    photoUrl: { type: String, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, default: "" },
    dob: { type: Date, default: null },
    guardianContact: { type: String, default: "" },
    gender: { type: String, enum: ["male", "female", "other", ""], default: "" },
  },
  { timestamps: true }
);

studentSchema.index({ firstName: "text", lastName: "text", email: "text", phone: "text" });

export type StudentDoc = InferSchemaType<typeof studentSchema>;

export const Student = model("Student", studentSchema);
