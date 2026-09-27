import { Router } from "express";
import { authenticate, requirePermission } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { createCertificateSchema, studentCertificatesParamSchema } from "../validators/certificate.validator.js";
import {
  createCertificate,
  downloadCertificate,
  getCertificateInternal,
  listCertificatesForStudent,
} from "../controllers/certificates.controller.js";

const router = Router();

// Public — printed on the certificate as a QR code / download link, no login required.
router.get("/:credentialId/download", downloadCertificate);

// Internal — requires auth from here down.
router.use(authenticate);
router.post("/", requirePermission("certificates", "edit"), validate(createCertificateSchema), createCertificate);
router.get(
  "/student/:studentId",
  requirePermission("certificates", "view"),
  validate(studentCertificatesParamSchema, "params"),
  listCertificatesForStudent
);
router.get("/:credentialId", requirePermission("certificates", "view"), getCertificateInternal);

export default router;
