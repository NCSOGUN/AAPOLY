import { isRecord, type EntAnalysisResult, type SavedEntReport } from "@/lib/ent-types";

export type PatientReport = {
  trackingId?: string | null;
  patientName?: string;
  patientEmail?: string;
  symptoms?: string;
  affectedArea?: string | null;
  duration?: string;
  age?: number | null;
  additionalContext?: string;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
  imageResult?: Record<string, unknown>;
  result: EntAnalysisResult;
};

const colors = {
  green: [0, 105, 72] as [number, number, number],
  greenDark: [0, 80, 57] as [number, number, number],
  greenPale: [239, 247, 243] as [number, number, number],
  ink: [35, 57, 65] as [number, number, number],
  muted: [91, 109, 116] as [number, number, number],
  line: [218, 228, 225] as [number, number, number],
  amber: [145, 94, 14] as [number, number, number],
  amberPale: [255, 248, 231] as [number, number, number],
  red: [156, 53, 47] as [number, number, number],
  redPale: [255, 242, 240] as [number, number, number],
};

const left = 18;
const right = 18;
const contentWidth = 210 - left - right;
const bodyTop = 42;
const bodyBottom = 276;

function cleanText(value: string) {
  return value
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .trim();
}

function readStringList(value?: string[]) {
  return value?.filter((item) => typeof item === "string" && item.trim()) ?? [];
}

async function loadImage(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load report branding asset: ${url}`);
  const image = new Image();
  const objectUrl = URL.createObjectURL(await response.blob());
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`Could not load report branding asset: ${url}`));
      image.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function imageDataUrl(
  image: HTMLImageElement,
  opacity = 1,
  crop = { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight },
) {
  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare report branding.");
  context.globalAlpha = opacity;
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height,
  );
  return canvas.toDataURL("image/png");
}

export async function downloadPatientReport(
  report: PatientReport,
  { download = true }: { download?: boolean } = {},
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const [logo, font] = await Promise.all([
    loadImage("/aap-logo-img.png"),
    fetch("/fonts/noto-sans-v27-latin-regular.ttf"),
  ]);
  if (!font.ok) throw new Error("Could not load the report font.");

  const fontBytes = new Uint8Array(await font.arrayBuffer());
  let fontBinary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < fontBytes.length; offset += chunkSize) {
    const chunk = fontBytes.subarray(offset, offset + chunkSize);
    for (let index = 0; index < chunk.length; index += 1) {
      fontBinary += String.fromCharCode(chunk[index]);
    }
  }
  pdf.addFileToVFS("NotoSans-Regular.ttf", btoa(fontBinary));
  pdf.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");

  const logoData = imageDataUrl(logo);
  const watermarkData = imageDataUrl(logo, 0.04, { x: 0, y: 0, width: 76, height: 97 });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentRight = pageWidth - right;
  let y = bodyTop;

  pdf.setProperties({
    title: `ENT-Care Patient Report ${report.trackingId ?? ""}`.trim(),
    subject: "Preliminary ENT symptom assessment guidance",
    author: "ENT-Care",
    creator: "ENT-Care Patient Web Application",
  });

  const setFont = (fontName: "NotoSans" | "times", style: "normal" | "bold" = "normal") => {
    pdf.setFont(fontName, style);
  };

  const drawPageChrome = () => {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, "F");
    pdf.addImage(logoData, "PNG", left, 11, 34, 14);
    pdf.addImage(watermarkData, "PNG", 77, 104, 56, 71);
    setFont("NotoSans");
    pdf.setTextColor(...colors.greenDark);
    pdf.setFontSize(8);
    pdf.text("PATIENT CARE  /  EAR · NOSE · THROAT", 59, 16);
    pdf.setTextColor(...colors.muted);
    pdf.setFontSize(7.5);
    pdf.text("PATIENT REPORT", 59, 22);
    pdf.setDrawColor(...colors.line);
    pdf.setLineWidth(0.35);
    pdf.line(left, 31, contentRight, 31);
    pdf.setFillColor(...colors.green);
    pdf.rect(0, 0, pageWidth, 3, "F");
    y = bodyTop;
  };

  const addPage = () => {
    pdf.addPage();
    drawPageChrome();
  };

  const ensureSpace = (height: number) => {
    if (y + height > bodyBottom) addPage();
  };

  const addText = (
    value: string,
    options: {
      size?: number;
      color?: [number, number, number];
      font?: "NotoSans" | "times";
      style?: "normal" | "bold";
      gap?: number;
      x?: number;
      width?: number;
      lineHeight?: number;
    } = {},
  ) => {
    const {
      size = 9.5,
      color = colors.ink,
      font = "NotoSans",
      style = "normal",
      gap = 2,
      x = left,
      width = contentWidth,
      lineHeight = size * 0.42,
    } = options;
    const text = cleanText(value);
    if (!text) return;
    setFont(font, style);
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text, width) as string[];
    let offset = 0;
    while (offset < lines.length) {
      const availableLines = Math.floor((bodyBottom - y - gap) / lineHeight);
      if (availableLines < 1) {
        addPage();
        continue;
      }
      const count = Math.min(availableLines, lines.length - offset);
      const chunk = lines.slice(offset, offset + count);
      pdf.setTextColor(...color);
      pdf.text(chunk, x, y);
      y += count * lineHeight;
      offset += count;
      if (offset < lines.length) addPage();
    }
    y += gap;
  };

  const addSection = (title: string, values?: string | string[]) => {
    const items = (Array.isArray(values) ? values : values ? [values] : [])
      .map(cleanText)
      .filter(Boolean);
    if (!items.length) return;
    ensureSpace(12);
    pdf.setDrawColor(...colors.line);
    pdf.setLineWidth(0.25);
    pdf.line(left, y, contentRight, y);
    y += 6;
    addText(title.toUpperCase(), {
      size: 8,
      color: colors.greenDark,
      gap: 2,
    });
    for (const item of items) {
      addText(`•  ${item}`, {
        size: 9.2,
        x: left + 1,
        width: contentWidth - 1,
        gap: 1.5,
      });
    }
    y += 1;
  };

  const addCallout = (
    title: string,
    body: string,
    tone: "green" | "amber" | "red" = "green",
  ) => {
    const background = tone === "red" ? colors.redPale : tone === "amber" ? colors.amberPale : colors.greenPale;
    const accent = tone === "red" ? colors.red : tone === "amber" ? colors.amber : colors.green;
    setFont("NotoSans");
    pdf.setFontSize(9);
    const bodyLines = pdf.splitTextToSize(cleanText(body), contentWidth - 14) as string[];
    const height = 12 + bodyLines.length * 4.1;
    ensureSpace(height + 3);
    const boxTop = y;
    pdf.setFillColor(...background);
    pdf.roundedRect(left, boxTop, contentWidth, height, 2, 2, "F");
    pdf.setFillColor(...accent);
    pdf.roundedRect(left, boxTop, 2, height, 1, 1, "F");
    y = boxTop + 4;
    addText(title.toUpperCase(), {
      size: 7.5,
      color: accent,
      x: left + 7,
      width: contentWidth - 14,
      gap: 1,
    });
    addText(body, {
      size: 9,
      color: colors.ink,
      x: left + 7,
      width: contentWidth - 14,
      lineHeight: 4.1,
      gap: 0,
    });
    y = boxTop + height + 5;
  };

  const addMetadata = () => {
    const identityFields = [
      ["PATIENT NAME", report.patientName || "Not provided"],
      ["EMAIL", report.patientEmail || "Not provided"],
    ];
    const identityGap = 3;
    const identityCellWidth = (contentWidth - identityGap) / 2;
    const identityHeight = 18;
    ensureSpace(identityHeight + 5);
    identityFields.forEach(([label, value], index) => {
      const x = left + index * (identityCellWidth + identityGap);
      pdf.setFillColor(247, 250, 248);
      pdf.setDrawColor(...colors.line);
      pdf.roundedRect(x, y, identityCellWidth, identityHeight, 1.5, 1.5, "FD");
      setFont("NotoSans");
      pdf.setFontSize(6.6);
      pdf.setTextColor(...colors.muted);
      pdf.text(label, x + 3, y + 5);
      pdf.setFontSize(8.3);
      pdf.setTextColor(...colors.ink);
      pdf.text(pdf.splitTextToSize(cleanText(value), identityCellWidth - 6).slice(0, 2), x + 3, y + 11);
    });
    y += identityHeight + 4;

    const fields = [
      ["AREA", report.affectedArea || "Not specified"],
      ["DURATION", report.duration || "Not specified"],
      ["AGE", typeof report.age === "number" ? `${report.age} years` : "Not provided"],
    ];
    const gap = 3;
    const cellWidth = (contentWidth - gap * 2) / 3;
    const height = 18;
    ensureSpace(height + 5);
    fields.forEach(([label, value], index) => {
      const x = left + index * (cellWidth + gap);
      pdf.setFillColor(247, 250, 248);
      pdf.setDrawColor(...colors.line);
      pdf.roundedRect(x, y, cellWidth, height, 1.5, 1.5, "FD");
      setFont("NotoSans");
      pdf.setFontSize(6.6);
      pdf.setTextColor(...colors.muted);
      pdf.text(label, x + 3, y + 5);
      pdf.setFontSize(8.3);
      pdf.setTextColor(...colors.ink);
      pdf.text(pdf.splitTextToSize(cleanText(value), cellWidth - 6).slice(0, 2), x + 3, y + 11);
    });
    y += height + 5;
  };

  drawPageChrome();
  addText("Symptom assessment report", {
    size: 23,
    font: "times",
    style: "bold",
    color: colors.ink,
    gap: 1,
  });
  addText(
    `Prepared ${report.createdAt ? new Date(report.createdAt).toLocaleString() : new Date().toLocaleString()}  ·  Report ID: ${report.trackingId || "Not saved"}`,
    { size: 8, color: colors.muted, gap: 5 },
  );
  addCallout(
    "Important health information",
    "This report is a symptom-based estimate of possible causes, based only on the information you shared. It is not a confirmed diagnosis and cannot replace an examination by a qualified healthcare professional. Please visit a nearby hospital or clinician for assessment and treatment, especially if symptoms persist or worsen. Seek urgent medical care if symptoms become severe or rapidly get worse.",
    "amber",
  );
  addMetadata();

  const clinical = report.result.clinical;
  const analysis = report.result.analysis;
  const condition = analysis?.primaryCondition;
  const conditionName = condition?.commonName || condition?.name;
  const conditionConfidence =
    typeof condition?.confidence === "number" ? `Service confidence: ${condition.confidence}%` : undefined;

  if (conditionName) {
    addCallout(
      "Possible condition indicated by this assessment",
      [conditionName, condition?.explanation, conditionConfidence].filter(Boolean).join(" · "),
      "green",
    );
  }

  const urgency = clinical?.urgencyLevel ?? "Not provided";
  const urgencyTone =
    urgency === "Emergency" || urgency === "Urgent"
      ? "red"
      : urgency === "Soon"
        ? "amber"
        : "green";
  addCallout(
    `Service-assigned urgency: ${urgency}`,
    clinical?.immediateAction ??
      "The service did not provide an immediate action. Contact a qualified healthcare professional for advice.",
    urgencyTone,
  );

  addSection("What you told us", report.symptoms);
  addSection("Additional context you shared", report.additionalContext);
  addSection(
    "Assessment details",
    [
      analysis?.method ? `Assessment method: ${analysis.method.replace(/_/g, " ")}` : undefined,
      analysis?.confidence !== undefined ? `Overall service confidence: ${analysis.confidence}` : undefined,
      typeof clinical?.urgencyScore === "number"
        ? `Service urgency score: ${clinical.urgencyScore}/10`
        : undefined,
      analysis?.aiStatus?.available === false
        ? "AI analysis was unavailable; the service may have used its medical database."
        : undefined,
    ].filter((value): value is string => Boolean(value)),
  );
  addSection("Service assessment notes", analysis?.aiInsights?.reasoning);
  addSection(
    "Other possible conditions considered",
    analysis?.differentials?.flatMap((item) => {
      const details = [
        item.commonName || item.name,
        typeof item.confidence === "number" ? `confidence ${item.confidence}%` : undefined,
        item.explanation,
      ].filter((value): value is string => Boolean(value));
      return details.length ? [details.join(" — ")] : [];
    }),
  );
  addSection("Warning signs — seek urgent care if these occur", readStringList(clinical?.redFlags));
  addSection("Advice from the service", clinical?.patientAdvice);
  addSection("Possible causes listed by the service", readStringList(clinical?.possibleCauses));
  addSection("Possible complications listed by the service", readStringList(clinical?.complications));
  addSection("Investigations mentioned", readStringList(clinical?.investigations));
  addSection("Recommended specialist care", readStringList(clinical?.specialists));
  addSection("Specialties considered", readStringList(analysis?.aiInsights?.specialties));
  addSection(
    "Services suggested",
    readStringList(analysis?.aiInsights?.services),
  );
  if (report.imageResult && isRecord(report.imageResult.analysis)) {
    const imageAnalysis = report.imageResult.analysis;
    addSection(
      "Optional photo review — visible findings",
      Array.isArray(imageAnalysis.findings)
        ? imageAnalysis.findings.filter((item): item is string => typeof item === "string")
        : undefined,
    );
    addSection(
      "Optional photo review — possible conditions",
      Array.isArray(imageAnalysis.possibleConditions)
        ? imageAnalysis.possibleConditions.filter((item): item is string => typeof item === "string")
        : undefined,
    );
    addSection(
      "Photo review next steps",
      Array.isArray(imageAnalysis.nextSteps)
        ? imageAnalysis.nextSteps.filter((item): item is string => typeof item === "string")
        : undefined,
    );
  }
  if (report.imageResult && typeof report.imageResult.disclaimer === "string") {
    addCallout("Photo review notice", report.imageResult.disclaimer, "amber");
  }
  if (report.result.escalation?.isComplex && report.result.escalation.message) {
    addCallout("Specialist review", report.result.escalation.message, "amber");
  }
  if (report.latitude !== undefined && report.longitude !== undefined) {
    addSection(
      "Location information",
      "You chose to share your location with the ENT service for this assessment. The report does not print your coordinates.",
    );
  }

  const footerText =
    "ENT-Care provides preliminary symptom guidance only. It cannot confirm a diagnosis or prescribe treatment. Follow the advice of a qualified healthcare professional.";
  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(...colors.line);
    pdf.setLineWidth(0.3);
    pdf.line(left, 282, contentRight, 282);
    setFont("NotoSans");
    pdf.setFontSize(6.8);
    pdf.setTextColor(...colors.muted);
    pdf.text(footerText, left, 287, { maxWidth: contentWidth - 18 });
    pdf.text(`${page} / ${totalPages}`, contentRight, 287, { align: "right" });
  }

  const filenameId = (report.trackingId || "assessment").replace(/[^a-zA-Z0-9-]/g, "");
  const blob = pdf.output("blob");
  if (download) pdf.save(`ent-care-report-${filenameId}.pdf`);
  return blob;
}

export function reportForDownload(report: SavedEntReport): PatientReport | null {
  if (!report.analysisResult) return null;
  return {
    trackingId: report.trackingId,
    patientName: report.patientName,
    patientEmail: report.patientEmail,
    symptoms: report.symptoms,
    affectedArea: report.affectedArea,
    duration: report.duration,
    age: report.age,
    additionalContext:
      typeof report.additionalContext === "string" ? report.additionalContext : undefined,
    latitude: typeof report.latitude === "number" ? report.latitude : undefined,
    longitude: typeof report.longitude === "number" ? report.longitude : undefined,
    createdAt: report.createdAt,
    result: report.analysisResult,
  };
}
