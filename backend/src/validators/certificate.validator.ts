import { z } from "zod";

const objectIdString = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid id format");

const dateLike = z
  .union([z.string(), z.date()])
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), "Invalid date")
  .nullable()
  .optional();

const requiredDate = z
  .union([z.string(), z.date()])
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), "Invalid date");

export const createCertificateSchema = z.object({
  enrollment: objectIdString,
  credentialId: z.string().trim().optional().default(""),
  studentName: z.string().trim().max(120, "Name is too long").optional().default(""),
  issueDate: dateLike,
  completionDate: dateLike,
  issuerName: z.string().optional().default(""),
  templateId: z.string().optional().default("classic"),
});
export type CreateCertificateInput = z.infer<typeof createCertificateSchema>;

export const updateCertificateSchema = z
  .object({
    studentName: z.string().trim().min(1, "Name cannot be empty").max(120, "Name is too long").optional(),
    issueDate: requiredDate.optional(),
    completionDate: dateLike,
    issuerName: z.string().trim().max(120, "Issuer name is too long").optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Provide at least one field to update");
export type UpdateCertificateInput = z.infer<typeof updateCertificateSchema>;

export const certificateCredentialParamSchema = z.object({
  credentialId: z.string().trim().min(1, "Credential ID is required"),
});

export const studentCertificatesParamSchema = z.object({
  studentId: objectIdString,
});
