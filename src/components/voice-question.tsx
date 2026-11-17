"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Mic, RotateCcw, Volume2 } from "lucide-react";

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
  onConfirm: (answer: string) => void;
  onSkip?: () => void;
};

export function speakQuestionAloud(prompt: string) {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(prompt);
  utterance.lang = languageFromBrowser();
  const voices = window.speechSynthesis.getVoices();
  const languagePrefix = utterance.lang.split("-")[0].toLowerCase();
  const voice = voices.find((candidate) => candidate.lang.toLowerCase() === utterance.lang.toLowerCase())
    ?? voices.find((candidate) => candidate.lang.toLowerCase().startsWith(`${languagePrefix}-`));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
  return true;
}

function getRecognitionConstructor() {
  const browserWindow = window as WindowWithSpeechRecognition;
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
}

function languageFromBrowser() {
  return navigator.language || "en";
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
}: VoiceQuestionProps) {
  const [answer, setAnswer] = useState(initialValue);
  const [isListening, setIsListening] = useState(false);
  const [speechConfidence, setSpeechConfidence] = useState<number | null>(null);
  const [needsVoiceReview, setNeedsVoiceReview] = useState(false);
  const [voiceReviewConfirmed, setVoiceReviewConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    speakQuestionAloud(prompt);

    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, [prompt]);

  const startListening = () => {
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
    recognition.lang = languageFromBrowser();
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
    onConfirm(normalized);
  };

  const speakQuestion = () => {
    if (!speakQuestionAloud(prompt)) {
      setError("Spoken questions are not available in this browser. The written question is still available.");
    }
  };

  const lowConfidence = speechConfidence !== null && speechConfidence < 0.65;

  return (
    <section className="assessment-voice-question" aria-labelledby="voice-question-title">
      <div className="assessment-voice-question-heading">
        <div>
          <span className="assessment-result-index">QUESTION {questionNumber}</span>
          <h3 id="voice-question-title">{question}</h3>
        </div>
        <button
          type="button"
          className="assessment-voice-replay"
          onClick={speakQuestion}
          aria-label="Read the question aloud"
        >
          <Volume2 aria-hidden="true" size={17} />
          Hear question
        </button>
      </div>

      <p className="assessment-voice-prompt">{prompt}</p>
      <div className="assessment-voice-controls">
        <button
          type="button"
          className="assessment-voice-record"
          onClick={isListening ? () => recognitionRef.current?.stop() : startListening}
          aria-pressed={isListening}
        >
          <Mic aria-hidden="true" size={17} />
          {isListening ? "Stop listening" : "Answer with my voice"}
        </button>
        <span className="assessment-voice-or">or type below</span>
      </div>
      {isListening && (
        <p className="assessment-voice-listening" role="status">
          Listening now. Speak clearly, then pause when you are finished.
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
          setSpeechConfidence(null);
          if (needsVoiceReview) setVoiceReviewConfirmed(false);
          setError(null);
        }}
        maxLength={maxLength}
        className="assessment-textarea"
        placeholder={placeholder}
        aria-describedby={`voice-review-${questionNumber}`}
        disabled={isListening}
      />
      {quickAnswers.length > 0 && (
        <div className="assessment-duration-options" aria-label="Suggested answers">
          {quickAnswers.map((quickAnswer) => (
            <button
              key={quickAnswer}
              type="button"
              onClick={() => {
                setAnswer(quickAnswer);
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
          : "Nothing moves on until you confirm your answer. You can edit it or record again."}
      </p>
      {needsVoiceReview && (
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
          disabled={isListening || (needsVoiceReview && !voiceReviewConfirmed)}
        >
          <Check aria-hidden="true" size={16} />
          Confirm answer
        </button>
        {needsVoiceReview && (
          <button type="button" className="assessment-back-button" onClick={startListening}>
            <RotateCcw aria-hidden="true" size={15} />
            Record again
          </button>
        )}
        {onSkip && (
          <button
            type="button"
            className="assessment-back-button"
            onClick={onSkip}
            disabled={isListening}
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
