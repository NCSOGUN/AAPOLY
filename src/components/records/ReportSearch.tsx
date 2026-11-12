import { useState } from "react";
import { AlertCircle, CalendarClock, FileText, LoaderCircle, Printer, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getPatientReport } from "@/lib/api";
import { printWithClass } from "@/lib/print";
import logo from "../../../assets/aap-logo-img.png";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown, key?: string): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (key && /date|time|created|updated/i.test(key)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toLocaleString();
    }
    return value;
  }
  return "";
}

function ReportDetails({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (depth > 6) return <p className="remote-report-empty">Additional nested details omitted.</p>;
  if (Array.isArray(value)) {
    if (!value.length) return <p className="remote-report-empty">None reported.</p>;
    const allSimple = value.every(
      (item) => item === null || ["string", "number", "boolean"].includes(typeof item),
    );
    if (allSimple) {
      return (
        <ul className="remote-report-list">
          {value.map((item, index) => <li key={index}>{formatValue(item)}</li>)}
        </ul>
      );
    }
    return (
      <div className="remote-report-array">
        {value.map((item, index) => (
          <div className="remote-report-array-item" key={index}>
            {isRecord(item) ? <ReportDetails value={item} depth={depth + 1} /> : formatValue(item)}
          </div>
        ))}
      </div>
    );
  }
  if (!isRecord(value)) return <p className="remote-report-value">{formatValue(value)}</p>;

  const entries = Object.entries(value).filter(([, item]) => item !== undefined);
  if (!entries.length) return <p className="remote-report-empty">No details provided.</p>;
  return (
    <dl className={`remote-report-fields${depth ? " nested" : ""}`}>
      {entries.map(([key, item]) => {
        const label = formatLabel(key);
        if (isRecord(item) || Array.isArray(item)) {
          return (
            <div className="remote-report-nested" key={key}>
              <h4>{label}</h4>
              <ReportDetails value={item} depth={depth + 1} />
            </div>
          );
        }
        return (
          <div className="remote-report-field" key={key}>
            <dt>{label}</dt>
            <dd>{formatValue(item, key)}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function recordValue(report: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = report[key];
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
  return "";
}

export function ReportSearch({ token, facilityName }: { token: string; facilityName: string }) {
  const [trackingId, setTrackingId] = useState("");
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [printError, setPrintError] = useState("");

  async function printReport() {
    setPrintError("");
    try {
      await printWithClass("print-remote-report", ".remote-report-card");
    } catch (requestError) {
      setPrintError(
        requestError instanceof Error ? requestError.message : "Could not print the patient report.",
      );
    }
  }

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = trackingId.trim();
    if (!id) {
      setError("Enter the patient's tracking ID.");
      return;
    }
    setError("");
    setReport(null);
    setIsLoading(true);
    try {
      setReport(await getPatientReport(token, id));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load the patient report.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const reportId = report ? recordValue(report, "trackingId", "tracking_id", "id") || trackingId.trim() : "";
  const createdAt = report ? recordValue(report, "createdAt", "created_at", "updatedAt") : "";
  const status = report ? recordValue(report, "status", "reportStatus") : "";
  const metadataKeys = new Set(["trackingId", "tracking_id", "id", "createdAt", "created_at", "updatedAt", "status", "reportStatus"]);
  const mainDetails = report
    ? Object.fromEntries(Object.entries(report).filter(([key]) => !metadataKeys.has(key)))
    : {};

  return (
    <div className="workspace-panel">
      <div className="panel-title">
        <div>
          <h2>Find a patient report</h2>
          <p>Retrieve the submitted assessment using the tracking ID on the patient's report.</p>
        </div>
      </div>
      <Card className="panel-card">
        <form className="report-search-form" onSubmit={(event) => void search(event)}>
          <label className="field">
            <span className="field-label">Patient tracking ID</span>
            <Input
              className="field-control"
              value={trackingId}
              onChange={(event) => setTrackingId(event.target.value)}
              placeholder="e.g. ENT-2026-A3F9C2D1"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <LoaderCircle size={15} className="spin" /> : <Search size={15} />}
            {isLoading ? "Searching…" : "Search report"}
          </Button>
        </form>
        {error && <div className="panel-error" role="alert"><AlertCircle size={16} />{error}</div>}
      </Card>
      {report && (
        <Card className="remote-report-card">
          <img className="print-watermark report-print-watermark" src={logo} alt="" aria-hidden="true" />
          <header className="report-print-letterhead">
            <img src={logo} alt="Abraham Adesanya Polytechnic" />
            <div>
              <strong>ABRAHAM ADESANYA POLYTECHNIC</strong>
              <span>{facilityName}</span>
              <h1>Patient clinical report</h1>
            </div>
            <div className="report-print-reference">
              <span>REPORT REFERENCE</span>
              <strong>{reportId}</strong>
              <span>{createdAt ? formatValue(createdAt, "createdAt") : "Date not recorded"}</span>
            </div>
          </header>
          <header className="remote-report-heading">
            <span className="remote-report-icon"><FileText size={19} /></span>
            <div className="remote-report-title">
              <span className="section-kicker">PATIENT REPORT</span>
              <h3>Clinical assessment report</h3>
              <p>Tracking ID: <strong>{reportId}</strong></p>
            </div>
            {status && <span className="remote-report-status">{formatLabel(status)}</span>}
            <Button
              type="button"
              variant="outline"
              className="remote-report-print"
              onClick={() => void printReport()}
            >
              <Printer size={15} /> Print report
            </Button>
          </header>
          <div className="remote-report-meta">
            <div><FileText size={15} /><span><small>Report reference</small><strong>{reportId}</strong></span></div>
            {createdAt && <div><CalendarClock size={15} /><span><small>Created</small><strong>{formatValue(createdAt, "createdAt")}</strong></span></div>}
          </div>
          <section className="remote-report-section">
            <h4>Assessment details</h4>
            <ReportDetails value={mainDetails} />
          </section>
          <p className="remote-report-disclaimer">
            <ShieldCheck size={15} />
            Review this report as clinical decision support. It is not a confirmed diagnosis and does not replace professional judgement.
          </p>
          <footer className="report-print-footer">
            <strong>CONFIDENTIAL CLINICAL INFORMATION</strong>
            <span>For authorised healthcare use. Verify all clinical details before making care decisions.</span>
          </footer>
          {printError && <p className="print-action-error" role="alert">{printError}</p>}
        </Card>
      )}
    </div>
  );
}
