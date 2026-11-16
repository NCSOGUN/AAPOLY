import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileImage,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Menu,
  Pencil,
  Printer,
  ShieldCheck,
  Stethoscope,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { flushSync } from "react-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import logo from "../assets/aap-logo-img.png";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { printWithClass } from "@/lib/print";
import type { HospitalSession } from "@/lib/api";
import type { SecureSessionVault } from "@/lib/sessionStore";
import { DiagnosisWorkspace } from "@/components/DiagnosisWorkspace";
import { ReportSearch } from "@/components/records/ReportSearch";
import { EscalatedCases } from "@/components/records/EscalatedCases";
import { PatientVisits } from "@/components/records/PatientVisits";
import { ReferralWorkflow } from "@/components/records/ReferralWorkflow";
import earImage from "../assets/ent-images/ear.png";
import noseImage from "../assets/ent-images/nose.png";
import throatImage from "../assets/ent-images/throat.png";

const symptomOptions = {
  Ear: [
    "Ear pain",
    "Hearing difficulty",
    "Ear discharge",
    "Ringing",
    "Blocked ear",
    "Itching",
    "Dizziness",
    "Balance problems",
  ],
  Nose: [
    "Nasal congestion",
    "Runny nose",
    "Sneezing",
    "Nose bleeding",
    "Sinus pain",
    "Facial pressure",
    "Loss of smell",
  ],
  Throat: [
    "Sore throat",
    "Difficulty swallowing",
    "Hoarseness",
    "Voice changes",
    "Persistent cough",
    "Tonsil problems",
    "Neck swelling",
  ],
} as const;

const areaImages = {
  Ear: earImage,
  Nose: noseImage,
  Throat: throatImage,
} as const;

const emergencyOptions = [
  "Severe difficulty breathing",
  "Uncontrolled bleeding",
  "Sudden hearing loss",
  "Severe throat swelling",
] as const;

const intakeSchema = z.object({
  firstName: z.string().trim().min(1, "Enter the patient's first name."),
  lastName: z.string().trim().min(1, "Enter the patient's last name."),
  dateOfBirth: z.string().min(1, "Enter the patient's date of birth."),
  sex: z.string().min(1, "Select an option."),
  phone: z.string().trim().min(7, "Enter a valid phone number."),
  email: z.union([z.literal(""), z.string().email("Enter a valid email address.")]),
  address: z.string().trim().min(1, "Enter the patient's location."),
  emergencyContact: z.string().optional(),
  complaint: z.string().trim().min(5, "Add a short description of the main concern."),
  symptomAreas: z.array(z.string()).min(1, "Select at least one affected area."),
  symptoms: z.array(z.string()).min(1, "Select at least one symptom."),
  otherSymptoms: z.string().optional(),
  onset: z.string().optional(),
  painLevel: z.string().optional(),
  dailyImpact: z.string().optional(),
  medicalHistory: z.string().optional(),
  allergies: z.string().optional(),
  medications: z.string().optional(),
  previousTreatment: z.string().optional(),
  emergencySymptoms: z.array(z.string()),
});

type IntakeValues = z.infer<typeof intakeSchema>;
type IntakeStep = 0 | 1 | 2;
type WorkspaceView = "intake" | "visits" | "reports" | "escalated" | "referrals";
type ImageFile = { file: File; preview: string };
type AutosaveStatus = "idle" | "saving" | "saved" | "error";

const steps = [
  { title: "Patient details", caption: "Basic information", icon: UserRound },
  { title: "Symptoms", caption: "Current concern", icon: HeartPulse },
  { title: "Health history", caption: "Context & attachments", icon: FileText },
];

const inputClass = "field-control";
const labelClass = "field-label";

function FieldError({ children }: { children?: string }) {
  return children ? <p className="field-error" role="alert">{children}</p> : null;
}

function FormLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <span className={labelClass}>
      {children}
      {required && <span className="required-mark" aria-hidden="true"> *</span>}
    </span>
  );
}

function App({
  session,
  vault,
  isOffline,
  onLock,
}: {
  session: Pick<HospitalSession, "token" | "user">;
  vault: SecureSessionVault;
  isOffline: boolean;
  onLock: () => Promise<void>;
}) {
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("intake");
  const [activeModal, setActiveModal] = useState<"notifications" | "profile" | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<IntakeStep>(0);
  const [submitted, setSubmitted] = useState(false);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [submittedValues, setSubmittedValues] = useState<IntakeValues | null>(null);
  const [imageError, setImageError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savedVisitId, setSavedVisitId] = useState("");
  const [printMetadata, setPrintMetadata] = useState<{ formId: string; printedAt: string } | null>(null);
  const [printError, setPrintError] = useState("");
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle");
  const savedVisitIdRef = useRef("");
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastSavedSnapshotRef = useRef("");
  const currentSnapshotRef = useRef("");
  const modalCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!activeModal) return;
    const previousFocus = document.activeElement;
    modalCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveModal(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [activeModal]);

  const {
    control,
    register,
    handleSubmit,
    getValues,
    watch,
    reset,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<IntakeValues>({
    resolver: zodResolver(intakeSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      sex: "",
      phone: "",
      email: "",
      address: "",
      emergencyContact: "",
      complaint: "",
      symptomAreas: [],
      symptoms: [],
      otherSymptoms: "",
      onset: "",
      painLevel: "",
      dailyImpact: "",
      medicalHistory: "",
      allergies: "",
      medications: "",
      previousTreatment: "",
      emergencySymptoms: [],
    },
  });

  const selectedAreas = watch("symptomAreas");
  const selectedSymptoms = watch("symptoms");
  const emergencySymptoms = watch("emergencySymptoms");
  const intakeSnapshot = JSON.stringify(watch());
  currentSnapshotRef.current = intakeSnapshot;
  const patientName = [watch("firstName"), watch("lastName")].filter(Boolean).join(" ");
  const initials = session.user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  function showIntakeSaveError(error: unknown) {
    setAutosaveStatus("error");
    setSaveError(
      error instanceof Error
        ? `Could not save this intake locally: ${error.message}`
        : "Could not save this intake locally.",
    );
  }

  function persistIntake(values: IntakeValues): Promise<string> {
    const visitId = savedVisitIdRef.current || crypto.randomUUID();
    savedVisitIdRef.current = visitId;
    setAutosaveStatus("saving");
    const operation = saveQueueRef.current.then(async () => {
      const saved = await vault.savePatientVisit(values, visitId);
      if (savedVisitIdRef.current === visitId) {
        setSavedVisitId(saved.id);
        setAutosaveStatus("saved");
        setSaveError("");
        const snapshot = JSON.stringify(values);
        if (currentSnapshotRef.current === snapshot) {
          lastSavedSnapshotRef.current = snapshot;
        }
      }
      return saved.id;
    });
    saveQueueRef.current = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  useEffect(() => {
    if (intakeSnapshot === lastSavedSnapshotRef.current) return;
    let values: IntakeValues;
    try {
      values = JSON.parse(intakeSnapshot) as IntakeValues;
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? `Could not prepare this intake for local saving: ${error.message}`
          : "Could not prepare this intake for local saving.",
      );
      setAutosaveStatus("error");
      return;
    }
    const hasContent = Object.values(values).some((value) =>
      typeof value === "string" ? value.trim().length > 0 : Array.isArray(value) && value.length > 0,
    );
    if (!hasContent) return;

    const timer = window.setTimeout(() => {
      void persistIntake(values).catch(showIntakeSaveError);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [intakeSnapshot, vault]);

  const toggleArrayValue = (
    value: string,
    values: string[],
    onChange: (next: string[]) => void,
  ) => {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
    setSubmitted(false);
  };

  function navigateTo(view: WorkspaceView) {
    setWorkspaceView(view);
    setMobileMenuOpen(false);
  }

  async function printBlankForm() {
    setPrintError("");
    flushSync(() => {
      setPrintMetadata({
        formId: `ENT-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        printedAt: new Date().toLocaleString(),
      });
    });
    try {
      await printWithClass("print-intake", ".print-form");
    } catch (error) {
      setPrintError(
        error instanceof Error ? error.message : "Could not print the blank intake form.",
      );
    }
  }

  const stepFields: Record<IntakeStep, (keyof IntakeValues)[]> = {
    0: ["firstName", "lastName", "dateOfBirth", "sex", "phone", "email", "address"],
    1: ["complaint", "symptomAreas", "symptoms"],
    2: [],
  };

  async function goToStep(next: IntakeStep) {
    if (next > activeStep) {
      const valid = await trigger(stepFields[activeStep], { shouldFocus: true });
      if (!valid) return;
    }
    setActiveStep(next);
  }

  function onImageSelect(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files);
    if (images.length + selected.length > 3) {
      setImageError("Add up to 3 images.");
      return;
    }
    const invalidFile = selected.find(
      (file) =>
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 4 * 1024 * 1024,
    );
    if (invalidFile) {
      setImageError("Use JPG, PNG or WebP images under 4 MB each.");
      return;
    }
    setImageError("");
    setImages((current) => [
      ...current,
      ...selected.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
  }

  function removeImage(preview: string) {
    URL.revokeObjectURL(preview);
    setImages((current) => current.filter((image) => image.preview !== preview));
  }

  function startNewIntake() {
    images.forEach(({ preview }) => URL.revokeObjectURL(preview));
    setImages([]);
    setImageError("");
    setSaveError("");
    setSavedVisitId("");
    savedVisitIdRef.current = "";
    lastSavedSnapshotRef.current = "";
    setAutosaveStatus("idle");
    setSubmittedValues(null);
    setSubmitted(false);
    setActiveStep(0);
    reset();
  }

  function editCurrentIntake() {
    setSubmittedValues(null);
    setSubmitted(false);
    setActiveStep(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const onSubmit = handleSubmit(async (values) => {
    setSaveError("");
    try {
      const visitId = await persistIntake(values);
      setSavedVisitId(visitId);
      setSubmittedValues(values);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      showIntakeSaveError(error);
    }
  });

  function saveIntakeOnBlur() {
    const values = getValues();
    const hasContent = Object.values(values).some((value) =>
      typeof value === "string" ? value.trim().length > 0 : Array.isArray(value) && value.length > 0,
    );
    if (hasContent) void persistIntake(values).catch(showIntakeSaveError);
  }

  function editSavedVisit(visitId: string, data: Record<string, unknown>) {
    const stringFields = [
      "firstName", "lastName", "dateOfBirth", "sex", "phone", "email",
      "address", "emergencyContact", "complaint", "otherSymptoms", "onset",
      "painLevel", "dailyImpact", "medicalHistory", "allergies", "medications",
      "previousTreatment",
    ] as const;
    const values: IntakeValues = {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      sex: "",
      phone: "",
      email: "",
      address: "",
      emergencyContact: "",
      complaint: "",
      symptomAreas: [],
      symptoms: [],
      otherSymptoms: "",
      onset: "",
      painLevel: "",
      dailyImpact: "",
      medicalHistory: "",
      allergies: "",
      medications: "",
      previousTreatment: "",
      emergencySymptoms: [],
    };
    for (const key of stringFields) {
      if (typeof data[key] === "string") values[key] = data[key];
    }
    const arrayFields = ["symptomAreas", "symptoms", "emergencySymptoms"] as const;
    for (const key of arrayFields) {
      const value = data[key];
      if (Array.isArray(value)) {
        values[key] = value.filter((item): item is string => typeof item === "string");
      }
    }
    savedVisitIdRef.current = visitId;
    setSavedVisitId(visitId);
    setSubmittedValues(null);
    setSubmitted(false);
    setAutosaveStatus("saved");
    setSaveError("");
    reset(values);
    setActiveStep(0);
    navigateTo("intake");
  }

  return (
    <div className="app-shell">
      {mobileMenuOpen && (
        <button
          type="button"
          className="mobile-nav-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside className={cn("sidebar", mobileMenuOpen && "mobile-open")} id="workspace-navigation">
        <div className="brand">
          <div className="brand-mark">
            <img src={logo} alt="Abraham Adesanya Polytechnic" />
          </div>
          <div className="brand-divider" />
          <div className="brand-product">
            <span className="brand-product-name">ENT<span>-Care</span></span>
            <span className="brand-product-caption">HOSPITAL WORKSPACE</span>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <button type="button" className={cn("nav-item", workspaceView === "intake" && "is-current")} onClick={() => navigateTo("intake")}>
            <LayoutDashboard size={18} />
            <span>Patient intake</span>
          </button>
          <button type="button" className={cn("nav-item", workspaceView === "visits" && "is-current")} onClick={() => navigateTo("visits")}>
            <FileText size={18} />
            <span>Saved visits</span>
          </button>
          <button type="button" className={cn("nav-item", workspaceView === "reports" && "is-current")} onClick={() => navigateTo("reports")}>
            <UsersRound size={18} />
            <span>Patient reports</span>
          </button>
          <button type="button" className={cn("nav-item", workspaceView === "escalated" && "is-current")} onClick={() => navigateTo("escalated")}>
            <ClipboardList size={18} />
            <span>Escalated cases</span>
          </button>
          <button type="button" className={cn("nav-item", workspaceView === "referrals" && "is-current")} onClick={() => navigateTo("referrals")}>
            <CalendarIcon />
            <span>Referrals</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <div className="sidebar-help-icon"><ShieldCheck size={18} /></div>
            <p>Patient information is sensitive. Keep your workspace secure.</p>
            <button type="button" aria-label="Learn about patient data security">
              <ChevronRight size={16} />
            </button>
          </div>
          <button type="button" className="profile-button" onClick={() => setActiveModal("profile")} title="View profile and session options">
            <div className="avatar">{initials}</div>
            <div className="profile-copy">
              <strong>{session.user.name}</strong>
              <span>{session.user.specialization ?? session.user.role}</span>
            </div>
            <ChevronRight size={16} className="profile-chevron" />
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand">
            <img src={logo} alt="Abraham Adesanya Polytechnic" />
            <span>ENT-Care</span>
          </div>
          <div className="breadcrumbs">
            <span>{session.user.facility.name}</span>
            <ChevronRight size={14} />
            <span className="breadcrumb-current">
              {workspaceView === "reports"
                ? "Patient reports"
                : workspaceView === "escalated"
                  ? "Escalated cases"
                  : workspaceView === "visits"
                    ? "Saved visits"
                    : workspaceView === "referrals"
                      ? "Referrals"
                      : "Patient intake"}
            </span>
          </div>
          <div className="topbar-right">
            <div className={`online-indicator ${isOffline ? "is-offline" : "is-online"}`} aria-label={isOffline ? "Connection offline" : "Connection online"}>
              <span /> {isOffline ? "Offline" : "Online"}
            </div>
            <button
              className="icon-button"
              aria-label={isOffline ? "Notifications: offline connection" : "Notifications"}
              aria-haspopup="dialog"
              aria-expanded={activeModal === "notifications"}
              type="button"
              onClick={() => setActiveModal("notifications")}
            >
              <Bell size={19} />
              {isOffline && <i className="notification-indicator" />}
            </button>
            <div className="topbar-avatar">{initials}</div>
            <button
              className="mobile-menu"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="workspace-navigation"
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-dot" /> PATIENT CARE</div>
              <h1>
                {workspaceView === "reports"
                  ? "Patient reports"
                  : workspaceView === "escalated"
                    ? "Escalated cases"
                    : workspaceView === "visits"
                      ? "Saved visits"
                      : workspaceView === "referrals"
                        ? "Referrals"
                        : "Patient intake"}
              </h1>
              <p className="page-subtitle">
                {workspaceView === "reports"
                  ? "Find a submitted report by its tracking ID."
                  : workspaceView === "escalated"
                    ? "Review and respond to cases assigned to your facility."
                    : workspaceView === "visits"
                      ? "Review patient intake records saved securely on this device."
                      : workspaceView === "referrals"
                        ? "Find nearby care and prepare a local referral draft."
                        : "A clear picture of the patient starts here."}
              </p>
            </div>
            {workspaceView === "intake" && <div className="heading-actions">
              <Button variant="outline" type="button" onClick={() => void printBlankForm()}>
                <Printer size={16} /> Print blank form
              </Button>
              <span className={`intake-reference${autosaveStatus === "saved" ? " is-saved" : ""}`}>
                <span className="status-dot" />
                {autosaveStatus === "saving"
                  ? "Saving securely…"
                  : autosaveStatus === "saved"
                    ? "Draft saved on this device"
                    : autosaveStatus === "error"
                      ? "Local save needs attention"
                      : "New patient"}
              </span>
            </div>}
          </div>
          {workspaceView === "intake" && printError && (
            <div className="panel-error" role="alert"><AlertTriangle size={16} />{printError}</div>
          )}

          <div className="print-form">
            <img className="print-watermark" src={logo} alt="" aria-hidden="true" />
            <header className="print-header">
              <img src={logo} alt="Abraham Adesanya Polytechnic" />
              <div>
                <h1>Patient intake form</h1>
                <p>{session.user.facility.name}</p>
              </div>
            </header>
            <div className="print-form-meta">
              <span><strong>Form ID:</strong> {printMetadata?.formId ?? "Assigned when printed"}</span>
              <span><strong>Date printed:</strong> {printMetadata?.printedAt ?? "—"}</span>
              <span><strong>Medical centre:</strong> {session.user.facility.name}</span>
            </div>
            <p className="print-disclaimer">For clinical intake only. This form does not provide a diagnosis. Keep completed forms confidential.</p>
            <section className="print-section">
              <h2>Patient details</h2>
              <div className="print-fields">
                <p className="print-field tall">Full name <span /></p><p className="print-field">Date of birth <span /></p>
                <div className="print-sex"><strong>Sex</strong><span>□ M</span><span>□ F</span><span>□ Other / prefer not to say</span></div>
                <div className="print-phone"><strong>Phone number (11 digits)</strong><div aria-label="Eleven digit phone number entry boxes">{Array.from({ length: 11 }, (_, index) => <i key={index} />)}</div></div>
                <p className="print-field">Email address <span /></p><p className="print-field">Emergency contact &amp; phone <span /></p>
                <p className="print-field print-wide tall">Residential address or location <span /></p>
              </div>
            </section>
            <section className="print-section">
              <h2>Symptoms &amp; concerns</h2>
              <div className="print-fields">
                <p className="print-field print-wide tall">Main concern, in patient's words <span /></p>
                <div className="print-checks print-wide"><strong>Affected area</strong><span>□ Ear</span><span>□ Nose</span><span>□ Throat</span><span>□ Other: __________________</span></div>
                <div className="print-writing-box print-wide"><strong>Symptoms reported</strong><i /><i /></div>
                <p className="print-field">When did it begin? <span /></p><p className="print-field">Pain level (0–10) <span /></p>
                <div className="print-writing-box print-wide"><strong>Effect on daily activities</strong><i /><i /></div>
                <div className="print-writing-box print-wide"><strong>Other symptoms or details</strong><i /><i /></div>
              </div>
            </section>
            <section className="print-section">
              <h2>Health history</h2>
              <div className="print-fields">
                <div className="print-writing-box print-wide"><strong>Medical history / previous ENT concerns</strong><i /><i /></div>
                <p className="print-field print-wide">Known allergies <span /></p>
                <p className="print-field print-wide">Current medications <span /></p>
                <div className="print-writing-box print-wide"><strong>Previous treatment</strong><i /><i /></div>
                <div className="print-checks print-wide"><strong>Images attached (if applicable)</strong><span>□ Yes</span><span>□ No</span></div>
              </div>
            </section>
            <section className="print-emergency">
              <strong>Immediate attention check</strong>
              <div className="print-checks"><span>□ Severe difficulty breathing</span><span>□ Uncontrolled bleeding</span><span>□ Sudden hearing loss</span><span>□ Severe throat swelling</span></div>
              <p>If a potential emergency symptom is present, arrange immediate clinical assessment; do not wait for a routine appointment.</p>
            </section>
            <div className="print-signatures">
              <span>Patient / representative signature <i /></span>
              <span>Date <i /></span>
              <span>Staff member / clinician <i /></span>
            </div>
            <footer className="print-form-footer">
              <span>Confidential patient information · Handle according to facility policy</span>
              <small>{session.user.facility.name} · Form ID: {printMetadata?.formId ?? "Assigned when printed"} · Printed: {printMetadata?.printedAt ?? "—"}</small>
            </footer>
          </div>

          {workspaceView === "visits" && (
            <PatientVisits
              vault={vault}
              token={session.token}
              isOffline={isOffline}
              facility={session.user.facility}
              onEditVisit={editSavedVisit}
            />
          )}
          {workspaceView === "reports" && (
            <ReportSearch token={session.token} facilityName={session.user.facility.name} />
          )}
          {workspaceView === "escalated" && <EscalatedCases token={session.token} />}
          {workspaceView === "referrals" && (
            <ReferralWorkflow
              token={session.token}
              vault={vault}
              doctorName={session.user.name}
              facility={session.user.facility}
              isOffline={isOffline}
            />
          )}
          {workspaceView === "intake" && <div className="intake-layout">
            <div className="form-column">
              {submitted ? (
                <Card className="submitted-card">
                  <div className="success-icon"><Check size={24} /></div>
                  <div className="submitted-content">
                    <p className="section-kicker">INTAKE COMPLETE</p>
                    <h2>Patient information captured</h2>
                    <p className="submitted-description">
                      {patientName ? `${patientName}'s` : "The patient's"} intake details are saved securely on this device.
                      Run an online clinical analysis below when a clinician is ready. Intake information is not sent to
                      the ENT-Care service until you request analysis.
                    </p>
                    <p className="saved-record-reference">Local record · {savedVisitId}</p>
                    {emergencySymptoms.length > 0 && (
                      <div className="emergency-notice" role="alert">
                        <AlertTriangle size={18} />
                        <span>
                          Potential emergency symptoms were selected. Arrange immediate clinical
                          assessment; do not wait for a routine appointment.
                        </span>
                      </div>
                    )}
                    {submittedValues && (
                      <DiagnosisWorkspace
                        token={session.token}
                        intake={{
                          ...submittedValues,
                          patientName,
                        }}
                        imageFiles={images.map(({ file }) => file)}
                        visitId={savedVisitId}
                        vault={vault}
                        isOffline={isOffline}
                        facility={session.user.facility}
                      />
                    )}
                    <div className="submitted-actions">
                      <Button type="button" variant="outline" onClick={editCurrentIntake}>
                        <Pencil size={16} /> Edit saved intake
                      </Button>
                      <Button type="button" onClick={startNewIntake}><ClipboardList size={16} /> Start another intake</Button>
                      <Button type="button" variant="outline" onClick={() => void printBlankForm()}><Printer size={16} /> Print blank form</Button>
                    </div>
                  </div>
                </Card>
              ) : (
                <form onSubmit={onSubmit} onBlurCapture={saveIntakeOnBlur} noValidate>
                  <Card className="step-card">
                    <div className="step-track" aria-label="Intake steps">
                      {steps.map((step, index) => {
                        const Icon = step.icon;
                        const isActive = index === activeStep;
                        const isComplete = index < activeStep;
                        return (
                          <button
                            type="button"
                            key={step.title}
                            className={cn("step-item", isActive && "is-active", isComplete && "is-complete")}
                            onClick={() => goToStep(index as IntakeStep)}
                            aria-current={isActive ? "step" : undefined}
                          >
                            <span className="step-icon">
                              {isComplete ? <Check size={16} /> : <Icon size={16} />}
                            </span>
                            <span className="step-copy">
                              <strong>{step.title}</strong>
                              <small>{step.caption}</small>
                            </span>
                            {index < steps.length - 1 && <span className="step-connector" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="progress-track"><span style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }} /></div>
                  </Card>

                  {activeStep === 0 && (
                    <Card className="form-card">
                      <div className="section-heading">
                        <div className="section-icon teal"><UserRound size={18} /></div>
                        <div>
                          <h2>Patient details</h2>
                          <p>Enter the patient's personal and contact information.</p>
                        </div>
                        <span className="section-number">01</span>
                      </div>
                      <div className="form-divider" />

                      <div className="form-grid">
                        <div className="form-group-heading full-width">
                          <h3>Personal information</h3>
                          <span>Fields marked with * are required.</span>
                        </div>
                        <label className="field">
                          <FormLabel required>First name</FormLabel>
                          <Input className={inputClass} placeholder="e.g. Adeola" autoComplete="given-name" {...register("firstName")} />
                          <FieldError>{errors.firstName?.message}</FieldError>
                        </label>
                        <label className="field">
                          <FormLabel required>Last name</FormLabel>
                          <Input className={inputClass} placeholder="e.g. Adebayo" autoComplete="family-name" {...register("lastName")} />
                          <FieldError>{errors.lastName?.message}</FieldError>
                        </label>
                        <label className="field">
                          <FormLabel required>Date of birth</FormLabel>
                          <Input className={inputClass} type="date" autoComplete="bday" {...register("dateOfBirth")} />
                          <FieldError>{errors.dateOfBirth?.message}</FieldError>
                        </label>
                        <label className="field">
                          <FormLabel required>Sex</FormLabel>
                          <select className={cn(inputClass, "select-control")} {...register("sex")} defaultValue="">
                            <option value="" disabled>Select an option</option>
                            <option value="female">Female</option>
                            <option value="male">Male</option>
                            <option value="intersex">Intersex</option>
                            <option value="prefer-not-to-say">Prefer not to say</option>
                          </select>
                          <FieldError>{errors.sex?.message}</FieldError>
                        </label>
                        <div className="form-group-heading full-width">
                          <h3>Contact information</h3>
                        </div>
                        <label className="field">
                          <FormLabel required>Phone number</FormLabel>
                          <Input className={inputClass} type="tel" placeholder="+234 801 234 5678" autoComplete="tel" {...register("phone")} />
                          <FieldError>{errors.phone?.message}</FieldError>
                        </label>
                        <label className="field">
                          <FormLabel>Email address <span className="optional-label">Optional</span></FormLabel>
                          <Input className={inputClass} type="email" placeholder="name@example.com" autoComplete="email" {...register("email")} />
                          <FieldError>{errors.email?.message}</FieldError>
                        </label>
                        <label className="field full-width">
                          <FormLabel required>Residential address or location</FormLabel>
                          <Input className={inputClass} placeholder="Street, area, town or community" autoComplete="street-address" {...register("address")} />
                          <FieldError>{errors.address?.message}</FieldError>
                        </label>
                        <label className="field full-width">
                          <FormLabel>Emergency contact <span className="optional-label">Optional</span></FormLabel>
                          <Input className={inputClass} type="tel" placeholder="Contact name and phone number" {...register("emergencyContact")} />
                        </label>
                      </div>

                      <div className="form-footer">
                        <span className="privacy-footnote">
                          <ShieldCheck size={15} />
                          {autosaveStatus === "saving"
                            ? "Saving securely on this device…"
                            : autosaveStatus === "saved"
                              ? "Draft saved securely on this device."
                              : "Only collect details needed for care."}
                        </span>
                        <Button type="button" onClick={() => goToStep(1)}>Continue to symptoms <ArrowRight size={16} /></Button>
                      </div>
                    </Card>
                  )}

                  {activeStep === 1 && (
                    <Card className="form-card">
                      <div className="section-heading">
                        <div className="section-icon coral"><HeartPulse size={18} /></div>
                        <div>
                          <h2>Symptoms &amp; concerns</h2>
                          <p>Record the patient's main concern and current symptoms.</p>
                        </div>
                        <span className="section-number">02</span>
                      </div>
                      <div className="form-divider" />

                      <div className="form-grid">
                        <div className="form-group-heading full-width">
                          <h3>Presenting concern</h3>
                          <span>Record what the patient reports; do not infer a diagnosis.</span>
                        </div>
                        <label className="field full-width">
                          <FormLabel required>Main concern</FormLabel>
                          <Textarea className={cn("field-textarea", "complaint-textarea")} placeholder="Describe the main problem in the patient's own words…" {...register("complaint")} />
                          <FieldError>{errors.complaint?.message}</FieldError>
                        </label>

                        <div className="field full-width">
                          <FormLabel required>Affected area</FormLabel>
                          <p className="field-hint">Choose all areas related to this concern.</p>
                          <Controller
                            name="symptomAreas"
                            control={control}
                            render={({ field }) => (
                              <div className="choice-row">
                                {Object.keys(symptomOptions).map((area) => (
                                  <button
                                    key={area}
                                    type="button"
                                    aria-pressed={field.value.includes(area)}
                                    className={cn("choice-chip", field.value.includes(area) && "selected")}
                                    onClick={() => {
                                      const nextAreas = field.value.includes(area)
                                        ? field.value.filter((value) => value !== area)
                                        : [...field.value, area];
                                      field.onChange(nextAreas);
                                      if (!nextAreas.includes(area)) {
                                        const symptomsForArea = symptomOptions[area as keyof typeof symptomOptions];
                                        setValue(
                                          "symptoms",
                                          watch("symptoms").filter(
                                            (symptom) =>
                                              !symptomsForArea.some((option) => option === symptom),
                                          ),
                                        );
                                      }
                                    }}
                                  >
                                    <img className="area-choice-image" src={areaImages[area as keyof typeof areaImages]} alt="" />
                                    {area}
                                    {field.value.includes(area) && <Check size={15} />}
                                  </button>
                                ))}
                              </div>
                            )}
                          />
                          <FieldError>{errors.symptomAreas?.message}</FieldError>
                        </div>

                        {selectedAreas.length > 0 && (
                          <div className="field full-width">
                            <FormLabel required>Symptoms reported</FormLabel>
                            <p className="field-hint">
                              Select all that apply. {selectedSymptoms.length > 0 && `${selectedSymptoms.length} selected.`}
                            </p>
                            <Controller
                              name="symptoms"
                              control={control}
                              render={({ field }) => (
                                <div className="symptom-groups">
                                  {selectedAreas.map((area) => (
                                    <div key={area} className="symptom-group">
                                      <span className="symptom-area-label">{area}</span>
                                      <div className="symptom-options">
                                        {symptomOptions[area as keyof typeof symptomOptions].map((symptom) => (
                                          <label key={symptom} className={cn("check-option", field.value.includes(symptom) && "checked")}>
                                            <input
                                              type="checkbox"
                                              checked={field.value.includes(symptom)}
                                              onChange={() => toggleArrayValue(symptom, field.value, field.onChange)}
                                            />
                                            <span className="custom-check">{field.value.includes(symptom) && <Check size={12} />}</span>
                                            {symptom}
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            />
                            <FieldError>{errors.symptoms?.message}</FieldError>
                          </div>
                        )}

                        <div className="form-group-heading full-width">
                          <h3>Additional clinical details</h3>
                        </div>
                        <label className="field full-width">
                          <FormLabel>Other symptoms or details <span className="optional-label">Optional</span></FormLabel>
                          <Input className={inputClass} placeholder="Anything else the patient has noticed…" {...register("otherSymptoms")} />
                        </label>
                        <label className="field">
                          <FormLabel>When did it begin? <span className="optional-label">Optional</span></FormLabel>
                          <Input className={inputClass} placeholder="e.g. About 4 days ago" {...register("onset")} />
                        </label>
                        <label className="field">
                          <FormLabel>Pain level <span className="optional-label">Optional · 0–10</span></FormLabel>
                          <select className={cn(inputClass, "select-control")} defaultValue="" {...register("painLevel")}>
                            <option value="">Not reported</option>
                            {Array.from({ length: 11 }, (_, i) => <option value={String(i)} key={i}>{i} — {i === 0 ? "No pain" : i === 10 ? "Worst pain" : ""}</option>)}
                          </select>
                        </label>
                        <label className="field full-width">
                          <FormLabel>Effect on daily activities <span className="optional-label">Optional</span></FormLabel>
                          <Input className={inputClass} placeholder="e.g. Trouble sleeping, working or eating" {...register("dailyImpact")} />
                        </label>
                      </div>

                      <div className="form-footer">
                        <Button type="button" variant="outline" onClick={() => goToStep(0)}><ArrowLeft size={16} /> Back</Button>
                        <Button type="button" onClick={() => goToStep(2)}>Continue to health history <ArrowRight size={16} /></Button>
                      </div>
                    </Card>
                  )}

                  {activeStep === 2 && (
                    <Card className="form-card">
                      <div className="section-heading">
                        <div className="section-icon lavender"><FileText size={18} /></div>
                        <div>
                          <h2>Health history &amp; attachments</h2>
                          <p>Relevant history helps the care team understand the full picture.</p>
                        </div>
                        <span className="section-number">03</span>
                      </div>
                      <div className="form-divider" />

                      <div className="form-group-heading">
                        <h3>Relevant clinical history</h3>
                        <span>Include information relevant to this visit.</span>
                      </div>
                      <div className="form-grid history-grid">
                        <label className="field">
                          <FormLabel>Medical history <span className="optional-label">Optional</span></FormLabel>
                          <Textarea className="field-textarea" placeholder="Existing conditions, previous ENT concerns or surgeries…" {...register("medicalHistory")} />
                        </label>
                        <label className="field">
                          <FormLabel>Known allergies <span className="optional-label">Optional</span></FormLabel>
                          <Textarea className="field-textarea" placeholder="List known allergies or enter “None known”…" {...register("allergies")} />
                        </label>
                        <label className="field">
                          <FormLabel>Current medications <span className="optional-label">Optional</span></FormLabel>
                          <Textarea className="field-textarea" placeholder="Medication name, dose and frequency if known…" {...register("medications")} />
                        </label>
                        <label className="field">
                          <FormLabel>Previous treatment <span className="optional-label">Optional</span></FormLabel>
                          <Textarea className="field-textarea" placeholder="Treatments tried and whether they helped…" {...register("previousTreatment")} />
                        </label>
                      </div>

                      <div className="attachment-section">
                        <div className="attachment-heading">
                          <div>
                            <FormLabel>Images of affected area</FormLabel>
                            <p className="field-hint">Optional clinical images for analysis · not stored with the encrypted intake</p>
                          </div>
                          <span className="optional-pill">OPTIONAL</span>
                        </div>
                        <label className="upload-zone">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            onChange={(event) => {
                              onImageSelect(event.target.files);
                              event.target.value = "";
                            }}
                          />
                          <span className="upload-icon"><FileImage size={20} /></span>
                          <span className="upload-copy"><strong>Choose images</strong> to add them to this session</span>
                          <span className="upload-hint">Only choose images shared with the patient's consent.</span>
                        </label>
                        {imageError && <p className="field-error" role="alert">{imageError}</p>}
                        {images.length > 0 && (
                          <div className="image-preview-list">
                            {images.map(({ file, preview }) => (
                              <div className="image-preview" key={preview}>
                                <img src={preview} alt="" />
                                <span title={file.name}>{file.name}</span>
                                <button type="button" onClick={() => removeImage(preview)} aria-label={`Remove ${file.name}`}><X size={14} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="red-flag-section">
                        <div className="red-flag-heading">
                          <div className="red-flag-icon"><AlertTriangle size={18} /></div>
                          <div>
                            <strong>Immediate attention check</strong>
                            <p>Ask whether any of these symptoms are present. This does not replace clinical assessment.</p>
                          </div>
                        </div>
                        <Controller
                          name="emergencySymptoms"
                          control={control}
                          render={({ field }) => (
                            <div className="red-flag-options">
                              {emergencyOptions.map((item) => (
                                <label key={item} className={cn("red-flag-option", field.value.includes(item) && "flagged")}>
                                  <input
                                    type="checkbox"
                                    checked={field.value.includes(item)}
                                    onChange={() => toggleArrayValue(item, field.value, field.onChange)}
                                  />
                                  <span className="red-flag-check">{field.value.includes(item) && <Check size={12} />}</span>
                                  {item}
                                </label>
                              ))}
                            </div>
                          )}
                        />
                        {emergencySymptoms.length > 0 && (
                          <div className="inline-emergency" role="alert">
                            <AlertTriangle size={16} />
                            <span>Arrange immediate clinical assessment; do not wait for a routine appointment.</span>
                          </div>
                        )}
                      </div>

                      <div className="form-footer last-step-footer">
                        <Button type="button" variant="outline" onClick={() => goToStep(1)}><ArrowLeft size={16} /> Back</Button>
                        <div className="final-actions">
                          <span className="privacy-footnote"><ShieldCheck size={15} /> Review with the patient before submitting.</span>
                          <Button type="submit"><Check size={16} /> Complete intake</Button>
                        </div>
                      </div>
                      {saveError && <p className="form-save-error" role="alert">{saveError}</p>}
                    </Card>
                  )}
                </form>
              )}
            </div>

            <aside className="right-rail">
              <Card className="progress-card">
                <div className="rail-card-heading">
                  <div>
                    <p className="section-kicker">INTAKE PROGRESS</p>
                    <h3>Your checklist</h3>
                  </div>
                  <span className="progress-percent">{submitted ? "100%" : `${Math.round(((activeStep + 1) / steps.length) * 100)}%`}</span>
                </div>
                <div className="rail-progress-track"><span style={{ width: submitted ? "100%" : `${((activeStep + 1) / steps.length) * 100}%` }} /></div>
                <div className="checklist">
                  {steps.map((step, index) => {
                    const complete = submitted || index < activeStep;
                    const current = !submitted && index === activeStep;
                    return (
                      <div className={cn("checklist-row", complete && "complete", current && "current")} key={step.title}>
                        <span className="checklist-icon">{complete ? <Check size={13} /> : <span>{index + 1}</span>}</span>
                        <span>{step.title}</span>
                        {current && <span className="checklist-current">In progress</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="time-estimate"><Clock3 size={15} /> Usually takes 3–5 minutes</div>
              </Card>

              <Card className="guidance-card">
                <div className="guidance-icon"><Stethoscope size={19} /></div>
                <p className="section-kicker">CLINICAL GUIDANCE</p>
                <h3>Listen first. Record clearly.</h3>
                <p>Use the patient's own words where possible. Record what they report without inferring a diagnosis.</p>
                <div className="guidance-rule" />
                <div className="guidance-disclaimer"><ShieldCheck size={15} /><span>Decision support only, not a diagnosis.</span></div>
              </Card>

              <div className="offline-card">
                <div className="offline-icon"><ShieldCheck size={17} /></div>
                <div><strong>Private by design</strong><p>Intake text is encrypted on this device and is not synced.</p></div>
              </div>

              <div className="help-link">
                <span>Need help with this form?</span>
                <a
                  href="/intake-guide.pdf"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open the patient intake guide PDF in a new tab"
                >
                  View intake guide <ChevronRight size={14} />
                </a>
              </div>
            </aside>
          </div>}
          <footer className="page-footer">
            <span>ENT-Care Hospital Workspace</span>
            <span><ShieldCheck size={13} /> Handle all patient information confidentially</span>
            <span>v0.1.0</span>
          </footer>
          {activeModal && (
            <div
              className="modal-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setActiveModal(null);
              }}
            >
              <section
                className="workspace-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="workspace-modal-title"
              >
                <header className="workspace-modal-header">
                  <div>
                    <span className="section-kicker">{activeModal === "profile" ? "ACCOUNT" : "WORKSPACE"}</span>
                    <h2 id="workspace-modal-title">{activeModal === "profile" ? "Profile & session" : "Notifications"}</h2>
                  </div>
                  <button
                    ref={modalCloseRef}
                    type="button"
                    className="workspace-modal-close"
                    aria-label="Close dialog"
                    onClick={() => setActiveModal(null)}
                  >
                    <X size={18} />
                  </button>
                </header>
                {activeModal === "notifications" ? (
                  <div className="workspace-modal-content">
                    <div className={`modal-status-card ${isOffline ? "offline" : "online"}`}>
                      <span className="modal-status-dot" />
                      <div>
                        <strong>{isOffline ? "You are offline" : "You are online"}</strong>
                        <p>{isOffline
                          ? "Saved visits remain available on this device. Diagnosis, report lookup and facility search need an internet connection."
                          : "The service can be reached. Patient intake is saved securely on this device; online requests are sent only when you choose them."}</p>
                      </div>
                    </div>
                    <div className="modal-info-card">
                      <ShieldCheck size={17} />
                      <div>
                        <strong>Patient information is protected</strong>
                        <p>Saved visit details and diagnosis reports are encrypted on this device and are available while your workspace is unlocked.</p>
                      </div>
                    </div>
                    <p className="modal-empty-note">There are no other new workspace notifications.</p>
                  </div>
                ) : (
                  <div className="workspace-modal-content">
                    <div className="profile-modal-identity">
                      <div className="topbar-avatar">{initials}</div>
                      <div><strong>{session.user.name}</strong><span>{session.user.specialization ?? session.user.role}</span></div>
                    </div>
                    <dl className="profile-modal-fields">
                      <div><dt>Email</dt><dd>{session.user.email}</dd></div>
                      <div><dt>Role</dt><dd>{session.user.role}</dd></div>
                      {session.user.specialization && <div><dt>Specialization</dt><dd>{session.user.specialization}</dd></div>}
                      <div><dt>Medical centre</dt><dd>{session.user.facility.name}</dd></div>
                    </dl>
                    <div className="profile-modal-session">
                      <ShieldCheck size={17} />
                      <span>Your secure session stays available for up to 24 hours after sign-in.</span>
                    </div>
                    <div className="workspace-modal-actions">
                      <Button type="button" variant="outline" onClick={() => setActiveModal(null)}>Close</Button>
                      <Button type="button" onClick={() => void onLock().then(() => setActiveModal(null))}>
                        Lock workspace
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function CalendarIcon() {
  return <span className="calendar-nav-icon"><span /><i /></span>;
}

export default App;
