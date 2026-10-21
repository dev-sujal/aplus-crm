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

/**
 * Aadhaar numbers are 12 digits and are often typed or pasted as "1234 5678 9012"
 * or "1234-5678-9012". Spaces/hyphens are stripped so we always store 12 digits.
 */
const aadharNumber = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .refine((value) => value === "" || /^\d{12}$/.test(value), "Aadhaar number must be exactly 12 digits");

export const createStudentSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  fatherName: z.string().optional().default(""),
  photoUrl: z.string().optional().default(""),
  email: z.string().email().optional().or(z.literal("")).default(""),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  dob: dateLike,
  guardianContact: z.string().optional().default(""),
  gender: z.enum(["male", "female", "other", ""]).optional().default(""),
  aadharNumber: aadharNumber.optional().default(""),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

// Explicit (not createStudentSchema.partial()): partial() would still apply the
// create defaults, so a PATCH that omits a field would silently blank it.
export const updateStudentSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  fatherName: z.string().optional(),
  photoUrl: z.string().optional(),
  email: z.string().email().or(z.literal("")).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  dob: dateLike,
  guardianContact: z.string().optional(),
  gender: z.enum(["male", "female", "other", ""]).optional(),
  aadharNumber: aadharNumber.optional(),
});
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export const listStudentsQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;

export const studentIdParamSchema = z.object({
  id: objectIdString,
});

export const createEnrollmentSchema = z.object({
  student: objectIdString,
  course: objectIdString,
  fee: z.coerce.number().min(0, "Fee must be zero or greater").optional(),
  batch: z.string().optional().default(""),
  registrationDate: dateLike,
});
export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;

export const updateEnrollmentSchema = z.object({
  status: z.enum(["ongoing", "completed", "dropped"]).optional(),
  batch: z.string().optional(),
  fee: z.number({ error: "Fee must be a number" }).finite().min(0, "Fee must be zero or greater").optional(),
});
export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>;

export const listEnrollmentsQuerySchema = z.object({
  student: objectIdString.optional(),
  course: objectIdString.optional(),
});
export type ListEnrollmentsQuery = z.infer<typeof listEnrollmentsQuerySchema>;
