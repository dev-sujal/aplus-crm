import { Certificate } from "../models/Certificate.model.js";
import { Enrollment } from "../models/Enrollment.model.js";
import mongoose from "mongoose";
import { generateCredentialId } from "../utils/credentialId.js";
import { generateCertificatePdf } from "../utils/certificatePdf.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { formatStudentName } from "../utils/name.js";
import { env } from "../config/env.js";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import type { CreateCertificateInput, UpdateCertificateInput } from "../validators/certificate.validator.js";

interface PopulatedStudent {
  firstName?: string | null;
  fatherName?: string | null;
  lastName?: string | null;
}
interface PopulatedCourse {
  title: string;
  description?: string | null;
}
interface PopulatedEnrollment {
  student: PopulatedStudent;
  course: PopulatedCourse;
}

async function findCertificateWithDetails(credentialId: string) {
  const certificate = await Certificate.findOne({ credentialId }).populate({
    path: "enrollment",
    populate: [
      { path: "student", select: "firstName fatherName lastName" },
      { path: "course", select: "title description" },
    ],
  });
  return certificate;
}

/** Name printed on a certificate: the stored (editable) name, else the student's current name. */
function certificateName(certificate: { studentName?: string | null }, student: PopulatedStudent | null | undefined) {
  return certificate.studentName?.trim() || (student ? formatStudentName(student) : "");
}

function verifyUrlFor(credentialId: string) {
  return `${env.publicAppUrl.replace(/\/$/, "")}/verify/${credentialId}`;
}

export const listCertificatesForStudent = asyncHandler(async (req, res) => {
  const studentId = new mongoose.Types.ObjectId(req.params.studentId as string);
  const enrollments = await Enrollment.find({ student: studentId })
    .populate("course", "title description")
    .populate("student", "firstName fatherName lastName");
  const enrollmentIds = enrollments.map((e) => e.id);

  const certificates = await Certificate.find({ enrollment: { $in: enrollmentIds } });
  const certByEnrollment = new Map(certificates.map((c) => [c.enrollment.toString(), c]));

  const rows = enrollments.map((e) => {
    const cert = certByEnrollment.get(e.id);
    const course = e.course as unknown as PopulatedCourse;
    const student = e.student as unknown as PopulatedStudent | null;
    return {
      enrollment: e.id,
      courseName: course?.title ?? "Unknown course",
      enrollmentStatus: e.status,
      certificate: cert
        ? {
            ...cert.toObject(),
            studentName: certificateName(cert, student),
            verifyUrl: verifyUrlFor(cert.credentialId),
          }
        : null,
    };
  });

  res.json(rows);
});

export const checkCredentialIdAvailability = asyncHandler(async (req, res) => {
  const credentialId = String(req.query.credentialId ?? "").trim();

  if (!credentialId) {
    throw ApiError.badRequest("Credential ID is required");
  }

  const exists = await Certificate.exists({ credentialId });
  res.json({
    valid: !exists,
    message: exists
      ? "This credential ID is already in use. Please choose another one."
      : "Credential ID is valid to use.",
  });
});

export const createCertificate = asyncHandler(async (req: AuthedRequest, res) => {
  const body = req.body as CreateCertificateInput;

  const enrollment = await Enrollment.findById(body.enrollment)
    .populate("student", "firstName fatherName lastName")
    .populate("course", "title description");
  if (!enrollment) throw ApiError.notFound("Enrollment not found");
  if (enrollment.status === "dropped") {
    throw ApiError.conflict("Cannot issue a certificate for a dropped enrollment");
  }

  const existing = await Certificate.findOne({ enrollment: enrollment.id });
  if (existing) throw ApiError.conflict("A certificate has already been issued for this enrollment");

  const trimmedCredentialId = body.credentialId?.trim() ?? "";
  const credentialId = trimmedCredentialId || (await generateCredentialId());

  if (await Certificate.exists({ credentialId })) {
    throw ApiError.conflict("This credential ID is already in use. Please choose another one.");
  }

  const issueDate = body.issueDate ? new Date(body.issueDate) : new Date();
  const completionDate = body.completionDate ? new Date(body.completionDate) : null;

  const student = enrollment.student as unknown as PopulatedStudent;
  const course = enrollment.course as unknown as PopulatedCourse;
  // Blank name -> default "firstName fatherName lastName".
  const studentName = body.studentName?.trim() || formatStudentName(student);

  const certificate = await Certificate.create({
    enrollment: enrollment.id,
    credentialId,
    studentName,
    issueDate,
    completionDate,
    issuerName: body.issuerName || "",
    templateId: body.templateId,
    issuedBy: req.user!.id,
  });

  if (enrollment.status !== "completed") {
    enrollment.status = "completed";
    await enrollment.save();
  }

  res.status(201).json({
    ...certificate.toObject(),
    studentName,
    courseName: course.title,
    verifyUrl: verifyUrlFor(credentialId),
  });
});

export const getCertificateInternal = asyncHandler(async (req, res) => {
  const certificate = await findCertificateWithDetails(req.params.credentialId as string);
  if (!certificate) throw ApiError.notFound("Certificate not found");

  const enrollment = certificate.enrollment as unknown as PopulatedEnrollment;
  res.json({
    ...certificate.toObject(),
    studentName: certificateName(certificate, enrollment.student),
    courseName: enrollment.course.title,
    verifyUrl: verifyUrlFor(certificate.credentialId),
  });
});

export const updateCertificate = asyncHandler(async (req, res) => {
  const body = req.body as UpdateCertificateInput;
  const certificate = await findCertificateWithDetails(req.params.credentialId as string);
  if (!certificate) throw ApiError.notFound("Certificate not found");

  const enrollment = certificate.enrollment as unknown as PopulatedEnrollment;

  if (body.studentName !== undefined) certificate.studentName = body.studentName;
  if (body.issueDate) certificate.issueDate = body.issueDate;
  if (body.completionDate !== undefined) certificate.completionDate = body.completionDate;
  if (body.issuerName !== undefined) certificate.issuerName = body.issuerName;
  await certificate.save();

  res.json({
    ...certificate.toObject(),
    studentName: certificateName(certificate, enrollment.student),
    courseName: enrollment.course.title,
    verifyUrl: verifyUrlFor(certificate.credentialId),
  });
});

export const verifyCertificate = asyncHandler(async (req, res) => {
  const certificate = await findCertificateWithDetails(req.params.credentialId as string);
  if (!certificate) {
    return res.json({ valid: false, message: "No certificate found for this ID." });
  }

  const enrollment = certificate.enrollment as unknown as PopulatedEnrollment;
  res.json({
    valid: true,
    credentialId: certificate.credentialId,
    studentName: certificateName(certificate, enrollment.student),
    courseName: enrollment.course.title,
    issueDate: certificate.issueDate,
    completionDate: certificate.completionDate,
    issuingCentre: env.centreName,
  });
});

export const downloadCertificate = asyncHandler(async (req, res) => {
  const certificate = await findCertificateWithDetails(req.params.credentialId as string);
  if (!certificate) throw ApiError.notFound("Certificate not found");

  const enrollment = certificate.enrollment as unknown as PopulatedEnrollment;
  const pdfBytes = await generateCertificatePdf({
    studentName: certificateName(certificate, enrollment.student),
    courseName: enrollment.course.title,
    courseDescription: enrollment.course.description ?? "",
    credentialId: certificate.credentialId,
    issueDate: certificate.issueDate,
    completionDate: certificate.completionDate ?? null,
    issuerName: certificate.issuerName || env.centreName,
    centreName: env.centreName,
    verifyUrl: verifyUrlFor(certificate.credentialId),
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="certificate-${certificate.credentialId}.pdf"`
  );
  res.send(Buffer.from(pdfBytes));
});
