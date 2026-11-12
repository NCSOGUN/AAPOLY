import { useEffect, useState } from "react";
import { AlertCircle, FileText, LoaderCircle, Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SecureSessionVault } from "@/lib/sessionStore";
import { DiagnosisWorkspace } from "@/components/DiagnosisWorkspace";
import type { HospitalFacility } from "@/lib/api";

type PatientVisit = {
  id: string;
  createdAt: string;
  data: Record<string, unknown>;
  hasDiagnosis?: boolean;
};

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").join(", ");
  }
  return "";
}

function displayDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export function PatientVisits({
  vault,
  token,
  isOffline,
  facility,
  onEditVisit,
}: {
  vault: SecureSessionVault;
  token: string;
  isOffline: boolean;
  facility: HospitalFacility;
  onEditVisit: (visitId: string, data: Record<string, unknown>) => void;
}) {
  const [visits, setVisits] = useState<PatientVisit[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unavailableCount, setUnavailableCount] = useState(0);
  const [diagnosis, setDiagnosis] = useState<Record<string, unknown> | null>(null);
  const [diagnosisVisitId, setDiagnosisVisitId] = useState("");
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState("");

  async function viewDiagnosis(visit: PatientVisit) {
    setDiagnosis(null);
    setDiagnosisError("");
    setDiagnosisLoading(true);
    setDiagnosisVisitId(visit.id);
    setSelectedId(visit.id);
    try {
      const report = await vault.getPatientDiagnosis(visit.id);
      if (!report) {
        setDiagnosisError("This visit does not have a saved diagnosis report.");
        return;
      }
      setDiagnosis(report);
    } catch (requestError) {
      setDiagnosisError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load the saved diagnosis report.",
      );
    } finally {
      setDiagnosisLoading(false);
    }
  }

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const saved = await vault.listPatientVisits();
      setVisits(saved.records);
      setUnavailableCount(saved.unavailableCount);
      setSelectedId((current) =>
        saved.records.some((visit) => visit.id === current) ? current : "",
      );
    } catch (requestError) {
      setVisits([]);
      setUnavailableCount(0);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load saved patient visits.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [vault]);

  const selectedVisit = visits.find((visit) => visit.id === selectedId);

  return (
    <div className="workspace-panel">
      <div className="panel-title">
        <div>
          <h2>Saved patient visits</h2>
          <p>Records saved on this device. Patient details are decrypted only while your workspace is unlocked.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </Button>
      </div>
      {error && <div className="panel-error" role="alert"><AlertCircle size={16} />{error}</div>}
      {unavailableCount > 0 && (
        <div className="panel-notice" role="status">
          <AlertCircle size={16} />
          {unavailableCount === 1
            ? "One older visit could not be restored because its encrypted patient details are missing or unreadable. Other available visits are still shown."
            : `${unavailableCount} older visits could not be restored because their encrypted patient details are missing or unreadable. Other available visits are still shown.`}
        </div>
      )}
      {loading ? (
        <div className="panel-loading"><LoaderCircle size={18} className="spin" /> Loading saved visits…</div>
      ) : visits.length === 0 ? (
        <Card className="empty-panel">
          <h3>{unavailableCount ? "No restorable visits found" : "No saved visits on this device"}</h3>
          <p>{unavailableCount
            ? "The older visit entries do not have readable encrypted patient details, so they cannot be reopened. New visits will be saved securely as you work."
            : "Intake drafts and completed visits are saved here as you work. They are not sent to the ENT-Care service."}</p>
        </Card>
      ) : (
        <div className="visit-workspace">
          <div className="visit-list">
            {visits.map((visit) => {
              const patientName = [text(visit.data.firstName), text(visit.data.lastName)]
                .filter(Boolean)
                .join(" ") || "Patient";
              return (
                <div className="visit-list-entry" key={visit.id}>
                  <button
                    type="button"
                    className={`visit-list-item${selectedId === visit.id ? " selected" : ""}`}
                    onClick={() => {
                      setSelectedId(visit.id);
                      setDiagnosis(null);
                      setDiagnosisVisitId("");
                      setDiagnosisError("");
                    }}
                  >
                    <strong>{patientName}</strong>
                    <span>{displayDate(visit.createdAt)}</span>
                    <small>{text(visit.data.complaint) || "Draft intake"}</small>
                  </button>
                  <div className="visit-list-actions">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onEditVisit(visit.id, visit.data)}
                    >
                      <Pencil size={13} /> Continue editing
                    </Button>
                    {visit.hasDiagnosis && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void viewDiagnosis(visit)}
                      >
                        <FileText size={13} /> View diagnosis
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {selectedVisit ? (
            <Card className="visit-detail">
              <div className="report-card-heading">
                <div>
                  <span className="section-kicker">LOCAL PATIENT VISIT</span>
                  <h3>{[text(selectedVisit.data.firstName), text(selectedVisit.data.lastName)].filter(Boolean).join(" ") || "Patient"}</h3>
                </div>
                <span className="report-source">{displayDate(selectedVisit.createdAt)}</span>
              </div>
              <dl className="report-fields">
                {[
                  ["Date of birth", text(selectedVisit.data.dateOfBirth)],
                  ["Sex", text(selectedVisit.data.sex)],
                  ["Phone", text(selectedVisit.data.phone)],
                  ["Email", text(selectedVisit.data.email)],
                  ["Address", text(selectedVisit.data.address)],
                  ["Emergency contact", text(selectedVisit.data.emergencyContact)],
                  ["Main concern", text(selectedVisit.data.complaint)],
                  ["Affected areas", text(selectedVisit.data.symptomAreas)],
                  ["Symptoms", text(selectedVisit.data.symptoms)],
                  ["Other symptoms", text(selectedVisit.data.otherSymptoms)],
                  ["Onset", text(selectedVisit.data.onset)],
                  ["Pain level", text(selectedVisit.data.painLevel)],
                  ["Daily impact", text(selectedVisit.data.dailyImpact)],
                  ["Medical history", text(selectedVisit.data.medicalHistory)],
                  ["Allergies", text(selectedVisit.data.allergies)],
                  ["Medications", text(selectedVisit.data.medications)],
                  ["Previous treatment", text(selectedVisit.data.previousTreatment)],
                  ["Immediate attention symptoms", text(selectedVisit.data.emergencySymptoms)],
                  ["Report tracking ID", text(selectedVisit.data.reportTrackingId)],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div className="report-field" key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
              </dl>
              <p className="report-disclaimer">Stored encrypted on this device · Not synced to the service</p>
              {diagnosisVisitId === selectedVisit.id && diagnosisLoading && (
                <div className="panel-loading"><LoaderCircle size={16} className="spin" /> Loading saved diagnosis…</div>
              )}
              {diagnosisVisitId === selectedVisit.id && diagnosisError && (
                <div className="panel-error" role="alert"><AlertCircle size={15} />{diagnosisError}</div>
              )}
              {diagnosisVisitId === selectedVisit.id && diagnosis && (
                <DiagnosisWorkspace
                  token={token}
                  intake={{
                    patientName: [
                      text(selectedVisit.data.firstName),
                      text(selectedVisit.data.lastName),
                    ].filter(Boolean).join(" ") || "Patient",
                    email: text(selectedVisit.data.email),
                    dateOfBirth: text(selectedVisit.data.dateOfBirth),
                    complaint: text(selectedVisit.data.complaint),
                    symptomAreas: Array.isArray(selectedVisit.data.symptomAreas)
                      ? selectedVisit.data.symptomAreas.filter((item): item is string => typeof item === "string")
                      : [],
                    symptoms: Array.isArray(selectedVisit.data.symptoms)
                      ? selectedVisit.data.symptoms.filter((item): item is string => typeof item === "string")
                      : [],
                    otherSymptoms: text(selectedVisit.data.otherSymptoms),
                    onset: text(selectedVisit.data.onset),
                    painLevel: text(selectedVisit.data.painLevel),
                    dailyImpact: text(selectedVisit.data.dailyImpact),
                    medicalHistory: text(selectedVisit.data.medicalHistory),
                    allergies: text(selectedVisit.data.allergies),
                    medications: text(selectedVisit.data.medications),
                    previousTreatment: text(selectedVisit.data.previousTreatment),
                    emergencySymptoms: Array.isArray(selectedVisit.data.emergencySymptoms)
                      ? selectedVisit.data.emergencySymptoms.filter((item): item is string => typeof item === "string")
                      : [],
                  }}
                  imageFiles={[]}
                  visitId={selectedVisit.id}
                  vault={vault}
                  isOffline={isOffline}
                  facility={facility}
                  initialReport={{
                    ...diagnosis,
                    trackingId:
                      text(selectedVisit.data.reportTrackingId) || text(diagnosis.trackingId),
                  }}
                  viewOnly
                />
              )}
            </Card>
          ) : (
            <Card className="empty-panel"><h3>Select a visit</h3><p>Choose a record to review its details.</p></Card>
          )}
        </div>
      )}
    </div>
  );
}
