import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  ClipboardCheck,
  Database,
  Download,
  LockKeyhole,
  ShieldCheck,
  Stethoscope,
  Wifi,
} from "lucide-react";
import logo from "../../../assets/aap-logo-img.png";
import hero from "../../../ent-resources/home-visual.webp";
import { Button } from "@/components/ui/button";

const reviewTerms = [
  {
    title: "Authorised access",
    detail:
      "Use ENT-Care only with an account issued to you by your hospital or care organisation. Keep your password private and lock the workspace when you step away.",
    icon: LockKeyhole,
  },
  {
    title: "Patient confidentiality",
    detail:
      "Access patient information only when needed for your duties. Protect this device from unauthorised access and follow your organisation's privacy, retention and incident-reporting policies.",
    icon: ShieldCheck,
  },
  {
    title: "Local records and connectivity",
    detail:
      "Intake details and saved reports may be stored in encrypted form on this device. Some features require an internet connection and send the relevant information to the configured ENT-Care service.",
    icon: Database,
  },
  {
    title: "Clinical responsibility and consent",
    detail:
      "Automated findings are decision support only, not a confirmed diagnosis. A qualified clinician remains responsible for care decisions. Obtain required patient consent before submitting images for analysis.",
    icon: Stethoscope,
  },
  {
    title: "Service and support",
    detail:
      "The service may be unavailable or change. Save and review important records using approved clinical procedures, and contact your organisation's ENT-Care administrator for account or device support.",
    icon: CircleHelp,
  },
];

export function StartupSplash() {
  return (
    <main className="startup-splash" aria-live="polite">
      <img src={logo} alt="Abraham Adesanya Polytechnic" />
      <span className="startup-splash-rule" />
      <div className="startup-splash-copy">
        <strong>ENT-Care</strong>
        <span>Preparing your secure workspace</span>
      </div>
      <span className="startup-splash-loader" aria-hidden="true" />
    </main>
  );
}

export function OnboardingScreen({
  onComplete,
  storageError,
}: {
  onComplete: () => void;
  storageError?: string;
}) {
  const [step, setStep] = useState<"welcome" | "terms">("welcome");
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <img src={logo} alt="Abraham Adesanya Polytechnic" />
        <span className="onboarding-header-divider" />
        <span>ENT-Care <small>HOSPITAL WORKSPACE</small></span>
        <span className="onboarding-version">FIRST-TIME SETUP</span>
      </header>

      <section className="onboarding-panel" aria-live="polite">
        <div className="onboarding-hero">
          <div className="onboarding-hero-image">
            <img src={hero} alt="Medical illustration of the head and ENT anatomy" />
            <span className="onboarding-image-caption">EAR · NOSE · THROAT CARE</span>
          </div>
          <div className="onboarding-hero-content">
            <div className="onboarding-step-count">{step === "welcome" ? "01 / 02" : "02 / 02"}</div>
            {step === "welcome" ? (
              <>
                <p className="onboarding-kicker">WELCOME TO YOUR CLINICAL WORKSPACE</p>
                <h1>Care starts with a clearer picture.</h1>
                <p className="onboarding-intro">
                  ENT-Care helps authorised hospital teams capture patient intake, review
                  decision-support findings and coordinate specialist referrals.
                </p>
                <div className="onboarding-guide">
                  <h2>Getting started</h2>
                  <div className="onboarding-guide-item">
                    <span><Download size={17} /></span>
                    <div><strong>Install the approved app</strong><p>Use the installer provided by your hospital administrator. Do not install packages from untrusted sources.</p></div>
                  </div>
                  <div className="onboarding-guide-item">
                    <span><LockKeyhole size={17} /></span>
                    <div><strong>Sign in with your hospital account</strong><p>Your account provides access to the facility workspace and its authorised tools.</p></div>
                  </div>
                  <div className="onboarding-guide-item">
                    <span><Wifi size={17} /></span>
                    <div><strong>Connect for online services</strong><p>Intake and saved visits are available on this device; report search, analysis and facility lookup need connectivity.</p></div>
                  </div>
                  <div className="onboarding-guide-item">
                    <span><ClipboardCheck size={17} /></span>
                    <div><strong>Check your facility before use</strong><p>Confirm the signed-in facility is correct and follow your organisation's patient privacy procedures.</p></div>
                  </div>
                </div>
                <div className="onboarding-security-note">
                  <ShieldCheck size={16} />
                  <span>Patient records are stored locally in encrypted form. Keep this device and your account secure.</span>
                </div>
                <div className="onboarding-actions onboarding-actions-end">
                  <Button type="button" onClick={() => setStep("terms")}>
                    Review terms <ArrowRight size={16} />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="onboarding-kicker">PLEASE REVIEW BEFORE CONTINUING</p>
                <h1>Terms of use</h1>
                <div className="onboarding-draft-warning" role="note">
                  <strong>Review draft — not approved for production use</strong>
                  <span>This operational draft needs review and approval by AAPOLY and the responsible privacy, clinical and legal teams before client distribution.</span>
                </div>
                <div className="onboarding-terms-list">
                  {reviewTerms.map(({ title, detail, icon: Icon }, index) => (
                    <article className="onboarding-term" key={title}>
                      <span className="onboarding-term-number">{String(index + 1).padStart(2, "0")}</span>
                      <span className="onboarding-term-icon"><Icon size={16} /></span>
                      <div><h2>{title}</h2><p>{detail}</p></div>
                    </article>
                  ))}
                </div>
                <label className="onboarding-acknowledge">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                  />
                  <span>I have reviewed this draft and understand that it is not approved final terms. I am proceeding for evaluation only.</span>
                </label>
                {storageError && <p className="onboarding-storage-error" role="alert">{storageError}</p>}
                <div className="onboarding-actions onboarding-actions-between">
                  <Button
                    type="button"
                    variant="outline"
                    className="onboarding-back-button"
                    onClick={() => setStep("welcome")}
                  >
                    <ArrowLeft size={16} /> Back
                  </Button>
                  <Button type="button" disabled={!acknowledged} onClick={onComplete}>
                    Acknowledge and continue <Check size={16} />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
        <footer className="onboarding-footer">
          <span>ABRAHAM ADESANYA POLYTECHNIC</span>
          <span>For authorised hospital and specialist staff only</span>
        </footer>
      </section>
    </main>
  );
}
