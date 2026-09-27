import { z } from "zod";

const dateLike = z
  .union([z.string(), z.date()])
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), "Invalid date")
  .nullable()
  .optional();

export const createCourseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().default(""),
  durationWeeks: z.number().min(0).nullable().optional(),
  fee: z.number().min(0, "Fee must be 0 or more"),
  startDate: dateLike,
  endDate: dateLike,
  category: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
  status: z.enum(["active", "inactive"]).optional().default("active"),
  maxSeats: z.number().min(0).nullable().optional(),
  instructorName: z.string().optional().default(""),
});
export type CreateCourseInput = z.infer<typeof createCourseSchema>;

export const updateCourseSchema = createCourseSchema.partial();
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

export const listCoursesQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  category: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});
export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;
