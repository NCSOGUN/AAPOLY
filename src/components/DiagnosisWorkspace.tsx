import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  FileText,
  LoaderCircle,
  Printer,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import {
  analyzeClinicalImage,
  analyzePatient,
  ApiError,
  consentToEscalation,
  saveDiagnosisReport,
  type DiagnosisRequest,
  type DiagnosisReportRequest,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { SecureSessionVault } from "@/lib/sessionStore";
import { cn } from "@/lib/utils";
import { printWithClass } from "@/lib/print";
import logo from "../../assets/aap-logo-img.png";

type DiagnosisIntake = {
  patientName: string;
  email?: string;
  dateOfBirth: string;
  complaint: string;
  symptomAreas: string[];
  symptoms: string[];
  otherSymptoms?: string;
  onset?: string;
  painLevel?: string;
  dailyImpact?: string;
  medicalHistory?: string;
  allergies?: string;
  medications?: string;
  previousTreatment?: string;
  emergencySymptoms: string[];
};

type ImageAnalysis = {
  fileName: string;
  data: Record<string, unknown>;
};

type ExecutionStep = {
  label: string;
  status: "active" | "complete" | "error";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error(`Could not read ${file.name} as an image.`));
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name} as an image.`));
    reader.readAsDataURL(file);
  });
}

function patientAge(dateOfBirth: string): number | undefined {
  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  if (!dateOfBirth || Number.isNaN(birthDate.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }
  return age >= 0 && age <= 130 ? age : undefined;
}

function onsetPattern(value: string | undefined): DiagnosisRequest["onsetPattern"] {
  const onset = value?.toLowerCase() ?? "";
  if (/sudden|abrupt|all at once/.test(onset)) return "sudden";
  if (/gradual|slowly|over time/.test(onset)) return "gradual";
  if (/episodic|intermittent|comes and goes/.test(onset)) return "episodic";
  if (/chronic|month|year/.test(onset)) return "chronic";
  return undefined;
}

function isDiagnosisRequest(value: unknown): value is DiagnosisRequest {
  return (
    isRecord(value) &&
    typeof value.symptoms === "string" &&
    value.includeNearby === false &&
    typeof value.limit === "number"
  );
}

function savedImageAnalyses(value: unknown): ImageAnalysis[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ImageAnalysis =>
      isRecord(item) && typeof item.fileName === "string" && isRecord(item.data),
  );
}

function primaryCondition(result: Record<string, unknown>) {
  const analysis = isRecord(result.analysis) ? result.analysis : undefined;
  return analysis && isRecord(analysis.primaryCondition) ? analysis.primaryCondition : undefined;
}

function reportRequest(
  diagnosis: DiagnosisRequest,
  result: Record<string, unknown>,
): DiagnosisReportRequest {
  const condition = primaryCondition(result);
  const clinical = isRecord(result.clinical) ? result.clinical : {};
  const urgencyScore = typeof clinical.urgencyScore === "number" ? clinical.urgencyScore : undefined;
  const urgencyLevel = text(clinical.urgencyLevel) || undefined;
  const referralThreshold = text(clinical.referralThreshold) || undefined;
  return {
    ...diagnosis,
    analysisResult: result,
    patientProfileId: null,
    ...(text(condition?.id) ? { primaryConditionId: text(condition?.id) } : {}),
    ...(text(condition?.name) ? { primaryConditionName: text(condition?.name) } : {}),
    ...(urgencyScore !== undefined ? { urgencyScore } : {}),
    ...(urgencyLevel ? { urgencyLevel } : {}),
    ...(referralThreshold ? { referralThreshold } : {}),
  };
}

function renderList(title: string, value: unknown) {
  const items = stringList(value);
  if (!items.length) return null;
  return (
    <section className="diagnosis-result-section">
      <h4>{title}</h4>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}

export function DiagnosisWorkspace({
  token,
  intake,
  imageFiles,
  visitId,
  vault,
  isOffline,
  facility,
  initialReport,
  viewOnly = false,
}: {
  token: string;
  intake: DiagnosisIntake;
  imageFiles: File[];
  visitId: string;
  vault: SecureSessionVault;
  isOffline: boolean;
  facility: { name?: string; latitude?: number; longitude?: number };
  initialReport?: Record<string, unknown>;
  viewOnly?: boolean;
}) {
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);
  const [imageConsent, setImageConsent] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(() =>
    isRecord(initialReport?.analysis) ? initialReport.analysis : null,
  );
  const [diagnosisInput, setDiagnosisInput] = useState<DiagnosisRequest | null>(() =>
    isDiagnosisRequest(initialReport?.diagnosisInput) ? initialReport.diagnosisInput : null,
  );
  const [imageAnalyses, setImageAnalyses] = useState<ImageAnalysis[]>(() =>
    savedImageAnalyses(initialReport?.imageAnalyses),
  );
  const [trackingId, setTrackingId] = useState(() => text(initialReport?.trackingId));
  const [analysisError, setAnalysisError] = useState("");
  const [reportError, setReportError] = useState("");
  const [linkError, setLinkError] = useState("");
  const [localReportError, setLocalReportError] = useState("");
  const [printError, setPrintError] = useState("");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [escalationConsent, setEscalationConsent] = useState(false);
  const [escalationEmail, setEscalationEmail] = useState(intake.email ?? "");
  const [escalating, setEscalating] = useState(false);
  const [escalationDone, setEscalationDone] = useState(false);
  const [escalationError, setEscalationError] = useState("");

  useEffect(() => {
    const updateOnline = () => {
      setBrowserOnline(navigator.onLine);
      if (navigator.onLine) {
        setAnalysisError((current) =>
          current.startsWith("Diagnosis requires an internet connection.") ? "" : current,
        );
      }
    };
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  const offline = isOffline || !browserOnline;
  const area = intake.symptomAreas[0]?.toLowerCase();
  const affectedArea =
    area === "ear" || area === "nose" || area === "throat" ? area : undefined;

  function makeDiagnosisRequest(): DiagnosisRequest {
    const symptoms = [
      intake.complaint.trim(),
      intake.symptoms.length ? `Reported symptoms: ${intake.symptoms.join(", ")}.` : "",
      intake.otherSymptoms?.trim() ? `Additional symptoms: ${intake.otherSymptoms.trim()}.` : "",
      intake.symptomAreas.length > 1
        ? `Other affected areas: ${intake.symptomAreas.slice(1).join(", ")}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    const context = [
      intake.medicalHistory?.trim() ? `Medical history: ${intake.medicalHistory.trim()}` : "",
      intake.allergies?.trim() ? `Allergies: ${intake.allergies.trim()}` : "",
      intake.medications?.trim() ? `Current medications: ${intake.medications.trim()}` : "",
      intake.previousTreatment?.trim() ? `Previous treatment: ${intake.previousTreatment.trim()}` : "",
      intake.dailyImpact?.trim() ? `Daily impact: ${intake.dailyImpact.trim()}` : "",
      intake.painLevel ? `Reported pain level: ${intake.painLevel}/10` : "",
      intake.emergencySymptoms.length
        ? `Reported urgent symptoms: ${intake.emergencySymptoms.join(", ")}`
        : "",
    ].filter(Boolean);

    return {
      symptoms,
      ...(affectedArea ? { affectedArea } : {}),
      ...(intake.onset?.trim() ? { duration: intake.onset.trim() } : {}),
      ...(onsetPattern(intake.onset) ? { onsetPattern: onsetPattern(intake.onset) } : {}),
      ...(patientAge(intake.dateOfBirth) !== undefined
        ? { age: patientAge(intake.dateOfBirth) }
        : {}),
      ...(context.length ? { additionalContext: context.join(". ") } : {}),
      ...(typeof facility.latitude === "number" && Number.isFinite(facility.latitude)
        ? { latitude: facility.latitude }
        : {}),
      ...(typeof facility.longitude === "number" && Number.isFinite(facility.longitude)
        ? { longitude: facility.longitude }
        : {}),
      includeNearby: false,
      limit: 5,
    };
  }

  async function linkSavedReport(id: string) {
    setLinkError("");
    try {
      await vault.linkPatientVisitReport(visitId, id);
    } catch (error) {
      setLinkError(
        error instanceof Error
          ? `The report was saved, but could not be linked to the local visit: ${error.message}`
          : "The report was saved, but could not be linked to the local visit.",
      );
    }
  }

  async function saveReport(
    result: Record<string, unknown>,
    diagnosis: DiagnosisRequest,
    analyzedImages: ImageAnalysis[],
  ): Promise<boolean> {
    setSavingReport(true);
    setReportError("");
    try {
      const saved = await saveDiagnosisReport(
        token,
        reportRequest(diagnosis, result),
      );
      setTrackingId(saved.trackingId);
      setLinkError("");
      setLocalReportError("");
      const localReport = {
        analysis: result,
        diagnosisInput: diagnosis,
        imageAnalyses: analyzedImages,
        trackingId: saved.trackingId,
      };
      const localErrors: string[] = [];
      try {
        await vault.linkPatientVisitReport(visitId, saved.trackingId);
      } catch (error) {
        localErrors.push(
          error instanceof Error ? error.message : "The tracking ID could not be linked locally.",
        );
        setLinkError(`The report was saved online, but its local link failed: ${localErrors[0]}`);
      }
      try {
        await vault.savePatientDiagnosis(visitId, localReport);
      } catch (error) {
        localErrors.push(
          error instanceof Error ? error.message : "The report could not be saved locally.",
        );
        setLocalReportError(`The report was saved online, but could not be saved locally: ${localErrors.at(-1)}`);
      }
      return localErrors.length === 0;
    } catch (error) {
      setReportError(
        error instanceof Error ? error.message : "Could not save the clinical report.",
      );
      return false;
    } finally {
      setSavingReport(false);
    }
  }

  async function runDiagnosis() {
    setAnalysisError("");
    if (offline) {
      setAnalysisError(
        "Diagnosis requires an internet connection. Please connect to run a clinical analysis.",
      );
      return;
    }
    if (imageFiles.length > 0 && !imageConsent) {
      setAnalysisError("Confirm the patient's consent before sending clinical images for analysis.");
      return;
    }

    setAnalyzing(true);
    setProgress(4);
    setProgressLabel("Preparing the clinical details");
    setExecutionSteps([{ label: "Preparing patient details and consent", status: "active" }]);
    setAnalysis(null);
    setDiagnosisInput(null);
    setImageAnalyses([]);
    setTrackingId("");
    setReportError("");
    setLinkError("");
    setLocalReportError("");
    try {
      const diagnosis = makeDiagnosisRequest();
      const completedSteps: ExecutionStep[] = [
        { label: "Preparing patient details and consent", status: "complete" },
      ];
      const completedImages: ImageAnalysis[] = [];
      setExecutionSteps(completedSteps);
      setProgress(12);

      for (const [index, file] of imageFiles.entries()) {
        const label = `Analyzing clinical image ${index + 1} of ${imageFiles.length}`;
        setProgressLabel(label);
        setExecutionSteps([...completedSteps, { label, status: "active" }]);
        const data = await fileAsDataUrl(file);
        const result = await analyzeClinicalImage(
          token,
          data,
          affectedArea ?? "general",
          diagnosis.additionalContext
            ? `${diagnosis.symptoms} ${diagnosis.additionalContext}`
            : diagnosis.symptoms,
        );
        completedImages.push({ fileName: file.name, data: result });
        setImageAnalyses([...completedImages]);
        completedSteps.push({ label, status: "complete" });
        setExecutionSteps([...completedSteps]);
        setProgress(Math.min(25, 12 + Math.round((13 * (index + 1)) / imageFiles.length)));
      }

      const clinicalStep = "Considering symptoms and affected area";
      const causeStep = "Checking possible causes and differential findings";
      const recommendationsStep = "Preparing urgency, red flags and recommended next steps";
      setProgressLabel(clinicalStep);
      setExecutionSteps([
        ...completedSteps,
        { label: "Submitting symptoms for clinical analysis", status: "active" },
      ]);
      setProgress((current) => Math.max(32, current));
      const progressPhases = [clinicalStep, causeStep, recommendationsStep];
      let progressPhaseIndex = 0;
      let progressTicks = 0;
      const progressTimer = window.setInterval(() => {
        setProgress((current) => Math.min(82, current + 1));
        progressTicks += 1;
        if (progressTicks % 6 === 0) {
          progressPhaseIndex = (progressPhaseIndex + 1) % progressPhases.length;
          setProgressLabel(progressPhases[progressPhaseIndex]);
        }
      }, 500);
      let result: Record<string, unknown>;
      try {
        result = await analyzePatient(token, diagnosis);
      } finally {
        window.clearInterval(progressTimer);
      }
      completedSteps.push(
        { label: clinicalStep, status: "complete" },
        { label: causeStep, status: "complete" },
        { label: recommendationsStep, status: "complete" },
      );
      setExecutionSteps(completedSteps);
      setProgress(86);
      setProgressLabel("Saving the diagnosis and report");
      setDiagnosisInput(diagnosis);
      setAnalysis(result);
      setImageAnalyses(completedImages);
      try {
        await vault.savePatientDiagnosis(visitId, {
          analysis: result,
          diagnosisInput: diagnosis,
          imageAnalyses: completedImages,
        });
      } catch (error) {
        setLocalReportError(
          error instanceof Error
            ? `Diagnosis completed, but local saving failed: ${error.message}`
            : "Diagnosis completed, but local saving failed.",
        );
      }
      const reportSaved = await saveReport(result, diagnosis, completedImages);
      if (reportSaved) {
        setProgress(100);
        setProgressLabel("Analysis and report saved");
        setExecutionSteps((current) => [
          ...current,
          { label: "Saving the report and linking it to the visit", status: "complete" },
        ]);
      } else {
        setExecutionSteps((current) => [
          ...current,
          { label: "Saving the report and linking it to the visit", status: "error" },
        ]);
      }
    } catch (error) {
      setExecutionSteps((current) => [
        ...current.map((step) =>
          step.status === "active" ? { ...step, status: "error" as const } : step,
        ),
      ]);
      setProgressLabel("Analysis stopped before it could complete");
      setAnalysisError(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Could not complete the clinical analysis. Please try again.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  async function retryReportSave() {
    if (!analysis || !diagnosisInput) return;
    await saveReport(analysis, diagnosisInput, imageAnalyses);
  }

  async function retryLocalLink() {
    if (trackingId) {
      await linkSavedReport(trackingId);
      if (analysis && diagnosisInput) {
        try {
          await vault.savePatientDiagnosis(visitId, {
            analysis,
            diagnosisInput,
            imageAnalyses,
            trackingId,
          });
          setLocalReportError("");
        } catch (error) {
          setLocalReportError(
            error instanceof Error ? error.message : "Could not save the report locally.",
          );
        }
      }
    }
  }

  async function submitEscalationConsent() {
    const escalation = analysis && isRecord(analysis.escalation) ? analysis.escalation : {};
    const caseId = text(escalation.caseId);
    if (!caseId) {
      setEscalationError("This complex case does not include a specialist review reference. Contact support.");
      return;
    }
    if (!escalationConsent) {
      setEscalationError("Confirm the patient's consent before requesting specialist review.");
      return;
    }
    setEscalating(true);
    setEscalationError("");
    try {
      await consentToEscalation(token, caseId, escalationEmail);
      setEscalationDone(true);
    } catch (error) {
      setEscalationError(
        error instanceof Error ? error.message : "Could not request specialist review.",
      );
    } finally {
      setEscalating(false);
    }
  }

  async function printReport() {
    setPrintError("");
    try {
      await printWithClass("print-diagnosis", ".diagnosis-report");
    } catch (error) {
      setPrintError(
        error instanceof Error ? error.message : "Could not print the diagnosis report.",
      );
    }
  }

  const resultAnalysis = analysis && isRecord(analysis.analysis) ? analysis.analysis : {};
  const condition = analysis ? primaryCondition(analysis) : undefined;
  const clinical = analysis && isRecord(analysis.clinical) ? analysis.clinical : {};
  const insights =
    isRecord(resultAnalysis.aiInsights) ? resultAnalysis.aiInsights : {};
  const aiStatus = analysis && isRecord(analysis.aiStatus) ? analysis.aiStatus : {};
  const escalation = analysis && isRecord(analysis.escalation) ? analysis.escalation : {};
  const aiStatusMessages: Record<string, string> = {
    AI_QUOTA_EXCEEDED: "AI analysis unavailable — results are based on the medical database.",
    AI_TIMEOUT: "AI analysis timed out — results are based on the medical database.",
    AI_UNAVAILABLE: "AI analysis is temporarily unavailable.",
    AI_ERROR: "AI analysis encountered an error.",
  };
  const aiStatusMessage =
    text(aiStatus.message) || aiStatusMessages[text(aiStatus.code)] || "";

  return (
    <Card className="diagnosis-workspace diagnosis-report">
      <img className="print-watermark report-print-watermark" src={logo} alt="" aria-hidden="true" />
      <header className="report-print-letterhead">
        <img src={logo} alt="Abraham Adesanya Polytechnic" />
        <div>
          <strong>ABRAHAM ADESANYA POLYTECHNIC</strong>
          <span>{facility.name || "ENT-Care · Clinical Services"}</span>
          <h1>Clinical assessment report</h1>
        </div>
        <div className="report-print-reference">
          <span>REPORT REFERENCE</span>
          <strong>{trackingId || visitId}</strong>
          <span>PRINTED {new Date().toLocaleDateString()}</span>
        </div>
      </header>
      <div className="diagnosis-heading">
        <div className="diagnosis-heading-icon"><Stethoscope size={19} /></div>
        <div>
          <p className="section-kicker">CLINICAL DECISION SUPPORT</p>
          <h2>Diagnosis &amp; report</h2>
          <p>
            {viewOnly
              ? "Locally saved suggested findings for clinician review."
              : "Generate suggested findings for clinician review. This does not replace clinical judgement."}
          </p>
        </div>
      </div>

      {!viewOnly && imageFiles.length > 0 && (
        <label className="diagnosis-consent">
          <input
            type="checkbox"
            checked={imageConsent}
            onChange={(event) => setImageConsent(event.target.checked)}
            disabled={analyzing}
          />
          <span>
            I confirm the patient consented to sharing these images for analysis; images may be
            retained for quality improvement and specialist review.
          </span>
        </label>
      )}

      {analysisError && (
        <div className={cn("diagnosis-notice", offline && "offline")} role="alert">
          <AlertCircle size={16} />
          <span>{analysisError}</span>
        </div>
      )}

      {!viewOnly && (
        <div className="diagnosis-actions">
        {!analysis && (
          <Button type="button" onClick={() => void runDiagnosis()} disabled={analyzing}>
            {analyzing ? <LoaderCircle size={16} className="spin" /> : <Stethoscope size={16} />}
            {analyzing ? "Analyzing…" : "Run clinical analysis"}
          </Button>
        )}
        {offline && !analysisError && !analysis && (
          <span className="diagnosis-online-note">
            Diagnosis requires an internet connection. Please connect to run a clinical analysis.
          </span>
        )}
        </div>
      )}

      {analyzing && (
        <div className="diagnosis-execution" aria-live="polite">
          <div className="diagnosis-progress-heading">
            <strong>{progressLabel}</strong>
            <span>{progress}%</span>
          </div>
          <div
            className="diagnosis-progress-track"
            role="progressbar"
            aria-label="Clinical analysis progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <ol className="diagnosis-execution-steps">
            {executionSteps.map((step) => (
              <li className={`execution-${step.status}`} key={step.label}>
                {step.status === "complete"
                  ? <Check size={14} />
                  : step.status === "error"
                    ? <AlertCircle size={14} />
                    : <LoaderCircle size={14} className="spin" />}
                <span>{step.label}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {imageAnalyses.map(({ fileName, data }, index) => {
        const imageResult = isRecord(data.analysis) ? data.analysis : {};
        const disclaimer =
          text(data.disclaimer) ||
          "This is an AI-assisted preliminary assessment based on the uploaded image. It is not a clinical diagnosis and should not replace professional medical evaluation.";
        return (
          <section className="image-analysis-result" key={`${fileName}-${index}`}>
            <h3>Image findings · {fileName}</h3>
            {renderList("Suggested findings", imageResult.findings)}
            {renderList("Possible conditions", imageResult.possibleConditions)}
            {renderList("Suggested next steps", imageResult.nextSteps)}
            {typeof imageResult.urgencyScore === "number" && (
              <p>Image urgency score: {imageResult.urgencyScore}/10</p>
            )}
            <p className="diagnosis-disclaimer"><ShieldCheck size={14} />{disclaimer}</p>
            {text(data.consentNotice) && (
              <p className="diagnosis-consent-notice">{text(data.consentNotice)}</p>
            )}
          </section>
        );
      })}

      {analysis && (
        <div className="diagnosis-results">
          <div className="report-card-heading diagnosis-report-heading">
            <div>
              <span className="section-kicker">SUGGESTED FINDINGS</span>
              <h3>{text(condition?.name) || "Clinical analysis"}</h3>
              {text(condition?.commonName) && <p>{text(condition?.commonName)}</p>}
              <p>Patient: {intake.patientName || "Patient"}</p>
            </div>
            <div className="diagnosis-heading-meta">
              {text(resultAnalysis.confidence) && (
                <span>{text(resultAnalysis.confidence)} confidence</span>
              )}
              {text(clinical.urgencyLevel) && (
                <span>Urgency: {text(clinical.urgencyLevel)}{typeof clinical.urgencyScore === "number" ? ` (${clinical.urgencyScore}/10)` : ""}</span>
              )}
            </div>
          </div>

          {aiStatusMessage && (
            <div className="diagnosis-status-note">
              <AlertCircle size={15} />
              <span>{aiStatusMessage}</span>
            </div>
          )}
          {aiStatus.available === false && !aiStatusMessage && (
            <div className="diagnosis-status-note">
              <AlertCircle size={15} />
              <span>AI analysis is unavailable — review the results from the medical database.</span>
            </div>
          )}
          {text(resultAnalysis.method) === "fallback" && (
            <div className="diagnosis-status-note">
              <AlertTriangle size={15} />
              <span>Low confidence — clinical review is strongly recommended.</span>
            </div>
          )}

          <div className="diagnosis-summary-grid">
            <div><span>Category</span><strong>{text(condition?.category) || "Not specified"}</strong></div>
            <div><span>Urgency</span><strong>{text(clinical.urgencyLevel) || "Not specified"}{typeof clinical.urgencyScore === "number" ? ` · ${clinical.urgencyScore}/10` : ""}</strong></div>
            <div><span>Confidence</span><strong>{text(condition?.confidence) ? `${text(condition?.confidence)}%` : text(resultAnalysis.confidence) || "Not specified"}</strong></div>
            <div><span>Method</span><strong>{text(resultAnalysis.method).replaceAll("_", " ") || "Not specified"}</strong></div>
          </div>

          {text(clinical.immediateAction) && (
            <section className="diagnosis-result-section">
              <h4>Recommended urgency / immediate action</h4>
              <p>{text(clinical.immediateAction)}</p>
            </section>
          )}
          {renderList("Matched symptoms", condition?.matchedOn)}
          {Array.isArray(resultAnalysis.differentials) && resultAnalysis.differentials.length > 0 && (
            <section className="diagnosis-result-section">
              <h4>Differential diagnoses</h4>
              <ol>
                {resultAnalysis.differentials.map((item, index) => {
                  if (!isRecord(item)) return null;
                  return (
                    <li key={text(item.id) || `${text(item.name)}-${index}`}>
                      <strong>{text(item.name) || "Suggested condition"}</strong>
                      {text(item.commonName) && <span> ({text(item.commonName)})</span>}
                      {typeof item.confidence === "number" && <span> — {item.confidence}% match</span>}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
          {text(insights.reasoning) && (
            <section className="diagnosis-result-section">
              <h4>AI reasoning</h4>
              <p>{text(insights.reasoning)}</p>
            </section>
          )}
          {renderList("Specialties", insights.specialties)}
          {renderList("Services to consider", insights.services)}
          {renderList("Recommended investigations", clinical.investigations)}
          {renderList("Possible causes", clinical.possibleCauses)}
          {renderList("Potential complications", clinical.complications)}
          {renderList("Patient advice", clinical.patientAdvice ? [text(clinical.patientAdvice)] : [])}

          {stringList(clinical.redFlags).length > 0 && (
            <section className="diagnosis-red-flags" role="alert">
              <h4><AlertTriangle size={16} /> Red flags — assess urgently</h4>
              <p>{text(clinical.immediateAction)}</p>
              <ul>{stringList(clinical.redFlags).map((flag) => <li key={flag}>{flag}</li>)}</ul>
            </section>
          )}

          {escalation.isComplex === true && (
            <section className="escalation-consent-panel">
              <h4>Specialist review recommended</h4>
              {text(escalation.message) && <p>{text(escalation.message)}</p>}
              {escalationDone ? (
                <p className="escalation-success"><Check size={15} /> Specialist review request sent.</p>
              ) : (
                <>
                  <label className="diagnosis-consent">
                    <input
                      type="checkbox"
                      checked={escalationConsent}
                      disabled={escalating}
                      onChange={(event) => setEscalationConsent(event.target.checked)}
                    />
                    <span>I confirm the patient consents to sharing this case for specialist review.</span>
                  </label>
                  <label className="field escalation-email-field">
                    <span className="field-label">Patient contact email <span className="optional-label">Optional</span></span>
                    <Input
                      className="field-control"
                      type="email"
                      value={escalationEmail}
                      onChange={(event) => setEscalationEmail(event.target.value)}
                      disabled={escalating}
                      placeholder="name@example.com"
                    />
                  </label>
                  {escalationError && <p className="field-error" role="alert">{escalationError}</p>}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void submitEscalationConsent()}
                    disabled={escalating}
                  >
                    {escalating ? <LoaderCircle size={15} className="spin" /> : <ShieldCheck size={15} />}
                    {escalating ? "Sending request…" : "Request specialist review"}
                  </Button>
                </>
              )}
            </section>
          )}

          <p className="diagnosis-disclaimer">
            <ShieldCheck size={14} />
            Decision support only — suggested findings are not a confirmed diagnosis. A clinician
            must review the patient and make the final decision.
          </p>

          <div className="diagnosis-report-status" aria-live="polite">
            {trackingId ? (
              <p className="success"><Check size={15} /> Report saved · Tracking ID <strong>{trackingId}</strong></p>
            ) : savingReport ? (
              <p><LoaderCircle size={15} className="spin" /> Saving report…</p>
            ) : reportError ? (
              <div>
                <p className="field-error" role="alert">{reportError}</p>
                <Button type="button" variant="outline" onClick={() => void retryReportSave()}>
                  <FileText size={15} /> Retry report save
                </Button>
              </div>
            ) : null}
            {linkError && (
              <div>
                <p className="field-error" role="alert">{linkError}</p>
                <Button type="button" variant="outline" onClick={() => void retryLocalLink()}>
                  Retry local visit link
                </Button>
              </div>
            )}
            {localReportError && <p className="field-error" role="alert">{localReportError}</p>}
          </div>
          {!viewOnly && <div className="diagnosis-actions diagnosis-result-actions">
            <Button type="button" variant="outline" onClick={() => void printReport()}>
              <Printer size={15} /> Print report
            </Button>
          </div>}
          {viewOnly && (
            <div className="diagnosis-actions diagnosis-result-actions">
              <Button type="button" variant="outline" onClick={() => void printReport()}>
                <Printer size={15} /> Print report
              </Button>
            </div>
          )}
          {printError && <p className="print-action-error" role="alert">{printError}</p>}
        </div>
      )}
      {!viewOnly && !analysis && !analyzing && imageFiles.length === 0 && (
        <p className="diagnosis-hint">Run an analysis to prepare a structured clinical report.</p>
      )}
      {!viewOnly && executionSteps.length > 0 && !analyzing && (
        <div className="diagnosis-execution-report" aria-live="polite">
          <strong>Execution report</strong>
          <ul>
            {executionSteps.map((step) => (
              <li className={`execution-${step.status}`} key={step.label}>
                {step.status === "complete"
                  ? <Check size={14} />
                  : <AlertCircle size={14} />}
                <span>{step.label}</span>
              </li>
            ))}
          </ul>
          {progressLabel && <p>{progressLabel}</p>}
        </div>
      )}
      <footer className="report-print-footer">
        <strong>CONFIDENTIAL CLINICAL INFORMATION</strong>
        <span>Decision-support report only. Must be reviewed by a qualified clinician; not a confirmed diagnosis.</span>
      </footer>
    </Card>
  );
}
