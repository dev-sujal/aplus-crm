import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";

export interface CertificatePdfInput {
  studentName: string;
  courseName: string;
  credentialId: string;
  issueDate: Date;
  completionDate: Date | null;
  issuerName: string;
  centreName: string;
  verifyUrl: string;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
}

export async function generateCertificatePdf(input: CertificatePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([842, 595]); // A4 landscape, points
  const { width, height } = page.getSize();

  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const accent = rgb(0.13, 0.32, 0.85);
  const ink = rgb(0.13, 0.13, 0.15);
  const muted = rgb(0.45, 0.45, 0.48);

  // Border
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: accent,
    borderWidth: 3,
  });
  page.drawRectangle({
    x: 34,
    y: 34,
    width: width - 68,
    height: height - 68,
    borderColor: accent,
    borderWidth: 0.75,
  });

  const centerText = (text: string, y: number, font = helvetica, size = 12, color = ink) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - textWidth) / 2, y, size, font, color });
  };

  centerText(input.centreName.toUpperCase(), height - 90, helveticaBold, 16, accent);
  centerText("Certificate of Completion", height - 150, helveticaBold, 30, ink);
  centerText("This certifies that", height - 195, italic, 13, muted);
  centerText(input.studentName, height - 235, helveticaBold, 26, accent);
  centerText("has successfully completed the course", height - 270, italic, 13, muted);
  centerText(input.courseName, height - 305, helveticaBold, 20, ink);

  const completionLine = input.completionDate
    ? `Completed on ${formatDate(input.completionDate)} · Issued on ${formatDate(input.issueDate)}`
    : `Issued on ${formatDate(input.issueDate)}`;
  centerText(completionLine, height - 335, helvetica, 11, muted);

  // Signature block (bottom-left)
  const sigX = 90;
  const sigY = 90;
  page.drawLine({
    start: { x: sigX, y: sigY + 24 },
    end: { x: sigX + 200, y: sigY + 24 },
    thickness: 1,
    color: muted,
  });
  page.drawText(input.issuerName || "Authorized Signatory", {
    x: sigX,
    y: sigY + 6,
    size: 11,
    font: helveticaBold,
    color: ink,
  });
  page.drawText("Owner / Issuer", { x: sigX, y: sigY - 10, size: 9, font: helvetica, color: muted });

  // Credential ID (bottom-center)
  centerText(`Credential ID: ${input.credentialId}`, 60, helvetica, 10, muted);

  // QR code (bottom-right), linking to the public verify page
  const qrPngBytes = await QRCode.toBuffer(input.verifyUrl, {
    type: "png",
    margin: 1,
    width: 220,
  });
  const qrImage = await doc.embedPng(qrPngBytes);
  const qrSize = 90;
  page.drawImage(qrImage, {
    x: width - 90 - qrSize,
    y: 70,
    width: qrSize,
    height: qrSize,
  });
  page.drawText("Scan to verify", {
    x: width - 90 - qrSize,
    y: 60,
    size: 8,
    font: helvetica,
    color: muted,
  });

  return doc.save();
}
