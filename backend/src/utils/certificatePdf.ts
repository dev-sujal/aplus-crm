import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { readFile } from "node:fs/promises";
import path from "node:path";

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

/* ------------------------------------------------------------------ */
/*  Institute details & settings                                      */
/* ------------------------------------------------------------------ */
const INSTITUTE = {
  isoNo: "TSNUK28970",
  udyamNo: "UDYAM-MH-0305005",
  tmNo: "6577453",
  issuerTitle: "Abhishek Sharma",
};

// The State Emblem of India is legally protected (Emblems and Names Act /
// State Emblem of India (Prohibition of Improper Use) Act, 2005). Keep this
// off unless you hold permission to use it.
const SHOW_NATIONAL_EMBLEM = true;

const ASSET_DIR =
  process.env.CERT_ASSET_DIR ?? path.join(process.cwd(), "assets", "certificate");

/* ------------------------------------------------------------------ */
/*  Palette (taken from the A+ Computer Classes logo)                 */
/* ------------------------------------------------------------------ */
const NAVY = rgb(0.137, 0.122, 0.353);
const RED = rgb(0.84, 0.09, 0.11);
const GOLD = rgb(0.74, 0.58, 0.24);
const GOLD_LIGHT = rgb(0.9, 0.8, 0.52);
const INK = rgb(0.14, 0.14, 0.18);
const MUTED = rgb(0.4, 0.4, 0.45);
const PAPER = rgb(0.997, 0.988, 0.962);

const W = 842; // A4 landscape (pt)
const H = 595;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const asset = (...p: string[]) => readFile(path.join(ASSET_DIR, ...p));

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
}

/** Wrap text into at most `maxLines` lines that fit `maxWidth`. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number, maxLines = 2): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const head = lines.slice(0, maxLines - 1);
    head.push(lines.slice(maxLines - 1).join(" "));
    return head;
  }
  return lines;
}

export async function generateCertificatePdf(input: CertificatePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Certificate - ${input.studentName}`);
  doc.setAuthor("A+ Computer Classes");
  doc.setSubject(input.courseName);

  const page = doc.addPage([W, H]);

  /* ---- fonts ---- */
  const embed = async (f: string) => doc.embedFont(await asset("fonts", f), { subset: true });
  const script = await embed("GreatVibes-Regular.woff");
  const serifBold = await embed("PlayfairDisplay-Bold.woff");
  const serifItalic = await embed("CormorantGaramond-MediumItalic.woff");
  const sans = await embed("Montserrat-Medium.woff");
  const sansBold = await embed("Montserrat-SemiBold.woff");

  /* ---- images ---- */
  const logo = await doc.embedPng(await asset("logo.png"));
  const aplusMark = await doc.embedPng(await asset("aplus-mark.png"));
  const iso = await doc.embedPng(await asset("iso.png"));
  const tm = await doc.embedPng(await asset("tm.png"));
  const signature = await doc.embedPng(await asset("signature.png"));
  const emblem = SHOW_NATIONAL_EMBLEM ? await doc.embedPng(await asset("emblem.png")) : null;

  /* ---- drawing primitives (all Y values are measured from the TOP) ---- */
  const Y = (top: number) => H - top;

  const textW = (t: string, f: PDFFont, s: number, spacing = 0) =>
    f.widthOfTextAtSize(t, s) + spacing * Math.max(t.length - 1, 0);

  /** Draw text (optionally letter-spaced) with its left edge at x. */
  const textAt = (t: string, x: number, top: number, f: PDFFont, s: number, color = INK, spacing = 0) => {
    if (!spacing) return page.drawText(t, { x, y: Y(top), size: s, font: f, color });
    let cx = x;
    for (const ch of t) {
      page.drawText(ch, { x: cx, y: Y(top), size: s, font: f, color });
      cx += f.widthOfTextAtSize(ch, s) + spacing;
    }
  };
  const centered = (t: string, cx: number, top: number, f: PDFFont, s: number, color = INK, spacing = 0) =>
    textAt(t, cx - textW(t, f, s, spacing) / 2, top, f, s, color, spacing);

  const imgFit = (img: PDFImage, maxW: number, maxH: number) => {
    const r = Math.min(maxW / img.width, maxH / img.height);
    return { w: img.width * r, h: img.height * r };
  };
  const drawImg = (img: PDFImage, cx: number, top: number, maxW: number, maxH: number, opacity = 1) => {
    const { w, h } = imgFit(img, maxW, maxH);
    page.drawImage(img, { x: cx - w / 2, y: Y(top + h), width: w, height: h, opacity });
    return { w, h };
  };
  const hline = (x1: number, x2: number, top: number, thickness: number, color = GOLD) =>
    page.drawLine({ start: { x: x1, y: Y(top) }, end: { x: x2, y: Y(top) }, thickness, color });

  const diamond = (cx: number, top: number, r: number, color = GOLD) =>
    page.drawSvgPath(`M0 ${-r} L${r} 0 L0 ${r} L${-r} 0 Z`, { x: cx, y: Y(top), color });

  /** Line – diamond – line ornament. */
  const ornament = (cx: number, top: number, halfWidth: number) => {
    const gap = 12;
    hline(cx - halfWidth, cx - gap, top, 0.9);
    hline(cx + gap, cx + halfWidth, top, 0.9);
    diamond(cx, top, 4.5);
    diamond(cx - gap - 6, top, 2);
    diamond(cx + gap + 6, top, 2);
  };

  /* ================================================================ */
  /*  BACKGROUND, WATERMARK & BORDER                                  */
  /* ================================================================ */
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });

  // faint watermark
  drawImg(logo, W / 2, 232, 560, 140, 0.028);

  // triple border
  page.drawRectangle({ x: 16, y: 16, width: W - 32, height: H - 32, borderColor: NAVY, borderWidth: 5 });
  page.drawRectangle({ x: 25, y: 25, width: W - 50, height: H - 50, borderColor: GOLD, borderWidth: 1.6 });
  page.drawRectangle({ x: 30, y: 30, width: W - 60, height: H - 60, borderColor: NAVY, borderWidth: 0.6 });

  // corner ornaments
  for (const [cx, cy] of [
    [25, 25],
    [W - 25, 25],
    [25, H - 25],
    [W - 25, H - 25],
  ] as const) {
    page.drawSvgPath("M0 -11 L11 0 L0 11 L-11 0 Z", { x: cx, y: cy, color: NAVY });
    page.drawSvgPath("M0 -7 L7 0 L0 7 L-7 0 Z", { x: cx, y: cy, color: PAPER });
    page.drawSvgPath("M0 -4 L4 0 L0 4 L-4 0 Z", { x: cx, y: cy, color: GOLD });
  }

  /* ================================================================ */
  /*  HEADER – ISO | LOGO | EMBLEM                                    */
  /* ================================================================ */
  const LEFT = 62;
  const RIGHT = W - 62;
  const headTop = 48;

  // logo (centre) – larger
  const logoSize = drawImg(logo, W / 2, headTop, 350, 78);

  // ISO badge (left)
  const sideCx = 58; // distance of the side logos' centre from the content edge
  const captionTop = headTop + 76;
  drawImg(iso, LEFT + sideCx, headTop + 2, 62, 50);
  centered("9001:2015", LEFT + sideCx, captionTop - 11, sansBold, 9, NAVY, 0.8);
  centered("ISO CERTIFIED", LEFT + sideCx, captionTop, sansBold, 6.2, NAVY, 0.6);

  // emblem (right)
  if (emblem) {
    drawImg(emblem, RIGHT - sideCx, headTop - 2, 44, 70);
    centered("UDYAM REGISTERED", RIGHT - sideCx, captionTop, sansBold, 6.2, NAVY, 0.6);
  } else {
    centered("UDYAM", RIGHT - sideCx, headTop + 36, sansBold, 12, NAVY, 1);
    centered("REGISTERED", RIGHT - sideCx, captionTop, sansBold, 6.2, NAVY, 0.6);
  }

  const afterHeader = headTop + Math.max(logoSize.h, 78) + 12; // ~138
  ornament(W / 2, afterHeader, 250);

  /* ================================================================ */
  /*  TITLE                                                           */
  /* ================================================================ */
  centered("CERTIFICATE", W / 2, 188, serifBold, 37, NAVY, 6.5);
  centered("OF COMPLETION", W / 2, 211, sansBold, 11, RED, 6);

  centered("This certificate is proudly presented to", W / 2, 246, serifItalic, 16, MUTED);

  /* ================================================================ */
  /*  STUDENT NAME                                                    */
  /* ================================================================ */
  let nameSize = 54;
  while (script.widthOfTextAtSize(input.studentName, nameSize) > 580 && nameSize > 26) nameSize -= 2;
  centered(input.studentName, W / 2, 296, script, nameSize, NAVY);

  const nameLineHalf = Math.min(Math.max(textW(input.studentName, script, nameSize) / 2 + 40, 170), 300);
  hline(W / 2 - nameLineHalf, W / 2 + nameLineHalf, 310, 1.1, GOLD);
  hline(W / 2 - nameLineHalf + 30, W / 2 + nameLineHalf - 30, 313.5, 0.4, GOLD);

  /* ================================================================ */
  /*  COURSE                                                          */
  /* ================================================================ */
  centered("for successfully completing the course of", W / 2, 341, serifItalic, 16, MUTED);

  const oneLine = wrap(input.courseName, serifBold, 23, 640, 1).length === 1 &&
    serifBold.widthOfTextAtSize(input.courseName, 23) <= 640;
  const courseSize = oneLine ? 23 : 19;
  const courseLeading = oneLine ? 0 : 24;
  const courseLines = oneLine ? [input.courseName] : wrap(input.courseName, serifBold, courseSize, 660, 2);
  const courseTop = oneLine ? 374 : 366;
  courseLines.forEach((ln, i) => centered(ln, W / 2, courseTop + i * courseLeading, serifBold, courseSize, RED));

  const dateTop = oneLine ? 402 : 411;
  const completionLine = input.completionDate
    ? `Completed on ${formatDate(input.completionDate)}   |   Issued on ${formatDate(input.issueDate)}`
    : `Issued on ${formatDate(input.issueDate)}`;
  centered(completionLine, W / 2, dateTop, sans, 9, MUTED, 0.4);

  /* ================================================================ */
  /*  FOOTER – SIGNATURE | SEAL | QR                                  */
  /* ================================================================ */
  const footLine = 490; // baseline for signature / QR bottoms

  // Signature (left)
  const sigCx = LEFT + 100;
  drawImg(signature, sigCx, footLine - 52, 150, 48);
  hline(sigCx - 100, sigCx + 100, footLine, 0.9, NAVY);
  centered(input.issuerName || "Authorized Signatory", sigCx, footLine + 14, sansBold, 10, NAVY, 0.3);
  centered(INSTITUTE.issuerTitle, sigCx, footLine + 26, serifItalic, 12.5, MUTED);

  // Seal (centre)
  const sealCx = W / 2;
  const sealCy = 461;
  const sealR = 36;
  // ribbon tails
  const tail = "M0 0 L17 0 L17 24 L8.5 18 L0 24 Z";
  page.drawSvgPath(tail, { x: sealCx - 21, y: Y(sealCy + 22), color: RED });
  page.drawSvgPath(tail, { x: sealCx + 4, y: Y(sealCy + 22), color: NAVY });
  // scalloped gold edge
  const teeth = 30;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    page.drawCircle({
      x: sealCx + Math.cos(a) * sealR,
      y: Y(sealCy) + Math.sin(a) * sealR,
      size: 4.2,
      color: GOLD,
    });
  }
  page.drawCircle({ x: sealCx, y: Y(sealCy), size: sealR, color: GOLD });
  page.drawCircle({ x: sealCx, y: Y(sealCy), size: sealR - 4.5, color: NAVY });
  page.drawCircle({ x: sealCx, y: Y(sealCy), size: sealR - 7, color: PAPER });
  page.drawCircle({ x: sealCx, y: Y(sealCy), size: sealR - 9, borderColor: GOLD, borderWidth: 0.6 });
  // A+ mark from the logo
  drawImg(aplusMark, sealCx, sealCy - 24, 36, 36);
  centered("CERTIFIED", sealCx, sealCy + 20, sansBold, 4.8, NAVY, 0.9);

  centered(`Credential ID: ${input.credentialId}`, sealCx, footLine + 26, sansBold, 8, NAVY, 0.4);

  // QR (right)
  const qrBytes = await QRCode.toBuffer(input.verifyUrl, {
    type: "png",
    margin: 0,
    width: 400,
    color: { dark: "#231f5a", light: "#ffffff" },
  });
  const qr = await doc.embedPng(qrBytes);
  const qrSize = 74;
  const qrCx = RIGHT - 52;
  page.drawRectangle({
    x: qrCx - qrSize / 2 - 5,
    y: Y(footLine + 5),
    width: qrSize + 10,
    height: qrSize + 10,
    color: rgb(1, 1, 1),
    borderColor: GOLD,
    borderWidth: 1,
  });
  page.drawImage(qr, { x: qrCx - qrSize / 2, y: Y(footLine), width: qrSize, height: qrSize });
  centered("SCAN TO VERIFY", qrCx, footLine + 26, sansBold, 6.8, NAVY, 0.8);

  /* ================================================================ */
  /*  REGISTRATION STRIP                                              */
  /* ================================================================ */
  hline(LEFT, RIGHT, 523, 0.6, GOLD);

  const stripBase = 549; // baseline of the main registration text
  const stripMid = 543; // vertical centre of the icons
  const stripSize = 7.6;
  const iconH = 20;
  const items: { icon?: PDFImage; text: string; above?: string }[] = [
    { icon: iso, above: "9001:2015", text: `ISO No: ${INSTITUTE.isoNo}` },
    { text: `Udyam Reg. No: ${INSTITUTE.udyamNo}` },
    { icon: tm, text: `TM No: ${INSTITUTE.tmNo}` },
  ];
  const gap = 34;
  const iconGap = 6;
  const widths = items.map((it) => {
    const iw = it.icon ? imgFit(it.icon, 44, iconH).w + iconGap : 0;
    return iw + textW(it.text, sansBold, stripSize, 0.4);
  });
  const total = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
  let x = (W - total) / 2;
  items.forEach((it, i) => {
    if (it.icon) {
      const { w, h } = imgFit(it.icon, 44, iconH);
      page.drawImage(it.icon, { x, y: Y(stripMid + h / 2), width: w, height: h });
      x += w + iconGap;
    }
    const tw = textW(it.text, sansBold, stripSize, 0.4);
    if (it.above) centered(it.above, x + tw / 2, stripBase - 10.5, sansBold, 8.2, NAVY, 0.8);
    textAt(it.text, x, stripBase, sansBold, stripSize, NAVY, 0.4);
    x += tw;
    if (i < items.length - 1) {
      diamond(x + gap / 2, stripBase - 2.5, 2.2);
      x += gap;
    }
  });

  return doc.save();
}