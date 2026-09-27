import { z } from "zod";

export const attendanceStatusEnum = z.enum(["present", "absent", "late"]);

const objectIdString = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid id format");

export const markAttendanceSchema = z.object({
  course: objectIdString,
  date: z.string().min(1),
  records: z
    .array(
      z.object({
        enrollment: objectIdString,
        status: attendanceStatusEnum,
      })
    )
    .min(1, "At least one attendance record is required"),
});
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;

export const listAttendanceQuerySchema = z
  .object({
    course: objectIdString.optional(),
    date: z.string().optional(),
    enrollment: objectIdString.optional(),
    student: objectIdString.optional(),
  })
  .refine(
    (q) => (q.course && q.date) || q.enrollment || q.student,
    "Provide either (course & date), an enrollment id, or a student id"
  );
export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>;
