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

export const createCertificateSchema = z.object({
  enrollment: objectIdString,
  completionDate: dateLike,
  issuerName: z.string().optional().default(""),
  templateId: z.string().optional().default("classic"),
});
export type CreateCertificateInput = z.infer<typeof createCertificateSchema>;

export const studentCertificatesParamSchema = z.object({
  studentId: objectIdString,
});
