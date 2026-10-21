import { Router } from "express";
import { authenticate, requirePermission } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  certificateCredentialParamSchema,
  createCertificateSchema,
  studentCertificatesParamSchema,
  updateCertificateSchema,
} from "../validators/certificate.validator.js";
import {
  checkCredentialIdAvailability,
  createCertificate,
  downloadCertificate,
  getCertificateInternal,
  listCertificatesForStudent,
  updateCertificate,
} from "../controllers/certificates.controller.js";
import { generateCredentialId } from "../utils/credentialId.js";

const router = Router();

// Public — printed on the certificate as a QR code / download link, no login required.
router.get("/:credentialId/download", downloadCertificate);

// Internal — requires auth from here down.
router.use(authenticate);
router.get("/check-credential-id", requirePermission("certificates", "edit"), checkCredentialIdAvailability);
router.get("/next-credential-id", requirePermission("certificates", "edit"), async (req, res) => {
  const credentialId = await generateCredentialId();
  res.json({ credentialId });
});
router.post("/", requirePermission("certificates", "edit"), validate(createCertificateSchema), createCertificate);
router.get(
  "/student/:studentId",
  requirePermission("certificates", "view"),
  validate(studentCertificatesParamSchema, "params"),
  listCertificatesForStudent
);
router.get("/:credentialId", requirePermission("certificates", "view"), getCertificateInternal);
router.patch(
  "/:credentialId",
  requirePermission("certificates", "edit"),
  validate(certificateCredentialParamSchema, "params"),
  validate(updateCertificateSchema),
  updateCertificate
);

export default router;
