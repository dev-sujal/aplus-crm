import { Router } from "express";
import { verifyCertificate } from "../controllers/certificates.controller.js";

const router = Router();

router.get("/:credentialId", verifyCertificate);

export default router;
