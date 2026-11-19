"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Mic, RotateCcw, Volume2 } from "lucide-react";
import type { VoiceLanguageCode } from "@/lib/voice-languages";

type SpeechAlternative = {
  transcript: string;
  confidence?: number;
};

type SpeechResult = ArrayLike<SpeechAlternative> & {
  isFinal?: boolean;
};

type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
};

type SpeechErrorEvent = {
  error: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type VoiceQuestionProps = {
  questionNumber: string;
  question: string;
  prompt: string;
  initialValue: string;
  placeholder: string;
  maxLength: number;
  required?: boolean;
  quickAnswers?: readonly string[];
  onConfirm: (answer: string, isEnglish: boolean) => void;
  onSkip?: () => void;
  languageCode?: VoiceLanguageCode;
  languageLocale?: string;
  enabled?: boolean;
  voiceInteraction?: boolean;
  initialAnswerIsEnglish?: boolean;
};

export function speakQuestionAloud(
  prompt: string,
  languageLocale = "en-NG",
) {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(prompt);
  utterance.lang = languageLocale;
  const voices = window.speechSynthesis.getVoices();
  const languagePrefix = utterance.lang.split("-")[0].toLowerCase();
  const voice = voices.find((candidate) => candidate.lang.toLowerCase() === utterance.lang.toLowerCase())
    ?? voices.find((candidate) => candidate.lang.toLowerCase().startsWith(`${languagePrefix}-`));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
  return true;
}

async function speakPromptWithYarn(
  prompt: string,
  languageCode: VoiceLanguageCode,
  fallbackLocale: string,
) {
  try {
    const response = await fetch("/api/voice/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: prompt,
        target_language: languageCode,
      }),
    });
    if (!response.ok) throw new Error("YarnGPT synthesis unavailable");
    const audioUrl = URL.createObjectURL(await response.blob());
    const audio = new Audio(audioUrl);
    audio.onended = () => URL.revokeObjectURL(audioUrl);
    await audio.play();
    return true;
  } catch {
    return speakQuestionAloud(prompt, fallbackLocale);
  }
}

function getRecognitionConstructor() {
  const browserWindow = window as WindowWithSpeechRecognition;
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
}

function languageFromBrowser(languageLocale?: string) {
  return languageLocale || navigator.language || "en";
}

export default function VoiceQuestion({
  questionNumber,
  question,
  prompt,
  initialValue,
  placeholder,
  maxLength,
  required = false,
  quickAnswers = [],
  onConfirm,
  onSkip,
  languageCode = "en",
  languageLocale = "en-NG",
  enabled = true,
  voiceInteraction = true,
  initialAnswerIsEnglish = languageCode === "en",
}: VoiceQuestionProps) {
  const [answer, setAnswer] = useState(initialValue);
  const [isListening, setIsListening] = useState(false);
  const [speechConfidence, setSpeechConfidence] = useState<number | null>(null);
  const [needsVoiceReview, setNeedsVoiceReview] = useState(false);
  const [voiceReviewConfirmed, setVoiceReviewConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const answerIsEnglishRef = useRef(initialAnswerIsEnglish);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPlayingPrompt, setIsPlayingPrompt] = useState(false);

  useEffect(() => {
    if (!enabled || !voiceInteraction) return;
    let cancelled = false;
    setIsPlayingPrompt(true);
    void speakPromptWithYarn(prompt, languageCode, languageLocale).finally(() => {
      if (!cancelled) setIsPlayingPrompt(false);
    });

    return () => {
      cancelled = true;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;
    };
  }, [prompt, languageCode, languageLocale, enabled, voiceInteraction]);

  const startDialectRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is not available in this browser. You can type your answer instead.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setIsListening(false);
        const recording = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        audioChunksRef.current = [];
        if (!recording.size) {
          setError("We didn’t capture any audio. Please try again or type your answer.");
          return;
        }

        setIsTranslating(true);
        setError(null);
        try {
          const form = new FormData();
          form.append("file", recording, "voice-recording.webm");
          const response = await fetch("/api/voice/translate-audio", {
            method: "POST",
            body: form,
          });
          const payload: unknown = await response.json().catch(() => null);
          if (
            !response.ok ||
            typeof payload !== "object" ||
            payload === null ||
            !("data" in payload) ||
            typeof payload.data !== "object" ||
            payload.data === null ||
            !("translatedText" in payload.data) ||
            typeof payload.data.translatedText !== "string"
          ) {
            const message =
              typeof payload === "object" &&
              payload !== null &&
              "message" in payload &&
              typeof payload.message === "string"
                ? payload.message
                : "The recording could not be translated into English.";
            throw new Error(message);
          }
          const translatedText = payload.data.translatedText.trim();
          if (!translatedText) throw new Error("The English translation was empty.");
          setAnswer(translatedText);
          answerIsEnglishRef.current = true;
          setSpeechConfidence(null);
          setNeedsVoiceReview(true);
          setVoiceReviewConfirmed(false);
        } catch (translationError) {
          setError(
            translationError instanceof Error
              ? translationError.message
              : "The recording could not be translated into English.",
          );
        } finally {
          setIsTranslating(false);
        }
      };
      recorder.start();
      setAnswer("");
      answerIsEnglishRef.current = false;
      setSpeechConfidence(null);
      setNeedsVoiceReview(false);
      setVoiceReviewConfirmed(false);
      setError(null);
      setIsListening(true);
    } catch {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setError("Microphone access is needed for voice input. Allow access or type your answer.");
    }
  };

  const startListening = () => {
    if (languageCode !== "en") {
      void startDialectRecording();
      return;
    }
    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setError("Voice input is not available in this browser. You can type your answer instead.");
      return;
    }

    recognitionRef.current?.abort();
    setAnswer("");
    setSpeechConfidence(null);
    setNeedsVoiceReview(false);
    setVoiceReviewConfirmed(false);
    setError(null);
    const recognition = new Recognition();
    recognition.lang = languageFromBrowser(languageLocale);
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognition.onresult = (event) => {
      const result = event.results[event.resultIndex];
      const alternative = result?.[0];
      const transcript = alternative?.transcript?.trim() ?? "";
      setAnswer(transcript);
      setSpeechConfidence(
        typeof alternative?.confidence === "number" ? alternative.confidence : null,
      );
      answerIsEnglishRef.current = true;
      setNeedsVoiceReview(Boolean(transcript));
      setVoiceReviewConfirmed(false);
      setIsListening(false);
      if (!transcript) {
        setError("We didn’t catch any words. Please try again or type your answer.");
      }
      recognition.stop();
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      const messages: Record<string, string> = {
        "not-allowed": "Microphone access was blocked. Allow access in your browser or type your answer.",
        "service-not-allowed": "Voice recognition is unavailable. You can type your answer instead.",
        "no-speech": "We didn’t hear speech. Try again in a quieter place or type your answer.",
        "audio-capture": "No microphone was found. Connect a microphone or type your answer.",
        network: "Voice recognition needs an internet connection in this browser. You can type your answer.",
      };
      setError(messages[event.error] ?? "Voice recognition stopped. Please try again or type your answer.");
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      setError("The microphone could not start. Please try again or type your answer.");
    }
  };

  const confirmAnswer = () => {
    const normalized = answer.trim();
    if (required && !normalized) {
      setError("Please answer this question before continuing.");
      return;
    }
    if (normalized.length < 2 || /^\d+$/.test(normalized)) {
      setError("Please enter a few words so we can record your answer accurately.");
      return;
    }
    if (normalized.length > maxLength) {
      setError(`Keep your answer to ${maxLength} characters or fewer.`);
      return;
    }
    if (needsVoiceReview && !voiceReviewConfirmed) {
      setError("Please confirm that you checked the transcript before continuing.");
      return;
    }
    onConfirm(normalized, answerIsEnglishRef.current);
  };

  const speakQuestion = () => {
    if (!voiceInteraction) return;
    setIsPlayingPrompt(true);
    void speakPromptWithYarn(prompt, languageCode, languageLocale)
      .then((didSpeak) => {
        if (!didSpeak) {
          setError("Spoken questions are not available in this browser. The written question is still available.");
        }
      })
      .finally(() => setIsPlayingPrompt(false));
  };

  const lowConfidence = speechConfidence !== null && speechConfidence < 0.65;

  return (
    <section className="assessment-voice-question" aria-labelledby="voice-question-title">
      <div className="assessment-voice-question-heading">
        <div>
          <span className="assessment-result-index">QUESTION {questionNumber}</span>
          <h3 id="voice-question-title">{question}</h3>
        </div>
        {voiceInteraction && <button
          type="button"
          className="assessment-voice-replay"
          onClick={speakQuestion}
          aria-label="Read the question aloud"
          disabled={isPlayingPrompt}
        >
          <Volume2 aria-hidden="true" size={17} />
          {isPlayingPrompt ? "Playing…" : "Hear question"}
        </button>}
      </div>

      <p className="assessment-voice-prompt">{prompt}</p>
      {voiceInteraction && <div className="assessment-voice-controls">
        <button
          type="button"
          className="assessment-voice-record"
          onClick={isListening
            ? () => {
                if (languageCode === "en") recognitionRef.current?.stop();
                else mediaRecorderRef.current?.stop();
              }
            : startListening}
          aria-pressed={isListening}
          disabled={isTranslating}
        >
          <Mic aria-hidden="true" size={17} />
          {isListening ? "Stop listening" : languageCode === "en" ? "Answer with my voice" : "Record my answer"}
        </button>
        <span className="assessment-voice-or">or type below</span>
      </div>}
      {isListening && (
        <p className="assessment-voice-listening" role="status">
          {languageCode === "en"
            ? "Listening now. Speak clearly, then pause when you are finished."
            : "Recording now. Speak clearly, then select Stop listening when finished."}
        </p>
      )}
      {isTranslating && (
        <p className="assessment-voice-listening" role="status">
          Transcribing and translating your answer into English…
        </p>
      )}

      <label className="assessment-voice-answer-label" htmlFor={`voice-answer-${questionNumber}`}>
        Your answer
      </label>
      <textarea
        id={`voice-answer-${questionNumber}`}
        rows={3}
        value={answer}
        onChange={(event) => {
          setAnswer(event.target.value);
          answerIsEnglishRef.current = languageCode === "en";
          setSpeechConfidence(null);
          if (needsVoiceReview) setVoiceReviewConfirmed(false);
          setError(null);
        }}
        maxLength={maxLength}
        className="assessment-textarea"
        placeholder={placeholder}
        aria-describedby={`voice-review-${questionNumber}`}
        disabled={isListening || isTranslating}
      />
      {quickAnswers.length > 0 && (
        <div className="assessment-duration-options" aria-label="Suggested answers">
          {quickAnswers.map((quickAnswer) => (
            <button
              key={quickAnswer}
              type="button"
              disabled={isListening || isTranslating}
              onClick={() => {
                setAnswer(quickAnswer);
                answerIsEnglishRef.current = true;
                setNeedsVoiceReview(false);
                setSpeechConfidence(null);
                setError(null);
              }}
              aria-pressed={answer === quickAnswer}
              className={`assessment-duration-option${answer === quickAnswer ? " is-active" : ""}`}
            >
              {quickAnswer}
            </button>
          ))}
        </div>
      )}
      <p
        id={`voice-review-${questionNumber}`}
        className="assessment-voice-review-note"
        role="status"
        aria-live="polite"
      >
        {needsVoiceReview
          ? lowConfidence
            ? "We may not have heard every word clearly. Review and correct the transcript before confirming."
            : "Please review the words above and correct anything we misheard before confirming."
          : languageCode !== "en" && !answerIsEnglishRef.current
            ? "Your typed answer will be translated into English before the assessment."
            : "Nothing moves on until you confirm your answer. You can edit it or record again."}
      </p>
      {needsVoiceReview && voiceInteraction && (
        <label className="assessment-voice-transcript-check">
          <input
            type="checkbox"
            checked={voiceReviewConfirmed}
            onChange={(event) => setVoiceReviewConfirmed(event.target.checked)}
          />
          <span>I checked the transcript and it matches what I meant to say.</span>
        </label>
      )}
      {error && <p className="assessment-inline-status assessment-email-error" role="alert">{error}</p>}

      <div className="assessment-voice-actions">
        <button
          type="button"
          className="assessment-continue-button"
          onClick={confirmAnswer}
          disabled={isListening || isTranslating || (needsVoiceReview && !voiceReviewConfirmed)}
        >
          <Check aria-hidden="true" size={16} />
          Confirm answer
        </button>
        {needsVoiceReview && voiceInteraction && (
          <button
            type="button"
            className="assessment-back-button"
            onClick={startListening}
            disabled={isListening || isTranslating}
          >
            <RotateCcw aria-hidden="true" size={15} />
            Record again
          </button>
        )}
        {onSkip && (
          <button
            type="button"
            className="assessment-back-button"
            onClick={onSkip}
            disabled={isListening || isTranslating}
          >
            Skip this question
          </button>
        )}
      </div>
      <p className="assessment-voice-privacy">
        Your microphone starts only when you choose voice input. The app does not save audio; your confirmed words are sent with your assessment. Browser voice recognition may process audio according to your browser’s privacy settings.
      </p>
    </section>
  );
}
