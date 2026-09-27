import { Attendance } from "../models/Attendance.model.js";
import { Enrollment } from "../models/Enrollment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { toDayStart } from "../utils/date.js";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import type {
  ListAttendanceQuery,
  MarkAttendanceInput,
} from "../validators/attendance.validator.js";

function summarize(records: { status: "present" | "absent" | "late" }[]) {
  const total = records.length;
  const present = records.filter((r) => r.status === "present").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const late = records.filter((r) => r.status === "late").length;
  const percentage = total === 0 ? 0 : Math.round((present / total) * 1000) / 10;
  return { total, present, absent, late, percentage };
}

/** GET /attendance?course=&date= — roster for a course on a given day, with existing marks. */
async function getRosterForCourseDate(courseId: string, dateStr: string) {
  const day = toDayStart(dateStr);

  const enrollments = await Enrollment.find({ course: courseId, status: { $ne: "dropped" } })
    .populate("student", "firstName lastName photoUrl")
    .sort({ createdAt: 1 });

  const enrollmentIds = enrollments.map((e) => e.id);
  const marks = await Attendance.find({ enrollment: { $in: enrollmentIds }, date: day });
  const markByEnrollment = new Map(marks.map((m) => [m.enrollment.toString(), m.status]));

  return enrollments.map((e) => ({
    enrollment: e.id,
    student: e.student,
    status: markByEnrollment.get(e.id) ?? null,
  }));
}

/** GET /attendance?enrollment= — full history + summary for one enrollment. */
async function getEnrollmentHistory(enrollmentId: string) {
  const records = await Attendance.find({ enrollment: enrollmentId }).sort({ date: 1 });
  return { records, summary: summarize(records) };
}

/** GET /attendance?student= — history + summary across all of a student's enrollments. */
async function getStudentHistory(studentId: string) {
  const enrollments = await Enrollment.find({ student: studentId }).populate("course", "title");
  const enrollmentIds = enrollments.map((e) => e.id);
  const records = await Attendance.find({ enrollment: { $in: enrollmentIds } })
    .populate({ path: "enrollment", populate: { path: "course", select: "title" } })
    .sort({ date: -1 });
  return { records, summary: summarize(records) };
}

export const listAttendance = asyncHandler(async (req, res) => {
  const { course, date, enrollment, student } = req.query as unknown as ListAttendanceQuery;

  if (course && date) {
    return res.json({ mode: "roster", roster: await getRosterForCourseDate(course, date) });
  }
  if (enrollment) {
    return res.json({ mode: "enrollment", ...(await getEnrollmentHistory(enrollment)) });
  }
  if (student) {
    return res.json({ mode: "student", ...(await getStudentHistory(student)) });
  }
  throw ApiError.badRequest("Provide either (course & date), an enrollment id, or a student id");
});

export const markAttendance = asyncHandler(async (req: AuthedRequest, res) => {
  const { date, records } = req.body as MarkAttendanceInput;
  const day = toDayStart(date);

  const results = await Promise.all(
    records.map((r) =>
      Attendance.findOneAndUpdate(
        { enrollment: r.enrollment, date: day },
        { status: r.status, markedBy: req.user!.id },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    )
  );

  res.json({ marked: results.length, records: results });
});
