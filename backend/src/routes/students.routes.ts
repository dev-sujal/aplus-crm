import { Router } from "express";
import { authenticate, requirePermission, requireRole } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  createStudentSchema,
  listStudentsQuerySchema,
  studentIdParamSchema,
  updateStudentSchema,
} from "../validators/student.validator.js";
import {
  createStudent,
  deleteStudent,
  getStudent,
  listStudents,
  updateStudent,
} from "../controllers/students.controller.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  requirePermission("students", "view"),
  validate(listStudentsQuerySchema, "query"),
  listStudents
);
router.get("/:id", requirePermission("students", "view"), validate(studentIdParamSchema, "params"), getStudent);
router.post("/", requireRole("owner"), validate(createStudentSchema), createStudent);
router.patch("/:id", requireRole("owner"), validate(studentIdParamSchema, "params"), validate(updateStudentSchema), updateStudent);
router.delete("/:id", requireRole("owner"), validate(studentIdParamSchema, "params"), deleteStudent);

export default router;
