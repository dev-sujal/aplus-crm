import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  changePasswordSchema,
  createAdminSchema,
  updatePermissionsSchema,
  updateUserStatusSchema,
} from "../validators/auth.validator.js";
import {
  changeOwnPassword,
  createAdmin,
  deleteAdmin,
  listUsers,
  resetAdminPassword,
  revealPassword,
  updatePermissions,
  updateStatus,
} from "../controllers/users.controller.js";
import { resetPasswordSchema } from "../validators/auth.validator.js";

const router = Router();

router.use(authenticate);

router.post("/change-password", validate(changePasswordSchema), changeOwnPassword);

router.get("/", requireRole("owner"), listUsers);
router.post("/", requireRole("owner"), validate(createAdminSchema), createAdmin);
router.patch(
  "/:id/permissions",
  requireRole("owner"),
  validate(updatePermissionsSchema),
  updatePermissions
);
router.patch("/:id/status", requireRole("owner"), validate(updateUserStatusSchema), updateStatus);
router.get("/:id/password", requireRole("owner"), revealPassword);
router.patch("/:id/password", requireRole("owner"), validate(resetPasswordSchema), resetAdminPassword);
router.delete("/:id", requireRole("owner"), deleteAdmin);

export default router;
