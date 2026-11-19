"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  MapPin,
  Pencil,
  Search,
  Volume2,
  X,
} from "lucide-react";
import { urgencyConfig } from "@/lib/urgency";
import { downloadPatientReport } from "@/lib/download-report";
import EmailReportForm from "@/components/email-report-form";
import VoiceQuestion, { speakQuestionAloud } from "@/components/voice-question";
import FacilityResults from "@/components/facility-results";
import {
  EntAnalysisResult,
  EntFacility,
  getSavedReport,
  getAnalysisResult,
  getFacilityList,
  isRecord,
} from "@/lib/ent-types";
import { getUserLocation } from "@/lib/geolocation";
import PatientPageHeader from "@/components/patient-page-header";
import { voiceLanguages, type VoiceLanguageCode } from "@/lib/voice-languages";
import { normalizeNigerianPhone } from "@/lib/nigerian-phone";

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
const guidedQuestions = [
  {
    question: "Tell us exactly how you’re feeling.",
    prompt:
      "Describe what is bothering you, where it is, what it feels like, and anything that makes it better or worse.",
    placeholder: "Your words will appear here. Review and correct them before confirming.",
    maxLength: 5000,
  },
  {
    question: "How long have you been feeling this way?",
    prompt:
      "Tell us when it started, or choose one of the suggested time periods. You can skip this if you are not sure.",
    placeholder: "For example: since yesterday, about three days, or a few weeks.",
    maxLength: 100,
    quickAnswers: durationOptions,
  },
  {
    question: "Is there anything else we should know?",
    prompt:
      "You can mention which side is affected, other symptoms, a recent illness, relevant conditions, medicines, or allergies. You can skip this question.",
    placeholder: "Share any other details in your own words.",
    maxLength: 3000,
  },
] as const;

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

async function translateTypedDialect(text: string, language: VoiceLanguageCode) {
  if (!text.trim() || language === "en") return text;
  const response = await fetch("/api/voice/translate-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, source_language: language }),
  });
  const data = await readApiResponse(response);
  if (!isRecord(data.data) || typeof data.data.translatedText !== "string") {
    throw new Error("The translation service did not return English text.");
  }
  return data.data.translatedText;
}

async function saveAssessmentReport(input: {
  symptoms: string;
  area: (typeof areas)[number]["value"] | null;
  duration: string;
  age?: number;
  phone?: string;
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
      ...(input.phone ? { phone: input.phone } : {}),
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
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLanguageCode>("en");
  const [languageModalOpen, setLanguageModalOpen] = useState(true);
  const [voiceInteraction, setVoiceInteraction] = useState(false);
  const [guidedQuestionIndex, setGuidedQuestionIndex] = useState(0);
  const [answerIsEnglish, setAnswerIsEnglish] = useState<Record<number, boolean>>({});
  const [assessmentEnglish, setAssessmentEnglish] = useState<{
    symptoms: string;
    duration: string;
    additionalContext: string;
  } | null>(null);
  const areaFieldRef = useRef<HTMLFieldSetElement | null>(null);
  const instructionAudioRef = useRef<HTMLAudioElement | null>(null);
  const [symptoms, setSymptoms] = useState("");
  const [area, setArea] = useState<(typeof areas)[number]["value"] | null>(null);
  const [duration, setDuration] = useState<string>("");
  const [ageInput, setAgeInput] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
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
  const [isSpeakingAssessment, setIsSpeakingAssessment] = useState(false);
  const [assessmentSpeechError, setAssessmentSpeechError] = useState<string | null>(null);
  const assessmentAudioRef = useRef<HTMLAudioElement | null>(null);
  const assessmentAudioUrlRef = useRef<string | null>(null);

  const selectedArea = areas.find((option) => option.value === area);
  const selectedVoiceLanguage =
    voiceLanguages.find((option) => option.code === voiceLanguage) ?? voiceLanguages[0];
  const assessmentSpeechText = useMemo(() => {
    if (!results) return "";
    const condition =
      results.analysis?.primaryCondition?.commonName ??
      results.analysis?.primaryCondition?.name;
    return [
      "Your assessment is complete.",
      "This is guidance and not a confirmed medical diagnosis.",
      condition ? `A possible cause of your symptoms is ${condition}.` : "",
      results.clinical?.immediateAction,
      results.clinical?.patientAdvice,
      results.clinical?.redFlags?.length
        ? `Seek urgent medical care if you experience: ${results.clinical.redFlags.join("; ")}.`
        : "",
    ]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(" ")
      .slice(0, 5000);
  }, [results]);

  const speakAssessment = useCallback(async () => {
    if (!assessmentSpeechText) return;
    setAssessmentSpeechError(null);
    setIsSpeakingAssessment(true);
    try {
      assessmentAudioRef.current?.pause();
      if (assessmentAudioUrlRef.current) {
        URL.revokeObjectURL(assessmentAudioUrlRef.current);
        assessmentAudioUrlRef.current = null;
      }
      const response = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: assessmentSpeechText,
          target_language: voiceLanguage,
        }),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message =
          isRecord(body) && typeof body.message === "string"
            ? body.message
            : "The spoken guidance could not be prepared.";
        throw new Error(message);
      }
      const audioUrl = URL.createObjectURL(await response.blob());
      assessmentAudioUrlRef.current = audioUrl;
      const audio = new Audio(audioUrl);
      assessmentAudioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        if (assessmentAudioUrlRef.current === audioUrl) {
          assessmentAudioUrlRef.current = null;
          assessmentAudioRef.current = null;
        }
        setIsSpeakingAssessment(false);
      };
      await audio.play();
    } catch (speechError) {
      setAssessmentSpeechError(
        speechError instanceof Error
          ? speechError.message
          : "The spoken guidance could not be played.",
      );
      setIsSpeakingAssessment(false);
    }
  }, [assessmentSpeechText, voiceLanguage]);

  useEffect(() => {
    if (step !== 3 || !voiceInteraction || !assessmentSpeechText) return;
    void speakAssessment();
    return () => {
      assessmentAudioRef.current?.pause();
      if (assessmentAudioUrlRef.current) {
        URL.revokeObjectURL(assessmentAudioUrlRef.current);
        assessmentAudioUrlRef.current = null;
      }
    };
  }, [step, voiceInteraction, assessmentSpeechText, speakAssessment]);

  useEffect(() => {
    if (!languageModalOpen) return;
    const audio = new Audio("/audio/instruction_audio.mp3");
    audio.preload = "auto";
    instructionAudioRef.current = audio;

    let hasStarted = false;
    const playInstruction = () => {
      if (hasStarted) return;
      hasStarted = true;
      void audio.play().catch(() => {
        hasStarted = false;
      });
    };

    audio.addEventListener("canplaythrough", playInstruction, { once: true });
    const timer = window.setTimeout(playInstruction, 500);
    const retryAfterGesture = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".assessment-language-modal-options")) return;
      playInstruction();
    };
    window.addEventListener("pointerdown", retryAfterGesture, { once: true });

    return () => {
      window.clearTimeout(timer);
      audio.removeEventListener("canplaythrough", playInstruction);
      window.removeEventListener("pointerdown", retryAfterGesture);
      audio.pause();
      audio.currentTime = 0;
      if (instructionAudioRef.current === audio) {
        instructionAudioRef.current = null;
      }
    };
  }, [languageModalOpen]);

  const chooseVoiceLanguage = (language: (typeof voiceLanguages)[number]) => {
    const instructionAudio = instructionAudioRef.current;
    if (instructionAudio) {
      instructionAudio.pause();
      instructionAudio.currentTime = 0;
    }
    setVoiceLanguage(language.code);
    setVoiceInteraction(true);
    setLanguageModalOpen(false);
  };

  const chooseTyping = () => {
    const instructionAudio = instructionAudioRef.current;
    instructionAudio?.pause();
    if (instructionAudio) instructionAudio.currentTime = 0;
    setVoiceInteraction(false);
    setLanguageModalOpen(false);
  };

  const urgency = useMemo(() => {
    const level = results?.clinical?.urgencyLevel as keyof typeof urgencyConfig | undefined;
    return level ? urgencyConfig[level] : null;
  }, [results]);

  const goNext = () => {
    if (!symptoms.trim()) {
      setError("Please answer and confirm how you are feeling before continuing.");
      setGuidedQuestionIndex(0);
      return;
    }

    if (guidedQuestionIndex < guidedQuestions.length) {
      setError("Please review and confirm each answer before continuing.");
      return;
    }

    setError(null);
    setStep(2);
  };

  const goBack = () => {
    setError(null);
    if (step === 3) {
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(1);
      setGuidedQuestionIndex(0);
      return;
    }
    if (guidedQuestionIndex > 0) setGuidedQuestionIndex((current) => current - 1);
  };

  const confirmGuidedAnswer = (index: number, answer: string, isEnglish: boolean) => {
    if (index === 0) setSymptoms(answer);
    if (index === 1) setDuration(answer);
    if (index === 2) setAdditionalContext(answer);
    setAnswerIsEnglish((current) => ({ ...current, [index]: isEnglish }));
    setError(null);
    setGuidedQuestionIndex(index + 1);
  };

  const skipGuidedAnswer = (index: number) => {
    if (index === 1) setDuration("");
    if (index === 2) setAdditionalContext("");
    setAnswerIsEnglish((current) => ({ ...current, [index]: true }));
    setError(null);
    setGuidedQuestionIndex(index + 1);
  };

  const editGuidedAnswer = (index: number) => {
    setError(null);
    setGuidedQuestionIndex(index);
  };

  const speakAreaQuestion = () => {
    if (!speakQuestionAloud(
      "Where are you experiencing symptoms? Choose ear, nose, or throat, or leave this open if you are not sure.",
      selectedVoiceLanguage.locale,
    )) {
      setError("Spoken questions are not available in this browser. The written question is still available.");
    }
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

    const normalizedPhone = patientPhone.trim()
      ? normalizeNigerianPhone(patientPhone) ?? undefined
      : undefined;
    if (patientPhone.trim() && !normalizedPhone) {
      setError("Enter a valid Nigerian mobile number, such as 09154996570 or +2349154996570.");
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
      const [analysisSymptoms, analysisDuration, analysisAdditionalContext] =
        await Promise.all([
          answerIsEnglish[0] === false
            ? translateTypedDialect(symptoms, voiceLanguage)
            : symptoms,
          answerIsEnglish[1] === false
            ? translateTypedDialect(duration, voiceLanguage)
            : duration,
          answerIsEnglish[2] === false
            ? translateTypedDialect(additionalContext, voiceLanguage)
            : additionalContext,
        ]);
      setAssessmentEnglish({
        symptoms: analysisSymptoms,
        duration: analysisDuration,
        additionalContext: analysisAdditionalContext,
      });

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptoms: analysisSymptoms,
          ...(area ? { affectedArea: area } : {}),
          ...(analysisDuration ? { duration: analysisDuration } : {}),
          ...(typeof age === "number" ? { age } : {}),
          ...(analysisAdditionalContext.trim()
            ? { additionalContext: analysisAdditionalContext.trim() }
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
            symptoms: analysisSymptoms,
            area,
            duration: analysisDuration,
            age,
            phone: normalizedPhone,
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
              ...(analysisAdditionalContext.trim()
                ? { additionalContext: analysisAdditionalContext.trim() }
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
          symptoms: assessmentEnglish?.symptoms ?? symptoms,
          area,
          duration: assessmentEnglish?.duration ?? duration,
          phone: patientPhone.trim() ? normalizeNigerianPhone(patientPhone) ?? undefined : undefined,
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

  const handleUseLocation = async () => {
    setLocationError(null);
    setIsRequestingLocation(true);
    try {
      const coordinates = await getUserLocation();
      setLatitude(coordinates.latitude);
      setLongitude(coordinates.longitude);
    } catch (locationError) {
      setLocationError(locationError instanceof Error
        ? locationError.message
        : "Your location could not be determined. Try again or enter a town or city.");
    } finally {
      setIsRequestingLocation(false);
    }
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

      {languageModalOpen && (
        <div className="assessment-language-modal-backdrop" role="presentation">
          <section
            className="assessment-language-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="language-modal-title"
          >
            <button
              type="button"
              className="assessment-language-modal-close"
              onClick={chooseTyping}
              aria-label="Close language selection and type instead"
            >
              <X aria-hidden="true" size={18} />
            </button>
            <div className="assessment-language-modal-heading">
              <span>WELCOME TO ENT-CARE</span>
              <h2 id="language-modal-title">Choose how you want to speak</h2>
              <p>
                Listen to the instructions, then press the button for your language.
              </p>
            </div>
            <div className="assessment-language-modal-options" role="radiogroup" aria-label="Choose language">
              <button
                type="button"
                role="radio"
                aria-checked={voiceLanguage === "en"}
                className="language-option language-option-green"
                onClick={() => chooseVoiceLanguage(voiceLanguages[0])}
              >
                <span className="language-option-key">PRESS GREEN</span>
                <strong>English</strong>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={voiceLanguage === "yo"}
                className="language-option language-option-black"
                onClick={() => chooseVoiceLanguage(voiceLanguages[1])}
              >
                <span className="language-option-key">TE ALÁWO DUDU</span>
                <strong>Yorùbá</strong>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={voiceLanguage === "ig"}
                className="language-option language-option-red"
                onClick={() => chooseVoiceLanguage(voiceLanguages[2])}
              >
                <span className="language-option-key">PRESS RED</span>
                <strong>Igbo</strong>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={voiceLanguage === "ha"}
                className="language-option language-option-blue"
                onClick={() => chooseVoiceLanguage(voiceLanguages[3])}
              >
                <span className="language-option-key">PRESS BLUE</span>
                <strong>Hausa</strong>
              </button>
            </div>
            <button
              type="button"
              className="assessment-language-hear-again"
              onClick={() => {
                const audio = instructionAudioRef.current;
                if (!audio) return;
                audio.pause();
                audio.currentTime = 0;
                void audio.play().catch(() => undefined);
              }}
            >
              <Volume2 aria-hidden="true" size={16} />
              Hear instructions again
            </button>
            <button
              type="button"
              className="assessment-language-type-choice"
              onClick={chooseTyping}
            >
              I prefer typing
            </button>
          </section>
        </div>
      )}

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
                  : "Let’s take this one question at a time."}
            </h1>
            <p className="assessment-lede">
              {step === 3
                ? "Review your guidance and the care options available to you."
                : step === 1
                  ? voiceInteraction
                    ? "We’ll read each question aloud. Speak or type your answer, then check it before moving on."
                    : "Type your answers in your chosen language, then review them before moving on."
                  : "A few more details can help make your guidance more relevant."}
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
                <section className="assessment-language-picker" aria-label="Choose a language">
                  <div>
                    <span className="assessment-field-heading">
                      <span className="assessment-field-number">00</span>
                      Choose your language
                    </span>
                    <p>Voice and listening can use this language.</p>
                  </div>
                  <div className="assessment-language-options" role="radiogroup" aria-label="Assessment language">
                    {voiceLanguages.map((language) => (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={voiceLanguage === language.code}
                        className={voiceLanguage === language.code ? "is-active" : ""}
                        key={language.code}
                        onClick={() => setVoiceLanguage(language.code)}
                      >
                        {language.label}
                      </button>
                    ))}
                  </div>
                </section>
                <div className="assessment-region-heading">
                  <p id="assessment-area-question" className="assessment-field-heading">
                    <span className="assessment-field-number">01</span>
                    Where are you experiencing symptoms?
                  </p>
                  <button
                    type="button"
                    className="assessment-voice-replay"
                    onClick={speakAreaQuestion}
                    aria-label="Read the affected area question aloud"
                  >
                    <Volume2 aria-hidden="true" size={16} />
                    Hear question
                  </button>
                </div>
                <fieldset
                  ref={areaFieldRef}
                  aria-labelledby="assessment-area-question"
                  className="assessment-region-field"
                >
                  <p className="assessment-field-hint">
                    Choose the area that feels closest, or leave it open if you are not sure. You can change this before submitting.
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

                {guidedQuestionIndex < guidedQuestions.length ? (
                  (() => {
                    const question = guidedQuestions[guidedQuestionIndex];
                    return (
                      <VoiceQuestion
                        key={guidedQuestionIndex}
                        languageCode={voiceLanguage}
                        languageLocale={selectedVoiceLanguage.locale}
                        enabled={!languageModalOpen}
                        voiceInteraction={voiceInteraction}
                        initialAnswerIsEnglish={
                          answerIsEnglish[guidedQuestionIndex] ??
                          (voiceLanguage === "en")
                        }
                        questionNumber={`0${guidedQuestionIndex + 2}`}
                        question={question.question}
                        prompt={question.prompt}
                        initialValue={
                          guidedQuestionIndex === 0
                            ? symptoms
                            : guidedQuestionIndex === 1
                              ? duration
                              : additionalContext
                        }
                        placeholder={question.placeholder}
                        maxLength={question.maxLength}
                        required={guidedQuestionIndex === 0}
                        quickAnswers={"quickAnswers" in question ? question.quickAnswers : []}
                        onConfirm={(answer, isEnglish) =>
                          confirmGuidedAnswer(guidedQuestionIndex, answer, isEnglish)
                        }
                        onSkip={
                          guidedQuestionIndex > 0
                            ? () => skipGuidedAnswer(guidedQuestionIndex)
                            : undefined
                        }
                      />
                    );
                  })()
                ) : (
                  <section className="assessment-guided-review" aria-label="Review your answers">
                    <div className="assessment-guided-review-heading">
                      <div>
                        <span className="assessment-result-index">CHECK BEFORE CONTINUING</span>
                        <h3>Are these answers correct?</h3>
                      </div>
                      <p>Review each answer. Edit any detail that does not match what you meant.</p>
                    </div>
                    <article>
                      <div>
                        <span>AFFECTED AREA</span>
                        <p>{areas.find((option) => option.value === area)?.label ?? "Not specified"}</p>
                      </div>
                      <button
                        type="button"
                        className="assessment-back-button"
                        onClick={() => areaFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                      >
                        <Pencil aria-hidden="true" size={14} /> Edit
                      </button>
                    </article>
                    <article>
                      <div>
                        <span>HOW YOU FEEL</span>
                        <p>{symptoms}</p>
                      </div>
                      <button type="button" className="assessment-back-button" onClick={() => editGuidedAnswer(0)}>
                        <Pencil aria-hidden="true" size={14} /> Edit
                      </button>
                    </article>
                    <article>
                      <div>
                        <span>HOW LONG</span>
                        <p>{duration || "Not provided"}</p>
                      </div>
                      <button type="button" className="assessment-back-button" onClick={() => editGuidedAnswer(1)}>
                        <Pencil aria-hidden="true" size={14} /> Edit
                      </button>
                    </article>
                    <article>
                      <div>
                        <span>ADDITIONAL DETAILS</span>
                        <p>{additionalContext || "None provided"}</p>
                      </div>
                      <button type="button" className="assessment-back-button" onClick={() => editGuidedAnswer(2)}>
                        <Pencil aria-hidden="true" size={14} /> Edit
                      </button>
                    </article>
                  </section>
                )}
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

                <div className="assessment-input-field">
                  <label className="assessment-field-heading" htmlFor="patient-phone">
                    <span className="assessment-field-number">02</span>
                    Phone number <span className="assessment-optional-label">(optional)</span>
                  </label>
                  <p className="assessment-field-hint">
                    Save reports under this Nigerian mobile number so you can find them again. Example: 09154996570.
                  </p>
                  <input
                    id="patient-phone"
                    type="tel"
                    inputMode="tel"
                    value={patientPhone}
                    onChange={(event) => setPatientPhone(event.target.value)}
                    maxLength={30}
                    autoComplete="tel"
                    className="assessment-text-input"
                    placeholder="09154996570 or +2349154996570"
                  />
                </div>

                <div className="assessment-input-field assessment-age-field">
                  <label className="assessment-field-heading" htmlFor="patient-age">
                    <span className="assessment-field-number">03</span>
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
                    <span className="assessment-field-number">04</span>
                    Is there anything else we should know?
                  </label>
                  <p className="assessment-field-hint">
                    Optional: mention which side is affected, other symptoms, recent illness, relevant conditions, medicines or allergies.
                  </p>
                  <textarea
                    id="context"
                    rows={6}
                    value={additionalContext}
                    onChange={(event) => {
                      setAdditionalContext(event.target.value);
                      setAnswerIsEnglish((current) => ({
                        ...current,
                        2: voiceLanguage === "en",
                      }));
                    }}
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

                {voiceInteraction && (
                  <div className="assessment-result-speech">
                    <button
                      type="button"
                      className="assessment-voice-replay"
                      onClick={() => void speakAssessment()}
                      disabled={isSpeakingAssessment}
                    >
                      <Volume2 aria-hidden="true" size={17} />
                      {isSpeakingAssessment ? "Speaking guidance…" : "Hear this guidance"}
                    </button>
                    {assessmentSpeechError && (
                      <p className="assessment-inline-status" role="alert">
                        {assessmentSpeechError}
                      </p>
                    )}
                  </div>
                )}

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
                disabled={step === 1 && guidedQuestionIndex === 0}
                className="assessment-back-button"
              >
                <ArrowLeft aria-hidden="true" size={16} />
                Back
              </button>

              {step === 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={guidedQuestionIndex < guidedQuestions.length}
                  className="assessment-continue-button"
                >
                  Continue to your details <ArrowRight aria-hidden="true" size={16} />
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
