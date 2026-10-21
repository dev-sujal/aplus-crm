import { Router } from "express";
import { authenticate, requirePermission, requireRole } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  createCourseSchema,
  listCoursesQuerySchema,
  updateCourseSchema,
} from "../validators/course.validator.js";
import {
  createCourse,
  deleteCourse,
  getCourse,
  listCourses,
  updateCourse,
} from "../controllers/courses.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("courses", "view"), validate(listCoursesQuerySchema, "query"), listCourses);
router.get("/:id", requirePermission("courses", "view"), getCourse);
router.post("/", requireRole("owner"), validate(createCourseSchema), createCourse);
router.patch(
  "/:id",
  requirePermission("courses", "edit"),
  validate(updateCourseSchema),
  updateCourse
);
router.delete("/:id", requireRole("owner"), deleteCourse);

export default router;
