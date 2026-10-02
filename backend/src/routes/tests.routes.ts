import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  assignmentIdParamSchema,
  assignmentTokenParamSchema,
  assignTestSchema,
  attemptIdParamSchema,
  createQuestionSchema,
  createTestSchema,
  listAttemptsQuerySchema,
  listQuestionsQuerySchema,
  listTestsQuerySchema,
  questionIdParamSchema,
  saveProgressSchema,
  submitAttemptSchema,
  testIdParamSchema,
  updateQuestionSchema,
  updateTestSchema,
} from "../validators/test.validator.js";
import {
  archiveQuestion,
  createQuestion,
  deleteQuestion,
  getQuestion,
  listQuestions,
  updateQuestion,
} from "../controllers/questions.controller.js";
import {
  archiveTest,
  createTest,
  getTest,
  listTests,
  publishTest,
  updateTest,
} from "../controllers/tests.controller.js";
import {
  allowRetake,
  assignTestToStudents,
  getPublicAssignment,
  listAssignments,
  revokeAssignment,
} from "../controllers/assignments.controller.js";
import {
  getAttempt,
  getPublicAttemptResult,
  listAttempts,
  saveAttemptProgress,
  startAttempt,
  submitAttempt,
} from "../controllers/attempts.controller.js";
import {
  getAnalyticsOverview,
  getLeaderboard,
  getTestAnalytics,
  listCourseComparison,
} from "../controllers/analytics.controller.js";

const router = Router();

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get(
  "/share/:shareToken",
  publicLimiter,
  validate(assignmentTokenParamSchema, "params"),
  getPublicAssignment
);
router.post(
  "/share/:shareToken/start",
  publicLimiter,
  validate(assignmentTokenParamSchema, "params"),
  startAttempt
);
router.patch(
  "/share/:shareToken/progress",
  publicLimiter,
  validate(assignmentTokenParamSchema, "params"),
  validate(saveProgressSchema),
  saveAttemptProgress
);
router.post(
  "/share/:shareToken/submit",
  publicLimiter,
  validate(assignmentTokenParamSchema, "params"),
  validate(submitAttemptSchema),
  submitAttempt
);
router.get(
  "/share/:shareToken/result",
  publicLimiter,
  validate(assignmentTokenParamSchema, "params"),
  getPublicAttemptResult
);

router.use(authenticate, requireRole("owner"));

router.get("/questions", validate(listQuestionsQuerySchema, "query"), listQuestions);
router.post("/questions", validate(createQuestionSchema), createQuestion);
router.get("/questions/:id", validate(questionIdParamSchema, "params"), getQuestion);
router.patch("/questions/:id", validate(questionIdParamSchema, "params"), validate(updateQuestionSchema), updateQuestion);
router.post("/questions/:id/archive", validate(questionIdParamSchema, "params"), archiveQuestion);
router.delete("/questions/:id", validate(questionIdParamSchema, "params"), deleteQuestion);

router.get("/", validate(listTestsQuerySchema, "query"), listTests);
router.post("/", validate(createTestSchema), createTest);
router.get("/assignments", listAssignments);
router.post("/:testId/assignments", validate(assignTestSchema), assignTestToStudents);
router.patch("/assignments/:id/revoke", validate(assignmentIdParamSchema, "params"), revokeAssignment);
router.patch("/assignments/:id/retake", validate(assignmentIdParamSchema, "params"), allowRetake);

router.get("/attempts", validate(listAttemptsQuerySchema, "query"), listAttempts);
router.get("/attempts/:id", validate(attemptIdParamSchema, "params"), getAttempt);

router.get("/analytics/overview", getAnalyticsOverview);
router.get("/analytics/tests/:testId", validate(testIdParamSchema, "params"), getTestAnalytics);
router.get("/analytics/courses", listCourseComparison);
router.get("/analytics/leaderboard", getLeaderboard);

router.get("/:id", validate(testIdParamSchema, "params"), getTest);
router.patch("/:id", validate(testIdParamSchema, "params"), validate(updateTestSchema), updateTest);
router.post("/:id/publish", validate(testIdParamSchema, "params"), publishTest);
router.post("/:id/archive", validate(testIdParamSchema, "params"), archiveTest);

export default router;
