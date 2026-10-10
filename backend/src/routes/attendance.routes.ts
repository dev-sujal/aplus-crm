import { Router } from "express";
import { authenticate, requirePermission } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { listAttendanceQuerySchema, markAttendanceSchema } from "../validators/attendance.validator.js";
import { listAttendance, markAttendance } from "../controllers/attendance.controller.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  requirePermission("attendance", "view"),
  validate(listAttendanceQuerySchema, "query"),
  listAttendance
);
router.post(
  "/",
  requirePermission("attendance", "edit"),
  validate(markAttendanceSchema),
  markAttendance
);

export default router;
