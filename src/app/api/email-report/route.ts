import nodemailer from "nodemailer";
import { z } from "zod";
import { NextResponse } from "next/server";
import { invalidRequest, readJsonBody } from "@/lib/ent-service";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_PDF_BYTES / 3) * 4;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_EMAILS_PER_WINDOW = 3;
const recentEmailRequests = new Map<string, number[]>();
const trackingIdSchema = z.string().trim().min(1).max(100).regex(/^[A-Z0-9+_-]+$/i);

const emailReportSchema = z.object({
  patientName: z.string().trim().min(1).max(120).refine(
    (value) => !/[\u0000-\u001f\u007f]/.test(value),
    "Enter a valid name.",
  ),
  email: z.string().trim().email().max(254),
  trackingId: trackingIdSchema.optional(),
  pdfBase64: z.string().min(1).max(MAX_BASE64_LENGTH).regex(/^[A-Za-z0-9+/]+={0,2}$/),
});

function readClientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("x-real-ip")?.trim() || forwarded || "unknown";
}

function hasExceededRateLimit(key: string) {
  const now = Date.now();
  recentEmailRequests.forEach((timestamps, client) => {
    const activeTimestamps = timestamps.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
    );
    if (activeTimestamps.length) recentEmailRequests.set(client, activeTimestamps);
    else recentEmailRequests.delete(client);
  });
  const recent = (recentEmailRequests.get(key) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );
  if (recent.length >= MAX_EMAILS_PER_WINDOW) {
    recentEmailRequests.set(key, recent);
    return true;
  }
  recent.push(now);
  recentEmailRequests.set(key, recent);
  return false;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BASE64_LENGTH + 16_384) {
    return NextResponse.json(
      { status: "error", message: "The report PDF is too large to email." },
      { status: 413 },
    );
  }
  if (hasExceededRateLimit(readClientKey(request))) {
    return NextResponse.json(
      { status: "error", message: "Too many report emails. Please try again later." },
      { status: 429 },
    );
  }

  const body = await readJsonBody(request);
  if (body.error) return invalidRequest(body.error);
  const parsed = emailReportSchema.safeParse(body.data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join(".");
    return invalidRequest(
      issue
        ? `${field ? `${field}: ` : ""}${issue.message}`
        : "Invalid report email details.",
    );
  }

  const pdf = Buffer.from(parsed.data.pdfBase64, "base64");
  if (pdf.length === 0) return invalidRequest("The report attachment is empty.");
  if (pdf.length > MAX_PDF_BYTES) {
    return invalidRequest("The report PDF must be 5 MB or smaller.");
  }
  if (!pdf.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    return invalidRequest("The report attachment is not a PDF file.");
  }
  if (pdf.lastIndexOf(Buffer.from("%%EOF")) < Math.max(0, pdf.length - 1024)) {
    return invalidRequest("The generated PDF appears incomplete. Please try again.");
  }

  const {
    SMTP_HOST: host,
    SMTP_PORT: portValue,
    SMTP_ENCRYPTION: encryption,
    SMTP_USERNAME: user,
    SMTP_PASSWORD: pass,
    SMTP_FROM_EMAIL: fromEmail,
    SMTP_FROM_NAME: fromName,
  } = process.env;
  const port = Number(portValue);
  const encryptionMode = encryption?.toLowerCase();
  if (
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !["ssl", "tls", "starttls"].includes(encryptionMode ?? "") ||
    !user ||
    !pass ||
    !fromEmail ||
    !fromName
  ) {
    return NextResponse.json(
      {
        status: "error",
        message:
          process.env.NODE_ENV === "development"
            ? "Email delivery is not configured. Set the SMTP_* values in .env.local and restart the development server."
            : "Email delivery is not configured. Please contact the app administrator.",
      },
      { status: 503 },
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: encryptionMode === "ssl",
    requireTLS: encryptionMode === "tls" || encryptionMode === "starttls",
    auth: { user, pass },
  });
  const greetingName = escapeHtml(parsed.data.patientName);
  const reportId = parsed.data.trackingId;
  const attachmentId = reportId?.replace(/[^A-Z0-9-]/gi, "") || "assessment";

  try {
    await transporter.sendMail({
      from: { name: fromName, address: fromEmail },
      to: parsed.data.email,
      subject: reportId ? `Your ENT-Care report · ${reportId}` : "Your ENT-Care report",
      text: [
        `Hello ${parsed.data.patientName},`,
        "",
        "Your requested ENT-Care report is attached as a PDF.",
        ...(reportId ? [`Report ID: ${reportId}`] : []),
        "",
        "This report provides preliminary symptom guidance only; it is not a confirmed diagnosis. Please speak with a qualified healthcare professional.",
      ].join("\n"),
      html: `<p>Hello ${greetingName},</p><p>Your requested ENT-Care report is attached as a PDF.</p>${reportId ? `<p>Report ID: <strong>${reportId}</strong></p>` : ""}<p>This report provides preliminary symptom guidance only; it is not a confirmed diagnosis. Please speak with a qualified healthcare professional.</p>`,
      attachments: [
        {
          filename: `ent-care-report-${attachmentId}.pdf`,
          content: pdf,
          contentType: "application/pdf",
        },
      ],
    });
  } catch {
    return NextResponse.json(
      { status: "error", message: "The report email could not be sent. Please try again later." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    status: "success",
    message: `Your report has been sent to ${parsed.data.email}.`,
  });
}
