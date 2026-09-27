import { Router } from "express";
import { authenticate, requirePermission } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  createEnrollmentSchema,
  listEnrollmentsQuerySchema,
  updateEnrollmentSchema,
} from "../validators/student.validator.js";
import {
  createEnrollment,
  deleteEnrollment,
  listEnrollments,
  updateEnrollment,
} from "../controllers/enrollments.controller.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  requirePermission("students", "view"),
  validate(listEnrollmentsQuerySchema, "query"),
  listEnrollments
);
router.post("/", requirePermission("students", "edit"), validate(createEnrollmentSchema), createEnrollment);
router.patch("/:id", requirePermission("students", "edit"), validate(updateEnrollmentSchema), updateEnrollment);
router.delete("/:id", requirePermission("students", "edit"), deleteEnrollment);

export default router;
