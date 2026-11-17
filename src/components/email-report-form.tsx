"use client";

import { FormEvent, useState } from "react";
import { Mail } from "lucide-react";
import { downloadPatientReport, type PatientReport } from "@/lib/download-report";

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    for (let index = 0; index < chunk.length; index += 1) {
      binary += String.fromCharCode(chunk[index]);
    }
  }
  return btoa(binary);
}

export default function EmailReportForm({
  report,
  initialName = "",
  initialEmail = "",
}: {
  report: PatientReport;
  initialName?: string;
  initialEmail?: string;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setStatus(null);
    setError(null);
    try {
      const pdf = await downloadPatientReport(
        { ...report, patientName: name.trim(), patientEmail: email.trim() },
        { download: false },
      );
      const response = await fetch("/api/email-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: name.trim(),
          email: email.trim(),
          trackingId: report.trackingId ?? undefined,
          pdfBase64: toBase64(new Uint8Array(await pdf.arrayBuffer())),
        }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (
        !data ||
        typeof data !== "object" ||
        !("message" in data) ||
        typeof data.message !== "string"
      ) {
        throw new Error("The email service returned an unreadable response.");
      }
      if (!response.ok) throw new Error(data.message);
      setStatus(data.message);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Your report could not be emailed. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="assessment-email-report" onSubmit={handleSubmit}>
      <div>
        <span className="assessment-result-index">EMAIL A COPY</span>
        <h3>Email me my report</h3>
        <p>We’ll send this PDF to the address you provide. Your contact details are not sent to the ENT analysis service.</p>
      </div>
      <div className="assessment-email-report-fields">
        <label>
          <span>Your name</span>
          <input
            type="text"
            name="patientName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            autoComplete="name"
            required
          />
        </label>
        <label>
          <span>Email address</span>
          <input
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={254}
            autoComplete="email"
            required
          />
        </label>
      </div>
      <button type="submit" className="assessment-continue-button" disabled={sending}>
        <Mail aria-hidden="true" size={16} />
        {sending ? "Sending report…" : "Email me my report"}
      </button>
      {status && <p className="assessment-inline-status" role="status">{status}</p>}
      {error && <p className="assessment-inline-status assessment-email-error" role="alert">{error}</p>}
    </form>
  );
}
