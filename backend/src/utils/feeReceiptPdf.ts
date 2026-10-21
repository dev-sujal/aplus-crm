import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";

export interface FeeReceiptPdfInput {
  studentName: string;
  studentId?: string; // Student ID / Admission No.
  courseName: string;
  receiptNo: string;
  paymentDate: Date;

  amount: number; // current payment received
  totalFee: number; // total course fee
  amountPaid: number; // total paid INCLUDING this payment
  amountRemaining: number; // pending after this payment

  mode: string; // CASH / UPI / BANK_TRANSFER / OTHER
  referenceNo?: string; // transaction / reference no.
  note?: string;
}

const ASSET_DIR =
  process.env.CERT_ASSET_DIR ?? path.join(process.cwd(), "assets", "certificate");

const asset = (...p: string[]) => readFile(path.join(ASSET_DIR, ...p));

const RECEIVED_BY = "Abhishek Sharma";
const ADDRESS = "Shop No 7 C1 BMC Bldg, Near The Sanatan High School, Mumbai - 400037";
const CONTACTS = ["9702279232", "9322112247"];
const WEBSITE = "apluscomputerclasses.co.in";

function formatMoney(value: number) {
  const formatter = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Rs. ${formatter.format(value)}`;
}

// DD-MM-YYYY, like the sample template
function formatDate(value: Date) {
  const dd = String(value.getDate()).padStart(2, "0");
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${value.getFullYear()}`;
}

function formatMode(mode: string) {
  const map: Record<string, string> = {
    CASH: "Cash",
    UPI: "UPI",
    BANK_TRANSFER: "Bank Transfer",
    OTHER: "Other",
  };
  const key = mode.toUpperCase();
  return (
    map[key] ??
    mode
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// Shrink text with an ellipsis so it never overflows its cell
function fit(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + "...", size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "...";
}

// Word-wrap text into lines that fit maxWidth
function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) <= maxWidth || !cur) {
      cur = test;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function generateFeeReceiptPdf(input: FeeReceiptPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Fee Receipt - ${input.receiptNo}`);
  doc.setAuthor("A+ Computer Classes");

  const page: PDFPage = doc.addPage([595, 842]);
  const width = page.getWidth();
  const height = page.getHeight();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const navy = rgb(0.14, 0.12, 0.35);
  const gold = rgb(0.74, 0.58, 0.24);
  const dark = rgb(0.15, 0.15, 0.15);
  const muted = rgb(0.45, 0.45, 0.45);
  const paper = rgb(0.99, 0.99, 0.98);
  const red = rgb(0.84, 0.09, 0.11);
  const white = rgb(1, 1, 1);
  const labelBg = rgb(0.95, 0.95, 0.97);
  const rowLine = rgb(0.8, 0.8, 0.84);

  const left = 50;
  const right = width - 50;
  const contentW = right - left;
  const labelW = 175;

  // ---- Page background + double border ----
  page.drawRectangle({ x: 0, y: 0, width, height, color: paper });
  page.drawRectangle({
    x: 28, y: 28, width: width - 56, height: height - 56,
    borderColor: navy, borderWidth: 2,
  });
  page.drawRectangle({
    x: 36, y: 36, width: width - 72, height: height - 72,
    borderColor: gold, borderWidth: 1,
  });

  // ---- Header: address (left) | logo (center) | contact + website (right) ----
  const logo = await doc.embedPng(await asset("logo.png"));
  const logoDims = logo.scaleToFit(220, 71);
  const logoX = (width - logoDims.width) / 2;
  const logoY = height - 52 - logoDims.height;
  page.drawImage(logo, {
    x: logoX, y: logoY,
    width: logoDims.width, height: logoDims.height,
  });

  const sideSize = 8.5;
  const sideLine = 11;
  const sideGap = 12;
  const centerY = logoY + logoDims.height / 2;

  // Left: address
  {
    const maxW = logoX - sideGap - left;
    const lines = wrap(ADDRESS, font, sideSize, maxW);
    const total = lines.length + 1; // + "Address:" heading
    let ty = centerY + (total * sideLine) / 2 - sideSize;
    page.drawText("Address:", { x: left, y: ty, size: sideSize, font: bold, color: navy });
    for (const line of lines) {
      ty -= sideLine;
      page.drawText(line, { x: left, y: ty, size: sideSize, font, color: dark });
    }
  }

  // Right: contact numbers + website
  {
    const rx = logoX + logoDims.width + sideGap;
    const maxW = right - rx;
    const rows: { text: string; bold?: boolean }[] = [
      { text: "Contact No.:", bold: true },
      ...CONTACTS.map((c) => ({ text: c })),
      { text: "Website:", bold: true },
      { text: WEBSITE },
    ];
    let ty = centerY + (rows.length * sideLine) / 2 - sideSize;
    rows.forEach((r, i) => {
      const f = r.bold ? bold : font;
      page.drawText(fit(r.text, f, sideSize, maxW), {
        x: rx, y: ty - i * sideLine, size: sideSize, font: f,
        color: r.bold ? navy : dark,
      });
    });
  }

  let y = logoY - 14;
  page.drawLine({
    start: { x: left, y }, end: { x: right, y },
    thickness: 1.2, color: gold,
  });

  // ---- Document title ----
  y -= 28;
  const title = "FEE PAYMENT RECEIPT";
  page.drawText(title, {
    x: (width - bold.widthOfTextAtSize(title, 16)) / 2,
    y, size: 16, font: bold, color: red,
  });

  // ---- Receipt No. / Receipt Date ----
  y -= 30;
  page.drawText("Receipt No.", { x: left, y, size: 9, font: bold, color: muted });
  page.drawText(input.receiptNo, { x: left, y: y - 15, size: 12, font: bold, color: dark });

  const dateLabel = "Receipt Date";
  const dateValue = formatDate(input.paymentDate);
  page.drawText(dateLabel, {
    x: right - bold.widthOfTextAtSize(dateLabel, 9), y,
    size: 9, font: bold, color: muted,
  });
  page.drawText(dateValue, {
    x: right - bold.widthOfTextAtSize(dateValue, 12), y: y - 15,
    size: 12, font: bold, color: dark,
  });

  y -= 36;

  // ---- Helpers ----
  const sectionBar = (title: string) => {
    page.drawRectangle({ x: left, y: y - 20, width: contentW, height: 20, color: navy });
    page.drawText(title, { x: left + 10, y: y - 14, size: 11, font: bold, color: white });
    y -= 20;
  };

  const rowH = 26;

  const infoRow = (label: string, value: string, opts?: { bold?: boolean; color?: ReturnType<typeof rgb> }) => {
    page.drawRectangle({
      x: left, y: y - rowH, width: labelW, height: rowH,
      color: labelBg, borderColor: rowLine, borderWidth: 0.6,
    });
    page.drawRectangle({
      x: left + labelW, y: y - rowH, width: contentW - labelW, height: rowH,
      color: white, borderColor: rowLine, borderWidth: 0.6,
    });
    page.drawText(label, { x: left + 10, y: y - 17, size: 10, font: bold, color: muted });
    const f = opts?.bold ? bold : font;
    page.drawText(fit(value || "-", f, 11, contentW - labelW - 20), {
      x: left + labelW + 10, y: y - 17, size: 11, font: f, color: opts?.color ?? dark,
    });
    y -= rowH;
  };

  const amountRow = (
    label: string, value: string,
    opts?: { bold?: boolean; highlight?: boolean; color?: ReturnType<typeof rgb> },
  ) => {
    const amtW = 150;
    page.drawRectangle({
      x: left, y: y - rowH, width: contentW - amtW, height: rowH,
      color: opts?.highlight ? labelBg : white, borderColor: rowLine, borderWidth: 0.6,
    });
    page.drawRectangle({
      x: right - amtW, y: y - rowH, width: amtW, height: rowH,
      color: opts?.highlight ? labelBg : white, borderColor: rowLine, borderWidth: 0.6,
    });
    const f = opts?.bold ? bold : font;
    page.drawText(label, { x: left + 10, y: y - 17, size: 11, font: f, color: dark });
    page.drawText(value, {
      x: right - 10 - f.widthOfTextAtSize(value, 11), y: y - 17,
      size: 11, font: f, color: opts?.color ?? dark,
    });
    y -= rowH;
  };

  // ---- Student Details ----
  sectionBar("Student Details");
  infoRow("Student Name", input.studentName);
  infoRow("Student ID / Admission No.", input.studentId ?? "");
  infoRow("Course Name", input.courseName);

  // ---- Fee Summary ----
  y -= 18;
  sectionBar("Fee Summary");
  {
    const amtW = 150;
    page.drawRectangle({
      x: left, y: y - 22, width: contentW - amtW, height: 22,
      color: labelBg, borderColor: rowLine, borderWidth: 0.6,
    });
    page.drawRectangle({
      x: right - amtW, y: y - 22, width: amtW, height: 22,
      color: labelBg, borderColor: rowLine, borderWidth: 0.6,
    });
    page.drawText("Description", { x: left + 10, y: y - 15, size: 10, font: bold, color: muted });
    const h = "Amount (Rs.)";
    page.drawText(h, {
      x: right - 10 - bold.widthOfTextAtSize(h, 10), y: y - 15,
      size: 10, font: bold, color: muted,
    });
    y -= 22;
  }

  const previouslyPaid = Math.max(0, input.amountPaid - input.amount);
  amountRow("Total Course Fee", formatMoney(input.totalFee));
  amountRow("Fee Paid Previously", formatMoney(previouslyPaid));
  amountRow("Current Payment Received", formatMoney(input.amount), {
    bold: true, highlight: true, color: navy,
  });
  amountRow("Total Fee Paid (Previous + Current)", formatMoney(input.amountPaid));
  amountRow("Remaining Pending Fee", formatMoney(input.amountRemaining), {
    bold: true, highlight: true,
    color: input.amountRemaining > 0 ? red : navy,
  });

  // ---- Payment Details ----
  y -= 18;
  sectionBar("Payment Details");
  infoRow("Payment Mode", formatMode(input.mode));
  infoRow("Transaction / Reference No.", input.referenceNo ?? "");
  infoRow("Received By", RECEIVED_BY);
  if (input.note?.trim()) infoRow("Note", input.note.trim());

  // ---- Signatures ----
  const sigY = 135;
  const sigW = 170;

  // Left: student signature
  page.drawLine({
    start: { x: left + 5, y: sigY }, end: { x: left + 5 + sigW, y: sigY },
    thickness: 0.8, color: muted,
  });
  page.drawText("Student Signature (Optional)", {
    x: left + 5, y: sigY - 13, size: 9, font: font, color: muted,
  });

  // Right: signature image + line + company name + "Proprietor" (centered)
  const sigX0 = right - 5 - sigW;
  const sigCx = sigX0 + sigW / 2;

  const signature = await doc.embedPng(await asset("signature.png"));
  // const sigDims = signature.scaleToFit(sigW - 20, 50);
  const sigDims = signature.scaleToFit(sigW - 50, 30);
  page.drawImage(signature, {
    x: sigCx - sigDims.width / 2,
    y: sigY + 4,
    width: sigDims.width,
    height: sigDims.height,
  });

  page.drawLine({
    start: { x: sigX0, y: sigY }, end: { x: right - 5, y: sigY },
    thickness: 0.8, color: muted,
  });

  const company = "Aplus Computer Classes";
  page.drawText(company, {
    x: sigCx - bold.widthOfTextAtSize(company, 10) / 2,
    y: sigY - 14, size: 10, font: bold, color: navy,
  });
  const role = "Proprietor";
  page.drawText(role, {
    x: sigCx - font.widthOfTextAtSize(role, 9) / 2,
    y: sigY - 27, size: 9, font: font, color: muted,
  });

  // ---- Footer ----
  const thanks = "Thank you for your payment!";
  page.drawText(thanks, {
    x: (width - bold.widthOfTextAtSize(thanks, 13)) / 2,
    y: 88, size: 13, font: bold, color: navy,
  });
  const foot = "This is a computer-generated receipt and is valid as proof of payment.";
  page.drawText(foot, {
    x: (width - font.widthOfTextAtSize(foot, 8.5)) / 2,
    y: 66, size: 8.5, font: font, color: muted,
  });

  return Buffer.from(await doc.save());
}