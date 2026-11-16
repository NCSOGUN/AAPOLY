import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck,
  Download,
  LockKeyhole,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import logo from "../../../assets/aap-logo-img.png";
import hero from "../../../ent-resources/home-visual.webp";
import termsText from "../../../DESKTOP_APP_TERMS_OF_USE.txt?raw";
import { Button } from "@/components/ui/button";

type TermsBlock =
  | { type: "metadata"; items: { label: string; value: string }[] }
  | { type: "heading"; title: string; number?: string }
  | { type: "paragraph"; text: string }
  | { type: "clause"; number: string; text: string }
  | { type: "definition"; term: string; text: string }
  | { type: "list"; markerType: "alpha" | "decimal"; items: { text: string }[] }
  | { type: "footer"; text: string };

function titleCaseHeading(value: string) {
  const minorWords = new Set(["and", "or", "of", "to", "in", "for"]);
  return value
    .toLowerCase()
    .split(" ")
    .map((word, index) =>
      index > 0 && minorWords.has(word) ? word : word[0]?.toUpperCase() + word.slice(1),
    )
    .join(" ");
}

function parseTerms(source: string): TermsBlock[] {
  const lines = source
    .split(/\r?\n/)
    .filter((line) => !/^\s*[=_-]{5,}\s*$/.test(line));
  let titleLinesToSkip = 2;
  const contentLines = lines.filter((line) => {
    if (line.trim() && titleLinesToSkip > 0) {
      titleLinesToSkip -= 1;
      return false;
    }
    return true;
  });
  const blocks: TermsBlock[] = [];
  const metadataLines: string[] = [];
  while (contentLines.length && !contentLines[0].trim()) contentLines.shift();
  while (contentLines.length && contentLines[0].trim()) {
    metadataLines.push(contentLines.shift() ?? "");
  }
  while (contentLines.length && !contentLines[0].trim()) contentLines.shift();

  const metadata: { label: string; value: string }[] = [];
  for (const line of metadataLines) {
    const item = line.match(/^\s*([^:]+):\s*(.*?)\s*$/);
    if (item) {
      metadata.push({ label: item[1].trim(), value: item[2].trim() });
    } else if (metadata.length) {
      metadata[metadata.length - 1].value += ` ${line.trim()}`;
    }
  }
  if (metadata.length) blocks.push({ type: "metadata", items: metadata });

  type CurrentBlock =
    | { type: "paragraph" | "clause" | "definition"; lines: string[]; number?: string; term?: string }
    | { type: "list"; markerType: "alpha" | "decimal"; items: { text: string }[] };
  let current: CurrentBlock | undefined;

  function flush() {
    if (!current) return;
    if (current.type === "list") {
      blocks.push({
        type: "list",
        markerType: current.markerType,
        items: current.items,
      });
    } else {
      const text = current.lines.join(" ").trim();
      if (current.type === "clause" && current.number) {
        blocks.push({ type: "clause", number: current.number, text });
      } else if (current.type === "definition" && current.term) {
        blocks.push({ type: "definition", term: current.term, text });
      } else if (text) {
        blocks.push({ type: "paragraph", text });
      }
    }
    current = undefined;
  }

  for (const line of contentLines) {
    const value = line.trim();
    if (!value) {
      flush();
      continue;
    }
    if (value === "IMPORTANT NOTICE" || value === "AGREEMENT") {
      flush();
      blocks.push({ type: "heading", title: titleCaseHeading(value) });
      continue;
    }
    const section = value.match(/^(\d+)\.\s+([A-Z][A-Z0-9\s&-]+)$/);
    if (section) {
      flush();
      blocks.push({
        type: "heading",
        number: section[1],
        title: titleCaseHeading(section[2]),
      });
      continue;
    }
    const clause = value.match(/^(\d+\.\d+)\s+(.*)$/);
    if (clause) {
      flush();
      current = { type: "clause", number: clause[1], lines: [clause[2]] };
      continue;
    }
    const definition = value.match(/^"([^"]+)"\s+—\s*(.*)$/);
    if (definition) {
      flush();
      current = { type: "definition", term: definition[1], lines: [definition[2]] };
      continue;
    }
    const listItem = value.match(/^(?:\(([a-h])\)|(\d+)\.)\s+(.*)$/);
    if (listItem) {
      if (current?.type !== "list") {
        flush();
        current = {
          type: "list",
          markerType: listItem[1] ? "alpha" : "decimal",
          items: [],
        };
      }
      current.items.push({
        text: listItem[3],
      });
      continue;
    }
    if (/^(Document version|Review due|Maintained by):/.test(value)) {
      flush();
      blocks.push({ type: "footer", text: value });
      continue;
    }
    if (!current) current = { type: "paragraph", lines: [] };
    if (current.type === "list") {
      const lastItem = current.items.length - 1;
      if (lastItem >= 0) current.items[lastItem].text += ` ${value}`;
    } else {
      current.lines.push(value);
    }
  }
  flush();
  return blocks;
}

const termsBlocks = parseTerms(termsText);

export function StartupSplash() {
  return (
    <main className="startup-splash" aria-live="polite">
      <img src={logo} alt="Abraham Adesanya Polytechnic" />
      <div className="startup-splash-copy">
        <strong>ENT-Care</strong>
        <span>Starting your workspace</span>
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
        <span className="onboarding-version">First-time setup</span>
      </header>

      <section className="onboarding-panel" aria-live="polite">
        <div className="onboarding-layout">
          <aside className="onboarding-visual" aria-label="ENT-Care clinical workspace">
            <img src={hero} alt="Medical illustration of the head and ENT anatomy" />
            <span>Ear, nose and throat care</span>
          </aside>
          <div className="onboarding-content">
            <nav className="onboarding-progress" aria-label="Setup progress">
              <span className={step === "welcome" ? "active" : ""}>Welcome</span>
              <span className={step === "terms" ? "active" : ""}>Terms of use</span>
            </nav>
            {step === "welcome" ? (
              <>
                <h1>Welcome to ENT-Care</h1>
                <p className="onboarding-intro">
                  A secure workspace for hospital teams to manage patient intake,
                  review clinical decision support and coordinate referrals.
                </p>
                <div className="onboarding-guide">
                  <h2>Before you begin</h2>
                  <div className="onboarding-guide-item">
                    <span><Download size={17} /></span>
                    <div>
                      <strong>Use an approved installation</strong>
                      <p>Install the app provided by your hospital administrator.</p>
                    </div>
                  </div>
                  <div className="onboarding-guide-item">
                    <span><LockKeyhole size={17} /></span>
                    <div>
                      <strong>Sign in with your hospital account</strong>
                      <p>Your account gives you access to your facility's authorised tools.</p>
                    </div>
                  </div>
                  <div className="onboarding-guide-item">
                    <span><Wifi size={17} /></span>
                    <div>
                      <strong>Connect to use online services</strong>
                      <p>Analysis, report search and facility lookup require an internet connection.</p>
                    </div>
                  </div>
                  <div className="onboarding-guide-item">
                    <span><ClipboardCheck size={17} /></span>
                    <div>
                      <strong>Check your facility</strong>
                      <p>Confirm your account is linked to the correct facility and follow its privacy procedures.</p>
                    </div>
                  </div>
                </div>
                <div className="onboarding-security-note">
                  <ShieldCheck size={16} />
                  <span>Patient records are encrypted on this device. Keep your account and device secure.</span>
                </div>
                <div className="onboarding-actions onboarding-actions-end">
                  <Button type="button" onClick={() => setStep("terms")}>
                    Continue <ArrowRight size={16} />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h1>Terms of use</h1>
                <p className="onboarding-intro">
                  Please read these terms carefully. By selecting “Agree and continue,”
                  you confirm that you have read and agree to them.
                </p>
                <div className="onboarding-terms-document" role="region" aria-label="Terms of use" tabIndex={0}>
                  <header className="terms-document-title">
                    <p>ENT-CARE DESKTOP APPLICATION</p>
                    <h2>Terms of Use</h2>
                    <span>Authorised Hospital and Specialist Staff</span>
                  </header>
                  {termsBlocks.map((block, index) => {
                    if (block.type === "metadata") {
                      return (
                        <dl className="terms-metadata" key={`metadata-${index}`}>
                          {block.items.map(({ label, value }) => (
                            <div key={label}>
                              <dt>{label}</dt>
                              <dd>{value}</dd>
                            </div>
                          ))}
                        </dl>
                      );
                    }
                    if (block.type === "heading") {
                      return (
                        <h3 className={`terms-section-heading${block.number ? "" : " terms-special-heading"}`} key={`heading-${index}`}>
                          {block.number && <span>{block.number}</span>}
                          {block.title}
                        </h3>
                      );
                    }
                    if (block.type === "clause") {
                      return (
                        <div className="terms-clause" key={`clause-${index}`}>
                          <strong>{block.number}</strong>
                          <p>{block.text}</p>
                        </div>
                      );
                    }
                    if (block.type === "definition") {
                      return (
                        <div className="terms-definition" key={`definition-${index}`}>
                          <strong>{block.term}</strong>
                          <p>{block.text}</p>
                        </div>
                      );
                    }
                    if (block.type === "list") {
                      return (
                        <ol
                          className="terms-list"
                          style={{ listStyleType: block.markerType === "alpha" ? "lower-alpha" : "decimal" }}
                          key={`list-${index}`}
                        >
                          {block.items.map((item, itemIndex) => (
                            <li key={`${index}-${itemIndex}`}>{item.text}</li>
                          ))}
                        </ol>
                      );
                    }
                    if (block.type === "footer") {
                      return <p className="terms-document-footer" key={`footer-${index}`}>{block.text}</p>;
                    }
                    return <p className="terms-paragraph" key={`paragraph-${index}`}>{block.text}</p>;
                  })}
                </div>
                <label className="onboarding-acknowledge">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                  />
                  <span>
                    I have read and agree to the ENT-Care Terms of Use.
                  </span>
                </label>
                {storageError && (
                  <p className="onboarding-storage-error" role="alert">{storageError}</p>
                )}
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
                    Agree and continue <Check size={16} />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
        <footer className="onboarding-footer">
          <span>Abraham Adesanya Polytechnic</span>
          <span>For authorised hospital and specialist staff only</span>
        </footer>
      </section>
    </main>
  );
}
