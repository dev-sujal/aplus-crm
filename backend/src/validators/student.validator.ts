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

export const createStudentSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  photoUrl: z.string().optional().default(""),
  email: z.string().email().optional().or(z.literal("")).default(""),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  dob: dateLike,
  guardianContact: z.string().optional().default(""),
  gender: z.enum(["male", "female", "other", ""]).optional().default(""),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = createStudentSchema.partial();
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
  batch: z.string().optional().default(""),
  registrationDate: dateLike,
});
export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;

export const updateEnrollmentSchema = z.object({
  status: z.enum(["ongoing", "completed", "dropped"]).optional(),
  batch: z.string().optional(),
});
export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>;

export const listEnrollmentsQuerySchema = z.object({
  student: objectIdString.optional(),
  course: objectIdString.optional(),
});
export type ListEnrollmentsQuery = z.infer<typeof listEnrollmentsQuerySchema>;
