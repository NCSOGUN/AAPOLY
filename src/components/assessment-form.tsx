"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  MapPin,
  Search,
} from "lucide-react";
import { urgencyConfig } from "@/lib/urgency";
import { downloadPatientReport } from "@/lib/download-report";
import EmailReportForm from "@/components/email-report-form";
import FacilityResults from "@/components/facility-results";
import {
  EntAnalysisResult,
  EntFacility,
  getSavedReport,
  getAnalysisResult,
  getFacilityList,
  isRecord,
} from "@/lib/ent-types";
import PatientPageHeader from "@/components/patient-page-header";

const areas = [
  {
    value: "ear",
    label: "Ear",
    description: "Hearing, balance or ear discomfort",
    image: "/ent-images/ear.png",
  },
  {
    value: "nose",
    label: "Nose",
    description: "Breathing, smell or sinus concerns",
    image: "/ent-images/nose.png",
  },
  {
    value: "throat",
    label: "Throat",
    description: "Swallowing, voice or throat concerns",
    image: "/ent-images/throat.png",
  },
] as const;

const durationOptions = ["1-3 days", "1 week", "2+ weeks", "months"] as const;

async function readApiResponse(response: Response) {
  const data: unknown = await response.json().catch(() => null);
  if (!isRecord(data)) {
    throw new Error("The service returned an unreadable response. Please try again.");
  }
  if (!response.ok || data.status !== "success") {
    throw new Error(
      typeof data.message === "string" ? data.message : "The request could not be completed.",
    );
  }
  return data;
}

async function saveAssessmentReport(input: {
  symptoms: string;
  area: (typeof areas)[number]["value"] | null;
  duration: string;
  age?: number;
  latitude: number | null;
  longitude: number | null;
  analysisResult: EntAnalysisResult;
}) {
  const { analysisResult } = input;
  const response = await fetch("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symptoms: input.symptoms.trim(),
      ...(input.area ? { affectedArea: input.area } : {}),
      ...(input.duration ? { duration: input.duration } : {}),
      ...(typeof input.age === "number" ? { age: input.age } : {}),
      ...(input.latitude !== null && input.longitude !== null
        ? { latitude: input.latitude, longitude: input.longitude }
        : {}),
      analysisResult,
      ...(analysisResult.analysis?.primaryCondition?.id
        ? { primaryConditionId: analysisResult.analysis.primaryCondition.id }
        : {}),
      ...(analysisResult.analysis?.primaryCondition?.name
        ? { primaryConditionName: analysisResult.analysis.primaryCondition.name }
        : {}),
      ...(typeof analysisResult.clinical?.urgencyScore === "number"
        ? { urgencyScore: analysisResult.clinical.urgencyScore }
        : {}),
      ...(analysisResult.clinical?.urgencyLevel
        ? { urgencyLevel: analysisResult.clinical.urgencyLevel }
        : {}),
      ...(analysisResult.clinical?.referralThreshold
        ? { referralThreshold: analysisResult.clinical.referralThreshold }
        : {}),
      patientProfileId: null,
    }),
  });
  const data = await readApiResponse(response);
  const savedReport = getSavedReport(data);
  if (!savedReport?.trackingId) {
    throw new Error("The service did not return a report ID.");
  }
  return savedReport.trackingId;
}

function fileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read the selected image."));
    };
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

export default function AssessmentForm() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [symptoms, setSymptoms] = useState("");
  const [area, setArea] = useState<(typeof areas)[number]["value"] | null>(null);
  const [duration, setDuration] = useState<string>("");
  const [ageInput, setAgeInput] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<EntAnalysisResult | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageConsent, setImageConsent] = useState(false);
  const [imageResult, setImageResult] = useState<Record<string, unknown> | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [place, setPlace] = useState("");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [facilities, setFacilities] = useState<EntFacility[]>([]);
  const [selectedFacilityIndex, setSelectedFacilityIndex] = useState<number | null>(null);
  const [hospitalError, setHospitalError] = useState<string | null>(null);
  const [isFindingHospitals, setIsFindingHospitals] = useState(false);
  const [escalationEmail, setEscalationEmail] = useState("");
  const [escalationMessage, setEscalationMessage] = useState<string | null>(null);
  const [isSubmittingEscalation, setIsSubmittingEscalation] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);

  const selectedArea = areas.find((option) => option.value === area);

  const urgency = useMemo(() => {
    const level = results?.clinical?.urgencyLevel as keyof typeof urgencyConfig | undefined;
    return level ? urgencyConfig[level] : null;
  }, [results]);

  const goNext = () => {
    if (!symptoms.trim()) {
      setError("Describe what you’re feeling before continuing.");
      return;
    }

    setError(null);
    setStep(2);
  };

  const goBack = () => {
    setError(null);
    setStep((current) => (current === 3 ? 2 : 1));
  };

  const handleSubmit = async () => {
    if (!symptoms.trim()) {
      setError("Describe what you’re feeling before submitting.");
      setStep(1);
      return;
    }

    const age = ageInput.trim() ? Number(ageInput) : undefined;
    if (age !== undefined && (!Number.isInteger(age) || age < 0 || age > 120)) {
      setError("Enter an age from 0 to 120, or leave this optional field blank.");
      setStep(2);
      return;
    }

    if (patientEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail.trim())) {
      setError("Enter a valid email address, or leave the optional field blank.");
      setStep(2);
      return;
    }

    if (imageBase64 && !imageConsent) {
      setError("Please confirm the image-use notice before submitting your photo.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setReportError(null);
    setImageError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptoms,
          ...(area ? { affectedArea: area } : {}),
          ...(duration ? { duration } : {}),
          ...(typeof age === "number" ? { age } : {}),
          ...(additionalContext.trim()
            ? { additionalContext: additionalContext.trim() }
            : {}),
          ...(latitude !== null && longitude !== null ? { latitude, longitude } : {}),
        }),
      });

      const data = await readApiResponse(response);
      const analysisResult = getAnalysisResult(data);
      if (!analysisResult || !isRecord(data.data)) {
        throw new Error("The ENT service did not return a complete assessment.");
      }

      setResults(analysisResult);

      try {
        setTrackingId(
          await saveAssessmentReport({
            symptoms,
            area,
            duration,
            age,
            latitude,
            longitude,
            analysisResult,
          }),
        );
      } catch (reportSaveError) {
        setReportError(
          reportSaveError instanceof Error
            ? reportSaveError.message
            : "Your assessment could not be saved for later lookup.",
        );
      }

      if (imageBase64 && imageConsent) {
        try {
          const imageResponse = await fetch("/api/analyze-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageBase64,
              imageType: area ?? "general",
              ...(additionalContext.trim()
                ? { additionalContext: additionalContext.trim() }
                : {}),
              consent: true,
            }),
          });
          const imageData = await readApiResponse(imageResponse);
          if (!isRecord(imageData.data) || !isRecord(imageData.data.analysis)) {
            throw new Error("The service did not return image findings.");
          }
          setImageResult(imageData.data);
        } catch (imageAnalysisError) {
          setImageError(
            imageAnalysisError instanceof Error
              ? imageAnalysisError.message
              : "The photo could not be analyzed. Your symptom assessment is still available.",
          );
        }
      }

      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryReportSave = async () => {
    if (!results) return;
    setIsSavingReport(true);
    setReportError(null);
    try {
      setTrackingId(
        await saveAssessmentReport({
          symptoms,
          area,
          duration,
          ...(ageInput.trim() ? { age: Number(ageInput) } : {}),
          latitude,
          longitude,
          analysisResult: results,
        }),
      );
    } catch (reportSaveError) {
      setReportError(
        reportSaveError instanceof Error
          ? reportSaveError.message
          : "Your assessment could not be saved for later lookup.",
      );
    } finally {
      setIsSavingReport(false);
    }
  };

  const handleImageChange = async (file?: File) => {
    setError(null);
    setImageError(null);
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Choose a JPEG or PNG image.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("The image must be 4 MB or smaller.");
      return;
    }
    try {
      setImageBase64(await fileAsDataUrl(file));
      setImageName(file.name);
      setImageConsent(false);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "Could not read the image.");
    }
  };

  const handleCopyTrackingId = async () => {
    if (!trackingId) return;
    try {
      await navigator.clipboard.writeText(trackingId);
      setCopyStatus("Report ID copied.");
    } catch {
      setCopyStatus("Copy failed. Select and copy the report ID manually.");
    }
  };

  const handleDownloadPdf = async () => {
    if (!results) return;
    setIsDownloadingReport(true);
    setError(null);
    try {
      await downloadPatientReport({
        trackingId,
        patientName: patientName.trim() || undefined,
        patientEmail: patientEmail.trim() || undefined,
        symptoms,
        affectedArea: area,
        duration,
        age: ageInput.trim() ? Number(ageInput) : undefined,
        additionalContext: additionalContext.trim() || undefined,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        imageResult: imageResult ?? undefined,
        result: results,
      });
    } catch {
      setError("The PDF could not be created. Please try again.");
    } finally {
      setIsDownloadingReport(false);
    }
  };

  const handleUseLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Location is not available in this browser. Enter a town or city instead.");
      return;
    }
    setIsRequestingLocation(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLatitude(coords.latitude);
        setLongitude(coords.longitude);
        setLocationError(null);
        setIsRequestingLocation(false);
      },
      () => {
        setLocationError("Location access was not available. Enter a town or city instead.");
        setIsRequestingLocation(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const handleFindHospitals = async () => {
    if (!results?.clinical || !results.analysis?.primaryCondition) return;
    if ((latitude === null || longitude === null) && !place.trim()) {
      setHospitalError("Use your location or enter a town or city to find nearby care.");
      return;
    }

    setIsFindingHospitals(true);
    setHospitalError(null);
    setFacilities([]);
    setSelectedFacilityIndex(null);
    try {
      const response = await fetch("/api/hospitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "report",
          primaryCondition:
            results.analysis.primaryCondition.name ??
            results.analysis.primaryCondition.commonName ??
            "ENT symptoms",
          specialists: results.clinical.specialists ?? [],
          urgencyScore: results.clinical.urgencyScore ?? 1,
          requiredServices: results.analysis.aiInsights?.services ?? [],
          ...(latitude !== null && longitude !== null
            ? { latitude, longitude }
            : { place: place.trim() }),
          radiusKm: 50,
          limit: 8,
          onlyAccredited: true,
        }),
      });
      const data = await readApiResponse(response);
      setFacilities(getFacilityList(data));
    } catch (hospitalSearchError) {
      setHospitalError(
        hospitalSearchError instanceof Error
          ? hospitalSearchError.message
          : "Nearby hospitals could not be loaded.",
      );
    } finally {
      setIsFindingHospitals(false);
    }
  };

  const handleEscalationConsent = async (consent: boolean) => {
    const caseId = results?.escalation?.caseId;
    if (!caseId) return;
    if (consent && !escalationEmail.trim()) {
      setEscalationMessage("Enter an email address so the specialist team can follow up.");
      return;
    }
    setIsSubmittingEscalation(true);
    setEscalationMessage(null);
    try {
      const response = await fetch("/api/escalation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          consent,
          ...(consent ? { email: escalationEmail.trim() } : {}),
        }),
      });
      await readApiResponse(response);
      setEscalationMessage(
        consent
          ? "Your case has been shared with the specialist team."
          : "Specialist sharing was declined.",
      );
    } catch (consentError) {
      setEscalationMessage(
        consentError instanceof Error
          ? consentError.message
          : "Your preference could not be saved. Please try again.",
      );
    } finally {
      setIsSubmittingEscalation(false);
    }
  };

  return (
    <main className="assessment-page">
      <PatientPageHeader />

      <div className="assessment-shell">
        <div className="assessment-intro">
          <div className="assessment-intro-copy">
            <p className="assessment-eyebrow">
              <span className="eyebrow-rule" />
              PATIENT GUIDANCE <span aria-hidden="true">·</span> SYMPTOM CHECK
            </p>
            <h1>
              {step === 3
                ? "Your next steps."
                : step === 2
                  ? "A little more context."
                  : "Let’s start with what you feel."}
            </h1>
            <p className="assessment-lede">
              {step === 3
                ? "Review your guidance and the care options available to you."
                : "A few details can help make your guidance more relevant. Start with the area that feels most connected."}
            </p>
          </div>

          <div className="assessment-progress" aria-label={`Step ${Math.min(step, 2)} of 2`}>
            <div className="assessment-progress-top">
              <span>YOUR ASSESSMENT</span>
              <span>{step === 3 ? "COMPLETE" : `0${step} / 02`}</span>
            </div>
            <div className="assessment-progress-track" aria-hidden="true">
              <span className={step >= 1 ? "is-complete" : ""} />
              <span className={step >= 2 ? "is-complete" : ""} />
            </div>
            <div className="assessment-progress-labels">
              <span className={step === 1 ? "is-current" : ""}>Your symptoms</span>
              <span className={step >= 2 ? "is-current" : ""}>Your context</span>
            </div>
          </div>
        </div>

        <section className="assessment-workspace" aria-label="Symptom assessment">
          <div className="assessment-form-panel">
            {error && (
              <div className="assessment-error" role="alert">
                <AlertCircle aria-hidden="true" size={18} />
                <span>{error}</span>
              </div>
            )}

            {step === 1 && (
              <div className="assessment-fields">
                <fieldset className="assessment-region-field">
                  <legend className="assessment-field-heading">
                    <span className="assessment-field-number">01</span>
                    Where are you experiencing symptoms?
                  </legend>
                  <p className="assessment-field-hint">
                    Choose the area that feels closest. You can continue without selecting one.
                  </p>
                  <div className="assessment-area-grid">
                    {areas.map((option, index) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setArea(option.value)}
                        aria-pressed={area === option.value}
                        className={`assessment-area-card${area === option.value ? " is-active" : ""}`}
                      >
                        <span className="assessment-area-image">
                          <Image
                            src={option.image}
                            alt={`${option.label} anatomy`}
                            width={180}
                            height={150}
                            sizes="(max-width: 700px) 28vw, 180px"
                            loading="eager"
                          />
                          <span className="assessment-area-index">0{index + 1}</span>
                          {area === option.value && (
                            <span className="assessment-area-check" aria-hidden="true">
                              <Check size={14} />
                            </span>
                          )}
                        </span>
                        <span className="assessment-area-copy">
                          <span className="assessment-area-title">{option.label}</span>
                          <span className="assessment-area-description">{option.description}</span>
                        </span>
                        <ArrowRight className="assessment-area-arrow" aria-hidden="true" size={16} />
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="assessment-input-field">
                  <label className="assessment-field-heading" htmlFor="symptoms">
                    <span className="assessment-field-number">02</span>
                    Describe what you’re feeling
                  </label>
                  <p className="assessment-field-hint">
                    Include what it feels like and anything that makes it better or worse.
                  </p>
                  <textarea
                    id="symptoms"
                    rows={4}
                    value={symptoms}
                    onChange={(event) => setSymptoms(event.target.value)}
                    className="assessment-textarea"
                    placeholder="For example: a sore throat that feels worse when I swallow…"
                  />
                </div>

                <fieldset className="assessment-duration-field">
                  <legend className="assessment-field-heading">
                    <span className="assessment-field-number">03</span>
                    How long have you had these symptoms?
                  </legend>
                  <div className="assessment-duration-options">
                    {durationOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setDuration(option)}
                        aria-pressed={duration === option}
                        className={`assessment-duration-option${duration === option ? " is-active" : ""}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}

            {step === 2 && (
              <div className="assessment-fields assessment-fields-step-two">
                <div className="assessment-input-field">
                  <label className="assessment-field-heading" htmlFor="patient-name">
                    <span className="assessment-field-number">01</span>
                    Your details <span className="assessment-optional-label">(optional)</span>
                  </label>
                  <p className="assessment-field-hint">
                    Add your name and email if you want them shown on a report or to email yourself a copy. These details are not sent to the ENT analysis service.
                  </p>
                  <div className="assessment-email-report-fields">
                    <label>
                      <span>Your name</span>
                      <input
                        id="patient-name"
                        type="text"
                        value={patientName}
                        onChange={(event) => setPatientName(event.target.value)}
                        maxLength={120}
                        autoComplete="name"
                        className="assessment-text-input"
                      />
                    </label>
                    <label>
                      <span>Email address</span>
                      <input
                        id="patient-email"
                        type="email"
                        value={patientEmail}
                        onChange={(event) => setPatientEmail(event.target.value)}
                        maxLength={254}
                        autoComplete="email"
                        className="assessment-text-input"
                      />
                    </label>
                  </div>
                </div>

                <div className="assessment-input-field assessment-age-field">
                  <label className="assessment-field-heading" htmlFor="patient-age">
                    <span className="assessment-field-number">02</span>
                    Age <span className="assessment-optional-label">(optional)</span>
                  </label>
                  <p className="assessment-field-hint">
                    Age can help the service tailor its assessment. Leave blank if you prefer.
                  </p>
                  <input
                    id="patient-age"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={120}
                    step={1}
                    value={ageInput}
                    onChange={(event) => setAgeInput(event.target.value)}
                    className="assessment-text-input"
                    placeholder="Age in years"
                    autoComplete="off"
                  />
                </div>

                <div className="assessment-input-field">
                  <label className="assessment-field-heading" htmlFor="context">
                    <span className="assessment-field-number">03</span>
                    Is there anything else we should know?
                  </label>
                  <p className="assessment-field-hint">
                    Optional: mention which side is affected, other symptoms, recent illness, relevant conditions, medicines or allergies.
                  </p>
                  <textarea
                    id="context"
                    rows={6}
                    value={additionalContext}
                    onChange={(event) => setAdditionalContext(event.target.value)}
                    className="assessment-textarea"
                    placeholder="For example: right ear; symptoms began after a cold; I take…; I am allergic to…"
                  />
                </div>

                <div className="assessment-optional-card">
                  <div className="assessment-optional-icon">
                    <Search aria-hidden="true" size={19} />
                  </div>
                  <div className="assessment-upload-content">
                    <label className="assessment-optional-title" htmlFor="assessment-image">
                      Add a photo <span>(optional · JPEG or PNG · up to 4 MB)</span>
                    </label>
                    <input
                      id="assessment-image"
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={(event) => {
                        void handleImageChange(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                    <p className="assessment-optional-copy">
                      {imageName ?? "Only share a photo if you are comfortable with the notice below."}
                    </p>
                  </div>
                  {imageName && (
                    <button
                      type="button"
                      className="assessment-remove-image"
                      onClick={() => {
                        setImageBase64(null);
                        setImageName(null);
                        setImageConsent(false);
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                {imageBase64 && (
                  <div className="assessment-image-consent">
                    <p>
                      Images you upload may be retained for diagnostic quality improvement and specialist review purposes. By submitting, you acknowledge and consent to this usage.
                    </p>
                    <label>
                      <input
                        type="checkbox"
                        checked={imageConsent}
                        onChange={(event) => setImageConsent(event.target.checked)}
                      />
                      I have read and agree to the image-use notice.
                    </label>
                  </div>
                )}

                <div className="assessment-location-note">
                  <MapPin aria-hidden="true" size={18} />
                  <p>
                    <strong>Share location for this assessment (optional)</strong>
                    <span>
                      If you choose, your coordinates are sent with your assessment and saved report. You can continue without sharing.
                    </span>
                  </p>
                  {latitude !== null && longitude !== null ? (
                    <button
                      type="button"
                      className="assessment-back-button"
                      onClick={() => {
                        setLatitude(null);
                        setLongitude(null);
                      }}
                    >
                      Location added · Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="assessment-back-button"
                      disabled={isRequestingLocation}
                      onClick={handleUseLocation}
                    >
                      <MapPin aria-hidden="true" size={16} />
                      {isRequestingLocation ? "Getting location…" : "Share my location"}
                    </button>
                  )}
                  {locationError && (
                    <p className="assessment-inline-status" role="status">{locationError}</p>
                  )}
                </div>
              </div>
            )}

            {step === 3 && results && (
              <div className="assessment-results">
                <div
                  className="assessment-urgency-card"
                  style={{
                    backgroundColor: urgency?.bg ?? "#f8faf9",
                    borderColor: urgency?.border ?? "#d8e1e3",
                  }}
                >
                  <div className="assessment-urgency-heading">
                    <div>
                      <p
                        className="assessment-urgency-label"
                        style={{ color: urgency?.color ?? "#5f727a" }}
                      >
                        {urgency?.label ?? "Urgency not provided"}
                      </p>
                      <h2>
                        {results.analysis?.primaryCondition?.commonName ??
                          results.analysis?.primaryCondition?.name ??
                          "Assessment guidance"}
                      </h2>
                    </div>
                    {trackingId && (
                      <span className="assessment-tracking-id">{trackingId}</span>
                    )}
                  </div>
                  <p>
                    {results.clinical?.immediateAction ??
                      "The service did not provide an immediate action. Please contact a qualified healthcare professional for advice."}
                  </p>
                </div>

                {reportError && (
                  <div className="assessment-error" role="alert">
                    <AlertCircle aria-hidden="true" size={18} />
                    <span>
                      Guidance is available, but a permanent report could not be saved: {reportError}
                    </span>
                  </div>
                )}

                {results.analysis?.aiStatus?.available === false && (
                  <div className="assessment-service-note">
                    AI analysis was unavailable. This guidance may be based on the service&apos;s medical database.
                    {results.analysis.aiStatus.code ? ` (${results.analysis.aiStatus.code})` : ""}
                  </div>
                )}

                <article className="assessment-result-card">
                  <span className="assessment-result-index">01</span>
                  <h3>What to do right now</h3>
                  <p>
                    {results.clinical?.immediateAction ??
                      "No immediate action was provided. Contact a qualified healthcare professional for advice."}
                  </p>
                </article>

                {results.clinical?.redFlags?.length ? (
                  <article className="assessment-result-card assessment-red-flags">
                    <span className="assessment-result-index">02</span>
                    <h3>Seek urgent care if these occur</h3>
                    <ul>
                      {results.clinical.redFlags.map((flag, index) => (
                        <li key={`${flag}-${index}`}>{flag}</li>
                      ))}
                    </ul>
                  </article>
                ) : null}

                {results.clinical?.patientAdvice && (
                  <article className="assessment-result-card">
                    <span className="assessment-result-index">03</span>
                    <h3>Patient advice</h3>
                    <p>{results.clinical.patientAdvice}</p>
                  </article>
                )}

                <div className="assessment-result-grid">
                  {results.analysis?.differentials?.length ? (
                    <article className="assessment-result-card">
                      <span className="assessment-result-index">04</span>
                      <h3>Other possible conditions</h3>
                      <ul>
                        {results.analysis.differentials.map((condition, index) => (
                          <li key={`${condition.id ?? condition.name ?? "condition"}-${index}`}>
                            {condition.commonName ?? condition.name ?? "Condition"}
                          </li>
                        ))}
                      </ul>
                    </article>
                  ) : null}
                  {results.clinical?.possibleCauses?.length ? (
                    <article className="assessment-result-card">
                      <span className="assessment-result-index">05</span>
                      <h3>Possible causes</h3>
                      <ul>
                        {results.clinical.possibleCauses.map((cause, index) => (
                          <li key={`${cause}-${index}`}>{cause}</li>
                        ))}
                      </ul>
                    </article>
                  ) : null}
                </div>

                {results.clinical?.specialists?.length ? (
                  <article className="assessment-result-card">
                    <span className="assessment-result-index">06</span>
                    <h3>Recommended specialist care</h3>
                    <p>{results.clinical.specialists.join(", ")}</p>
                  </article>
                ) : null}

                {imageError && (
                  <div className="assessment-error" role="status">
                    <AlertCircle aria-hidden="true" size={18} />
                    <span>Symptom guidance is available, but the photo analysis failed: {imageError}</span>
                  </div>
                )}
                {imageResult && (
                  <article className="assessment-result-card assessment-image-result">
                    <span className="assessment-result-index">IMAGE FINDINGS</span>
                    <h3>Photo assessment</h3>
                    {isRecord(imageResult.analysis) &&
                    Array.isArray(imageResult.analysis.findings) ? (
                      <ul>
                        {imageResult.analysis.findings
                          .filter((finding): finding is string => typeof finding === "string")
                          .map((finding, index) => (
                            <li key={`${finding}-${index}`}>{finding}</li>
                          ))}
                      </ul>
                    ) : null}
                    {typeof imageResult.disclaimer === "string" && (
                      <p className="assessment-image-disclaimer">{imageResult.disclaimer}</p>
                    )}
                  </article>
                )}

                {results.escalation?.isComplex && results.escalation.caseId && (
                  <article className="assessment-result-card assessment-escalation-card">
                    <span className="assessment-result-index">SPECIALIST REVIEW</span>
                    <h3>Would you like to share this case with a specialist?</h3>
                    <p>
                      {results.escalation.message ??
                        "The service has flagged this case for optional specialist review."}
                    </p>
                    <label className="assessment-email-label" htmlFor="escalation-email">
                      Email for specialist follow-up
                    </label>
                    <input
                      id="escalation-email"
                      type="email"
                      value={escalationEmail}
                      onChange={(event) => setEscalationEmail(event.target.value)}
                      className="assessment-text-input"
                      autoComplete="email"
                    />
                    <div className="assessment-escalation-actions">
                      <button
                        type="button"
                        disabled={isSubmittingEscalation}
                        onClick={() => void handleEscalationConsent(true)}
                        className="assessment-continue-button"
                      >
                        Yes, share with a specialist
                      </button>
                      <button
                        type="button"
                        disabled={isSubmittingEscalation}
                        onClick={() => void handleEscalationConsent(false)}
                        className="assessment-back-button"
                      >
                        No thank you
                      </button>
                    </div>
                    {escalationMessage && (
                      <p className="assessment-inline-status" role="status">{escalationMessage}</p>
                    )}
                  </article>
                )}

                <section className="assessment-report-card" aria-label="Save or download report">
                  <div>
                    <span className="assessment-result-index">YOUR REPORT</span>
                    <h3>{trackingId ? "Keep your report ID" : "Download your guidance"}</h3>
                    <p>
                      {trackingId
                        ? "Use this ID to retrieve your saved report later."
                        : "A permanent report ID is unavailable, but you can download this guidance as a PDF."}
                    </p>
                  </div>
                  {trackingId && (
                    <div className="assessment-report-id-row">
                      <code>{trackingId}</code>
                      <button
                        type="button"
                        className="assessment-icon-button"
                        onClick={() => void handleCopyTrackingId()}
                        aria-label="Copy report ID"
                      >
                        <Copy aria-hidden="true" size={16} />
                      </button>
                    </div>
                  )}
                  {copyStatus && <p className="assessment-inline-status" role="status">{copyStatus}</p>}
                  <div className="assessment-report-actions">
                    {reportError && (
                      <button
                        type="button"
                        className="assessment-back-button"
                        disabled={isSavingReport}
                        onClick={() => void handleRetryReportSave()}
                      >
                        {isSavingReport ? "Saving…" : "Try saving again"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="assessment-continue-button"
                      disabled={isDownloadingReport}
                      onClick={() => void handleDownloadPdf()}
                    >
                      <Download aria-hidden="true" size={16} />
                      {isDownloadingReport ? "Preparing PDF…" : "Download PDF"}
                    </button>
                    {trackingId && (
                      <Link
                        href={`/results/${encodeURIComponent(trackingId)}`}
                        className="assessment-back-button"
                      >
                        Open saved report <ArrowRight aria-hidden="true" size={16} />
                      </Link>
                    )}
                  </div>
                  {results && (
                    <EmailReportForm
                      report={{
                        trackingId,
                        patientName: patientName.trim() || undefined,
                        patientEmail: patientEmail.trim() || undefined,
                        symptoms,
                        affectedArea: area,
                        duration,
                        age: ageInput.trim() ? Number(ageInput) : undefined,
                        additionalContext: additionalContext.trim() || undefined,
                        latitude: latitude ?? undefined,
                        longitude: longitude ?? undefined,
                        imageResult: imageResult ?? undefined,
                        result: results,
                      }}
                      initialName={patientName}
                      initialEmail={patientEmail}
                    />
                  )}
                </section>

                {results.clinical?.urgencyLevel !== "Emergency" && (
                  <section className="assessment-hospital-search" aria-label="Find nearby hospitals">
                    <span className="assessment-result-index">CARE OPTIONS</span>
                    <h3>Find a hospital near you</h3>
                    <p>Share your location or enter a town or city. Location is optional.</p>
                    <div className="assessment-hospital-location">
                      <button
                        type="button"
                        onClick={handleUseLocation}
                        className="assessment-back-button"
                      >
                        <MapPin aria-hidden="true" size={16} />
                        {latitude !== null && longitude !== null ? "Location ready" : "Use my location"}
                      </button>
                      <span>or</span>
                      <input
                        aria-label="Town or city"
                        type="text"
                        value={place}
                        onChange={(event) => setPlace(event.target.value)}
                        className="assessment-text-input"
                        placeholder="Town or city"
                      />
                      <button
                        type="button"
                        disabled={isFindingHospitals}
                        onClick={() => void handleFindHospitals()}
                        className="assessment-continue-button"
                      >
                        {isFindingHospitals ? "Searching…" : "Find hospitals"}
                      </button>
                    </div>
                    {locationError && <p className="assessment-inline-status">{locationError}</p>}
                    {hospitalError && <p className="assessment-error" role="alert">{hospitalError}</p>}
                    {!isFindingHospitals && facilities.length === 0 && !hospitalError && (
                      <p className="assessment-hospital-empty">
                        Search when you’re ready to see service-provided facilities.
                      </p>
                    )}
                    {facilities.length > 0 && (
                      <FacilityResults
                        facilities={facilities}
                        locationLabel={place || (latitude !== null ? "your location" : undefined)}
                        selectedIndex={selectedFacilityIndex}
                        onSelect={setSelectedFacilityIndex}
                      />
                    )}
                  </section>
                )}
              </div>
            )}

            <div className="assessment-form-footer">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 1}
                className="assessment-back-button"
              >
                <ArrowLeft aria-hidden="true" size={16} />
                Back
              </button>

              {step === 1 ? (
                <button type="button" onClick={goNext} className="assessment-continue-button">
                  Continue <ArrowRight aria-hidden="true" size={16} />
                </button>
              ) : step === 2 ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="assessment-continue-button"
                >
                  {isLoading ? "Reviewing your symptoms…" : "Review my guidance"}
                  <ArrowRight aria-hidden="true" size={16} />
                </button>
              ) : (
                <Link href="/report" className="assessment-continue-button">
                  Look up a report <ArrowRight aria-hidden="true" size={16} />
                </Link>
              )}
            </div>
          </div>

          <aside className="assessment-side-panel">
            <div className="assessment-preview">
              <p className="assessment-side-kicker">
                <span className="live-dot" />
                YOUR STARTING POINT
              </p>
              {selectedArea ? (
                <>
                  <div className="assessment-preview-image">
                    <Image
                      src={selectedArea.image}
                      alt={`${selectedArea.label} anatomy preview`}
                      width={320}
                      height={260}
                      sizes="(max-width: 900px) 35vw, 320px"
                    />
                  </div>
                  <h2>{selectedArea.label}</h2>
                  <p>{selectedArea.description}</p>
                </>
              ) : (
                <>
                  <div className="assessment-preview-collection" aria-hidden="true">
                    {areas.map((option) => (
                      <span key={option.value}>
                        <Image src={option.image} alt="" width={100} height={100} />
                      </span>
                    ))}
                  </div>
                  <h2>Start anywhere.</h2>
                  <p>
                    Choose Ear, Nose or Throat—or leave the area open and tell us what you’re feeling.
                  </p>
                </>
              )}
            </div>

            <div className="assessment-side-note">
              <span className="assessment-note-mark" aria-hidden="true">i</span>
              <p>
                <strong>Guidance, not a diagnosis.</strong>
                <span>This assessment can help you think through next steps. It does not replace care from a health professional.</span>
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
