import { Certificate } from "../models/Certificate.model.js";
import { Enrollment } from "../models/Enrollment.model.js";
import mongoose from "mongoose";
import { generateCredentialId } from "../utils/credentialId.js";
import { generateCertificatePdf } from "../utils/certificatePdf.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import type { CreateCertificateInput } from "../validators/certificate.validator.js";

interface PopulatedStudent {
  firstName: string;
  lastName: string;
}
interface PopulatedCourse {
  title: string;
}
interface PopulatedEnrollment {
  student: PopulatedStudent;
  course: PopulatedCourse;
}

async function findCertificateWithDetails(credentialId: string) {
  const certificate = await Certificate.findOne({ credentialId }).populate({
    path: "enrollment",
    populate: [
      { path: "student", select: "firstName lastName" },
      { path: "course", select: "title" },
    ],
  });
  return certificate;
}

function verifyUrlFor(credentialId: string) {
  return `${env.publicAppUrl.replace(/\/$/, "")}/verify/${credentialId}`;
}

export const listCertificatesForStudent = asyncHandler(async (req, res) => {
  const studentId = new mongoose.Types.ObjectId(req.params.studentId as string);
  const enrollments = await Enrollment.find({ student: studentId }).populate("course", "title");
  const enrollmentIds = enrollments.map((e) => e.id);

  const certificates = await Certificate.find({ enrollment: { $in: enrollmentIds } });
  const certByEnrollment = new Map(certificates.map((c) => [c.enrollment.toString(), c]));

  const rows = enrollments.map((e) => {
    const cert = certByEnrollment.get(e.id);
    const course = e.course as unknown as PopulatedCourse;
    return {
      enrollment: e.id,
      courseName: course?.title ?? "Unknown course",
      enrollmentStatus: e.status,
      certificate: cert
        ? {
            ...cert.toObject(),
            verifyUrl: verifyUrlFor(cert.credentialId),
          }
        : null,
    };
  });

  res.json(rows);
});

export const createCertificate = asyncHandler(async (req: AuthedRequest, res) => {
  const body = req.body as CreateCertificateInput;

  const enrollment = await Enrollment.findById(body.enrollment)
    .populate("student", "firstName lastName")
    .populate("course", "title");
  if (!enrollment) throw ApiError.notFound("Enrollment not found");
  if (enrollment.status === "dropped") {
    throw ApiError.conflict("Cannot issue a certificate for a dropped enrollment");
  }

  const existing = await Certificate.findOne({ enrollment: enrollment.id });
  if (existing) throw ApiError.conflict("A certificate has already been issued for this enrollment");

  const credentialId = await generateCredentialId();

  const certificate = await Certificate.create({
    enrollment: enrollment.id,
    credentialId,
    completionDate: body.completionDate ?? null,
    issuerName: body.issuerName || "",
    templateId: body.templateId,
    issuedBy: req.user!.id,
  });

  const student = enrollment.student as unknown as PopulatedStudent;
  const course = enrollment.course as unknown as PopulatedCourse;

  res.status(201).json({
    ...certificate.toObject(),
    studentName: `${student.firstName} ${student.lastName}`,
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
    studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
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
    studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
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
    studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
    courseName: enrollment.course.title,
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
