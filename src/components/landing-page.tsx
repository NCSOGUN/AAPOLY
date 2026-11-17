"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AnatomyStructure } from "open-anatomy-3d";
import {
  ArrowRight,
  Ear,
  Headphones,
  Move3d,
  ScanFace,
  Stethoscope,
  Wind,
} from "lucide-react";
import type { RegionalModelId } from "@/components/anatomy/regional-viewer";

type AnatomyMode = "body" | "head-neck" | "ear" | "nose" | "throat";

const FullBodyViewer = dynamic(
  () =>
    import("@/components/anatomy/full-body-viewer").then(
      (module) => module.FullBodyViewer,
    ),
  {
    ssr: false,
    loading: () => <ViewerLoading label="Preparing the full-body model" />,
  },
);

const RegionalViewer = dynamic(
  () =>
    import("@/components/anatomy/regional-viewer").then(
      (module) => module.RegionalViewer,
    ),
  {
    ssr: false,
    loading: () => <ViewerLoading label="Preparing this anatomy model" />,
  },
);

const HeadNeckViewer = dynamic(
  () =>
    import("@/components/anatomy/full-body-viewer").then(
      (module) => module.HeadNeckViewer,
    ),
  {
    ssr: false,
    loading: () => <ViewerLoading label="Preparing the head-and-neck view" />,
  },
);

function ViewerLoading({ label }: { label: string }) {
  return (
    <div className="viewer-loading" role="status">
      <div className="viewer-loading-figure" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <p>{label}</p>
    </div>
  );
}

const areaOptions: {
  id: AnatomyMode;
  title: string;
  subtitle: string;
  icon: typeof Ear;
}[] = [
  {
    id: "body",
    title: "Whole body",
    subtitle: "Explore major structures",
    icon: Move3d,
  },
  {
    id: "head-neck",
    title: "Head & neck",
    subtitle: "Focus the full-body model",
    icon: ScanFace,
  },
  {
    id: "ear",
    title: "Ear",
    subtitle: "Inner and outer ear",
    icon: Ear,
  },
  {
    id: "nose",
    title: "Nose & sinuses",
    subtitle: "Nasal cavity and sinuses",
    icon: Wind,
  },
  {
    id: "throat",
    title: "Throat",
    subtitle: "Pharynx and larynx",
    icon: Headphones,
  },
];

const regionModel: Record<Exclude<AnatomyMode, "body" | "head-neck">, RegionalModelId> = {
  ear: "ear",
  nose: "nose",
  throat: "pharynx",
};

const regionCopy: Record<AnatomyMode, { title: string; description: string }> = {
  body: {
    title: "Full-body anatomy",
    description:
      "Select a structure in the model to see its name and anatomical system.",
  },
  "head-neck": {
    title: "Head & neck",
    description:
      "Zoom in on the skull, cervical spine, throat and available head-and-neck structures.",
  },
  ear: {
    title: "Ear anatomy",
    description:
      "Explore the ear model by rotating it, selecting a structure, or isolating it from the surrounding anatomy.",
  },
  nose: {
    title: "Nose & sinus anatomy",
    description:
      "Explore the nasal cavity and sinus structures in a separate, focused 3D view.",
  },
  throat: {
    title: "Throat anatomy",
    description:
      "Switch between the pharynx and larynx models to explore the structures in each view.",
  },
};

export default function LandingPage() {
  const [mode, setMode] = useState<AnatomyMode>("body");
  const [throatModel, setThroatModel] = useState<"pharynx" | "larynx">("pharynx");
  const [selectedStructure, setSelectedStructure] =
    useState<AnatomyStructure | null>(null);
  const [viewerRequested, setViewerRequested] = useState(false);
  const anatomyPanelRef = useRef<HTMLElement>(null);

  const isFullBody = mode === "body" || mode === "head-neck";
  const modelId =
    mode === "throat"
      ? throatModel
      : mode === "ear" || mode === "nose"
        ? regionModel[mode]
        : null;
  const description =
    isFullBody && selectedStructure
      ? `${selectedStructure.category} · ${selectedStructure.system}`
      : regionCopy[mode].description;
  const selectedModeIndex = areaOptions.findIndex((option) => option.id === mode) + 1;

  useEffect(() => {
    const panel = anatomyPanelRef.current;
    if (!panel || viewerRequested) return;

    if (!("IntersectionObserver" in window)) {
      setViewerRequested(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setViewerRequested(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(panel);

    return () => observer.disconnect();
  }, [viewerRequested]);

  const selectMode = (nextMode: AnatomyMode) => {
    setMode(nextMode);
    setSelectedStructure(null);
  };

  const handleStructureClick = (
    _key: string,
    structure: AnatomyStructure,
  ) => {
    setSelectedStructure(structure);
  };

  return (
    <main className="landing-page">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand-lockup" href="/" aria-label="ENT-Care home">
            <Image
              src="/aap-logo-img.png"
              alt="Abraham Adesanya Polytechnic"
              width={108}
              height={46}
              style={{ height: "auto" }}
            />
            <span className="brand-divider" aria-hidden="true" />
            <span className="brand-name">ENT-Care</span>
          </Link>
          <nav className="site-nav" aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#model-credits">Model credits</a>
            <Link className="header-action" href="/assessment">
              Start an assessment <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </nav>
        </div>
      </header>

      <section className="landing-hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-rule" />
            PATIENT CARE · NIGERIA
          </p>
          <h1>Begin with the part that’s bothering you.</h1>
          <p className="hero-description">
            Explore the body, focus on an ear, nose or throat region, then tell
            us what you’re experiencing.
          </p>
          <div className="hero-actions">
            <Link className="primary-action" href="/assessment">
              Start symptom check <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <a className="text-action" href="#how-it-works">
              See how it works
            </a>
          </div>

          <div className="region-picker">
            <div className="section-label-row">
              <p className="section-label">CHOOSE AN ANATOMY VIEW</p>
              <span className="section-label-index">
                {String(selectedModeIndex).padStart(2, "0")} / 05
              </span>
            </div>
            <div className="region-options" role="group" aria-label="Anatomy view">
              {areaOptions.map(({ id, title, subtitle, icon: Icon }, index) => (
                <button
                  type="button"
                  key={id}
                  className={`region-option ${mode === id ? "is-active" : ""}`}
                  aria-pressed={mode === id}
                  onClick={() => selectMode(id)}
                >
                  <span className="region-option-icon">
                    <Icon aria-hidden="true" size={18} strokeWidth={1.7} />
                  </span>
                  <span className="region-option-copy">
                    <span className="region-option-title">{title}</span>
                    <span className="region-option-subtitle">{subtitle}</span>
                  </span>
                  <span className="region-option-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </button>
              ))}
            </div>

            {mode === "throat" && (
              <div className="submodel-picker" role="group" aria-label="Throat model">
                <span>View:</span>
                {(["pharynx", "larynx"] as const).map((region) => (
                  <button
                    type="button"
                    key={region}
                    className={throatModel === region ? "is-active" : ""}
                    aria-pressed={throatModel === region}
                    onClick={() => {
                      setThroatModel(region);
                      setSelectedStructure(null);
                    }}
                  >
                    {region === "pharynx" ? "Pharynx" : "Larynx"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="hero-detail" aria-live="polite">
            <span className="hero-detail-marker" />
            <div>
              <p className="hero-detail-title">
                {selectedStructure?.label ?? regionCopy[mode].title}
              </p>
              <p className="hero-detail-description">{description}</p>
            </div>
          </div>
          <p className="hero-disclaimer">
            Anatomy is for education and exploration, not diagnosis.
          </p>
        </div>

        <section
          ref={anatomyPanelRef}
          className="anatomy-panel"
          aria-label="Interactive anatomy viewer"
        >
          <div className="anatomy-panel-header">
            <div>
              <p className="panel-kicker">
                <span className="live-dot" />
                INTERACTIVE 3D
              </p>
              <h2>{regionCopy[mode].title}</h2>
            </div>
            <span className="anatomy-panel-count">
              {isFullBody ? "01" : mode === "throat" ? (throatModel === "pharynx" ? "04" : "05") : mode === "ear" ? "02" : "03"}
            </span>
          </div>

          <div className="anatomy-model-slot">
            {!viewerRequested ? (
              <ViewerLoading label="An interactive anatomy explorer" />
            ) : mode === "body" ? (
              <FullBodyViewer
                highlightedKeys={[]}
                onStructureClick={handleStructureClick}
                onSexChange={() => setSelectedStructure(null)}
              />
            ) : mode === "head-neck" ? (
              <HeadNeckViewer onStructureClick={handleStructureClick} />
            ) : modelId ? (
              <RegionalViewer
                key={`${mode}-${modelId}`}
                modelId={modelId}
                title={
                  mode === "throat"
                    ? throatModel === "pharynx"
                      ? "Pharynx"
                      : "Larynx"
                    : regionCopy[mode].title
                }
              />
            ) : null}
          </div>

          <div className="anatomy-panel-footer">
            <span>
              <Move3d aria-hidden="true" size={15} />
              Drag to rotate
            </span>
            <span className="footer-separator" />
            <span>Select structures to inspect</span>
            <a href="#model-credits">Model details</a>
          </div>
        </section>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="how-heading">
          <p className="eyebrow">
            <span className="eyebrow-rule" />
            A CLEAR NEXT STEP
          </p>
          <h2>From what you feel to what to do next.</h2>
        </div>
        <div className="how-steps">
          <article className="how-step">
            <span className="how-step-number">01</span>
            <div>
              <h3>Choose a region</h3>
              <p>Start with the area that best matches your symptoms.</p>
            </div>
            <ScanFace aria-hidden="true" size={21} />
          </article>
          <article className="how-step">
            <span className="how-step-number">02</span>
            <div>
              <h3>Describe what’s happening</h3>
              <p>Share your symptoms and how long you’ve had them.</p>
            </div>
            <Stethoscope aria-hidden="true" size={21} />
          </article>
          <article className="how-step">
            <span className="how-step-number">03</span>
            <div>
              <h3>Review your next steps</h3>
              <p>See guidance and care options based on your assessment.</p>
            </div>
            <ArrowRight aria-hidden="true" size={21} />
          </article>
        </div>
        <Link className="how-action" href="/assessment">
          Start your symptom check <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </section>

      <footer className="site-footer" id="model-credits">
        <div className="footer-brand">
          <span className="brand-name">ENT-Care</span>
          <span>Patient guidance and anatomy exploration</span>
        </div>
        <div className="model-credits">
          <p className="section-label">3D MODEL CREDITS</p>
          <p>
            Full-body models: BodyParts3D © DBCLS; female organs: HuBMAP; female
            body: MakeHuman. Modified by Open Anatomy 3D, CC BY 4.0. Ear anatomy:
            Innerscene Corp (CC0 1.0). Nose: Z-Anatomy, based in part on
            BodyParts3D © DBCLS, adapted by OrganUI (CC BY-SA 4.0 and CC BY-SA
            2.1 Japan). Pharynx and larynx: BodyParts3D / Anatomography © DBCLS,
            adapted by OrganUI (CC BY-SA 2.1 Japan).
          </p>
          <a
            href="https://github.com/MervinR07/open-anatomy-3d"
            target="_blank"
            rel="noreferrer"
          >
            Open Anatomy 3D project <ArrowRight aria-hidden="true" size={14} />
          </a>
        </div>
      </footer>
    </main>
  );
}
