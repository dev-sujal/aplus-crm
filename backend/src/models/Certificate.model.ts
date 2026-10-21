import { Schema, model, Types, type InferSchemaType } from "mongoose";

const certificateSchema = new Schema(
  {
    enrollment: { type: Types.ObjectId, ref: "Enrollment", required: true, unique: true },
    credentialId: { type: String, required: true, unique: true, index: true },
    // Name printed on the certificate. Defaults to the student's full name at issue
    // time but can be overridden; certificates issued before this field existed have
    // it empty and fall back to the student's current name.
    studentName: { type: String, trim: true, default: "" },
    issueDate: { type: Date, default: () => new Date() },
    completionDate: { type: Date, default: null },
    issuedBy: { type: Types.ObjectId, ref: "User", required: true },
    issuerName: { type: String, default: "" },
    templateId: { type: String, default: "classic" },
  },
  { timestamps: true }
);

export type CertificateDoc = InferSchemaType<typeof certificateSchema>;

export const Certificate = model("Certificate", certificateSchema);
