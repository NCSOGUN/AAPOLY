"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Download,
  FileSearch,
  LoaderCircle,
} from "lucide-react";
import { downloadPatientReport, reportForDownload } from "@/lib/download-report";
import EmailReportForm from "@/components/email-report-form";
import { EntAnalysisResult, SavedEntReport, getAnalysisResult, getSavedReport, isRecord } from "@/lib/ent-types";
import { urgencyConfig } from "@/lib/urgency";
import PatientPageHeader from "@/components/patient-page-header";
import { normalizeNigerianPhone } from "@/lib/nigerian-phone";

const REPORT_VERIFICATION_CODE = "991549";
const reportIdPattern = /^(?:ENT-\d{4}-[A-Z0-9]{6,12}|\+234\d{10}-[A-Z0-9]{6})$/i;

async function fetchReports(lookupId: string): Promise<SavedEntReport[]> {
  const response = await fetch(`/api/report/${encodeURIComponent(lookupId)}`, {
    cache: "no-store",
  });
  const body: unknown = await response.json().catch(() => null);
  if (!isRecord(body)) {
    throw new Error("The report service returned an unreadable response.");
  }
  if (!response.ok || body.status !== "success") {
    throw new Error(
      typeof body.message === "string" ? body.message : "The report could not be found.",
    );
  }
  const data = body.data;
  if (isRecord(data) && Array.isArray(data.reports)) {
    const reports = data.reports.flatMap((item) => {
      const report = getSavedReport({ data: item });
      return report ? [report] : [];
    });
    if (reports.length) return reports;
    throw new Error("No saved reports were found for this phone number.");
  }
  const report = getSavedReport(body);
  if (!report) throw new Error("The service returned an incomplete report.");
  return [report];
}

function ReportDetails({ report }: { report: SavedEntReport }) {
  const analysis: EntAnalysisResult | null = getAnalysisResult(report.analysisResult);
  const urgency = analysis?.clinical?.urgencyLevel
    ? urgencyConfig[analysis.clinical.urgencyLevel]
    : null;
  const condition =
    analysis?.analysis?.primaryCondition?.commonName ??
    analysis?.analysis?.primaryCondition?.name;
  const reportData = reportForDownload(report);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!analysis) return;
    setDownloading(true);
    setDownloadError(null);
    if (!reportData) {
      setDownloadError("This report does not include downloadable assessment details.");
      setDownloading(false);
      return;
    }
    try {
      await downloadPatientReport(reportData);
    } catch {
      setDownloadError("The PDF could not be created. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="assessment-results">
      <section
        className="assessment-urgency-card"
        style={{
          backgroundColor: urgency?.bg ?? "#f8faf9",
          borderColor: urgency?.border ?? "#d8e1e3",
        }}
      >
        <div className="assessment-urgency-heading">
          <div>
            <p className="assessment-urgency-label" style={{ color: urgency?.color ?? "#5f727a" }}>
              {urgency?.label ?? "Urgency not provided"}
            </p>
            <h2>{condition ?? "Assessment guidance"}</h2>
          </div>
          {report.trackingId && (
            <code className="assessment-tracking-id">{report.trackingId}</code>
          )}
        </div>
        <p>
          {analysis?.clinical?.immediateAction ??
            "The service did not provide an immediate action. Please contact a qualified healthcare professional for advice."}
        </p>
      </section>

      <article className="assessment-result-card">
        <span className="assessment-result-index">YOUR SYMPTOMS</span>
        <h3>What you reported</h3>
        <p>{report.symptoms ?? "Symptoms were not included in this saved report."}</p>
        <p className="assessment-report-meta">
          {[
            report.affectedArea,
            report.duration,
            typeof report.age === "number" ? `Age ${report.age}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </article>

      {analysis?.clinical?.redFlags?.length ? (
        <article className="assessment-result-card assessment-red-flags">
          <span className="assessment-result-index">IMPORTANT</span>
          <h3>Seek urgent care if these occur</h3>
          <ul>
            {analysis.clinical.redFlags.map((flag, index) => (
              <li key={`${flag}-${index}`}>{flag}</li>
            ))}
          </ul>
        </article>
      ) : null}

      {analysis?.clinical?.patientAdvice && (
        <article className="assessment-result-card">
          <span className="assessment-result-index">PATIENT ADVICE</span>
          <h3>Further guidance</h3>
          <p>{analysis.clinical.patientAdvice}</p>
        </article>
      )}

      {analysis?.clinical?.specialists?.length ? (
        <article className="assessment-result-card">
          <span className="assessment-result-index">CARE OPTIONS</span>
          <h3>Recommended specialist care</h3>
          <p>{analysis.clinical.specialists.join(", ")}</p>
        </article>
      ) : null}

      <section className="assessment-report-card">
        <div>
          <span className="assessment-result-index">SAVED REPORT</span>
          <h3>Keep a copy of your guidance</h3>
          <p>Download a PDF to keep or share with a healthcare professional.</p>
        </div>
        <button
          type="button"
          className="assessment-continue-button"
          disabled={downloading || !analysis}
          onClick={() => void handleDownload()}
        >
          <Download aria-hidden="true" size={16} />
          {downloading ? "Preparing PDF…" : "Download PDF"}
        </button>
        {analysis && reportData && <EmailReportForm report={reportData} />}
        {downloadError && <p className="assessment-inline-status" role="alert">{downloadError}</p>}
      </section>
    </div>
  );
}

function ReportContent({ trackingId }: { trackingId: string }) {
  const [reports, setReports] = useState<SavedEntReport[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchReports(trackingId)
      .then((loadedReports) => {
        if (active) setReports(loadedReports);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "The report could not be loaded.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [trackingId]);

  if (loading) {
    return (
      <div className="assessment-loading-state" role="status">
        <LoaderCircle aria-hidden="true" size={22} />
        <span>Finding your saved report…</span>
      </div>
    );
  }

  if (error || !reports?.length) {
    return (
      <div className="assessment-error" role="alert">
        <AlertCircle aria-hidden="true" size={18} />
        <span>{error ?? "The report could not be found."}</span>
      </div>
    );
  }

  return (
    <div className="assessment-report-list">
      {reports.length > 1 && (
        <p className="assessment-field-hint">
          Found {reports.length} reports linked to this phone number, newest first.
        </p>
      )}
      {reports.map((report, index) => (
        <section className="assessment-report-list-item" key={report.id ?? report.trackingId ?? index}>
          {reports.length > 1 && (
            <p className="assessment-result-index">
              REPORT {index + 1}
              {report.createdAt
                ? ` · ${new Date(report.createdAt).toLocaleDateString()}`
                : ""}
            </p>
          )}
          <ReportDetails report={report} />
        </section>
      ))}
    </div>
  );
}

export function ReportLookupPage() {
  const [trackingId, setTrackingId] = useState("");
  const [submittedId, setSubmittedId] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const [isPreparingOtp, setIsPreparingOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const otpDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (otpDelayTimerRef.current) clearTimeout(otpDelayTimerRef.current);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = trackingId.trim();
    const phone = normalizeNigerianPhone(input);
    if (phone) {
      if (otpDelayTimerRef.current) clearTimeout(otpDelayTimerRef.current);
      setValidationMessage(null);
      setSubmittedId("");
      setPendingPhone(phone);
      setIsPreparingOtp(true);
      setOtp("");
      setOtpError(null);
      otpDelayTimerRef.current = setTimeout(() => {
        otpDelayTimerRef.current = null;
        setIsPreparingOtp(false);
      }, 900);
      return;
    }

    const normalized = input.toUpperCase();
    if (!reportIdPattern.test(normalized)) {
      setValidationMessage("Enter a Nigerian mobile number or a report ID such as ENT-2026-A3F9C2D1.");
      return;
    }
    if (otpDelayTimerRef.current) clearTimeout(otpDelayTimerRef.current);
    otpDelayTimerRef.current = null;
    setIsPreparingOtp(false);
    setValidationMessage(null);
    setPendingPhone("");
    setSubmittedId(normalized);
  };

  const handleVerifyOtp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (otp.trim() !== REPORT_VERIFICATION_CODE) {
      setOtpError("That code is incorrect. Check your message and try again.");
      return;
    }
    setOtpError(null);
    setSubmittedId(pendingPhone);
    setPendingPhone("");
  };

  return (
    <main className="assessment-page">
      <PatientPageHeader />
      <div className="assessment-shell">
        <div className="assessment-intro">
          <div className="assessment-intro-copy">
            <p className="assessment-eyebrow"><span className="eyebrow-rule" /> REPORT ACCESS</p>
            <h1>Find your saved report.</h1>
            <p className="assessment-lede">
              Enter your phone number to securely access your saved reports, or use a report ID.
            </p>
          </div>
        </div>
        <section className="assessment-workspace report-lookup-workspace">
          <div className="assessment-form-panel">
            <form className="assessment-report-lookup" onSubmit={handleSubmit}>
              <label className="assessment-field-heading" htmlFor="report-id">
                <span className="assessment-field-number">01</span>
                Phone number or report ID
              </label>
              <p className="assessment-field-hint">
                Use the Nigerian mobile number linked to your report, or enter a report ID.
              </p>
              <input
                id="report-id"
                type="text"
                value={trackingId}
                onChange={(event) => setTrackingId(event.target.value)}
                className="assessment-text-input"
                autoComplete="off"
                spellCheck={false}
                placeholder="09154996570 or ENT-2026-A3F9C2D1"
              />
              {validationMessage && (
                <p className="assessment-inline-status" role="alert">{validationMessage}</p>
              )}
              <button type="submit" className="assessment-continue-button" disabled={isPreparingOtp}>
                {isPreparingOtp
                  ? <LoaderCircle aria-hidden="true" size={16} />
                  : <FileSearch aria-hidden="true" size={16} />}
                {isPreparingOtp ? "Checking your number…" : "Continue"}
              </button>
            </form>

            {isPreparingOtp && (
              <div className="assessment-otp-preparing" role="status" aria-live="polite">
                <LoaderCircle aria-hidden="true" size={20} />
                <span>Preparing phone verification…</span>
              </div>
            )}

            {pendingPhone && !isPreparingOtp && (
              <form className="assessment-demo-otp" onSubmit={handleVerifyOtp}>
                <span className="assessment-result-index">PHONE VERIFICATION</span>
                <h2>Enter your verification code</h2>
                <p>
                  A verification OTP has been sent to your phone number.
                </p>
                <label className="assessment-field-heading" htmlFor="report-otp">
                  Verification code
                </label>
                <input
                  id="report-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => {
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                    setOtpError(null);
                  }}
                  className="assessment-text-input assessment-otp-input"
                  placeholder="6-digit code"
                  required
                />
                {otpError && <p className="assessment-inline-status" role="alert">{otpError}</p>}
                <div className="assessment-demo-otp-actions">
                  <button type="submit" className="assessment-continue-button">
                    Verify and find reports
                  </button>
                  <button
                    type="button"
                    className="assessment-back-button"
                    onClick={() => {
                      setPendingPhone("");
                      setOtp("");
                      setOtpError(null);
                    }}
                  >
                    Change phone number
                  </button>
                </div>
              </form>
            )}

            {submittedId && (
              <div className="assessment-saved-report">
                <ReportContent trackingId={submittedId} />
              </div>
            )}
          </div>
          <aside className="assessment-side-panel">
            <div className="assessment-preview">
              <p className="assessment-side-kicker"><span className="live-dot" /> REPORT ACCESS</p>
              <div className="assessment-report-illustration" aria-hidden="true">
                <FileSearch size={48} strokeWidth={1.4} />
              </div>
              <h2>Your phone, your reports.</h2>
              <p>Verify the phone number linked to your report to find saved guidance.</p>
            </div>
            <div className="assessment-side-note">
              <span className="assessment-note-mark" aria-hidden="true">i</span>
              <p>
                <strong>Need a new assessment?</strong>
                <span>Start over with the symptoms you are experiencing now.</span>
                <Link href="/assessment">Start symptom check <ArrowRight size={13} /></Link>
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

export function SavedReportPage({ trackingId }: { trackingId: string }) {
  const reportId = useMemo(() => decodeURIComponent(trackingId).trim().toUpperCase(), [trackingId]);
  return (
    <main className="assessment-page">
      <PatientPageHeader />
      <div className="assessment-shell">
        <div className="assessment-intro">
          <div className="assessment-intro-copy">
            <p className="assessment-eyebrow"><span className="eyebrow-rule" /> SAVED GUIDANCE</p>
            <h1>Your report.</h1>
            <p className="assessment-lede">
              Review the service-provided guidance below, or download a copy for your records.
            </p>
          </div>
        </div>
        <section className="assessment-workspace report-lookup-workspace">
          <div className="assessment-form-panel">
            <ReportContent trackingId={reportId} />
            <div className="assessment-form-footer">
              <Link href="/report" className="assessment-back-button">
                <ArrowRight aria-hidden="true" className="rotate-left" size={16} />
                Look up another report
              </Link>
              <Link href="/assessment" className="assessment-continue-button">
                Start assessment <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </div>
          </div>
          <aside className="assessment-side-panel">
            <div className="assessment-preview">
              <p className="assessment-side-kicker"><span className="live-dot" /> REPORT ID</p>
              <h2 className="assessment-report-id-large">{reportId}</h2>
              <p>This ID identifies the saved report. Keep it private and share it only with people you trust.</p>
            </div>
            <div className="assessment-side-note">
              <span className="assessment-note-mark" aria-hidden="true">i</span>
              <p>
                <strong>Guidance, not a diagnosis.</strong>
                <span>Speak with a healthcare professional about diagnosis and treatment.</span>
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
