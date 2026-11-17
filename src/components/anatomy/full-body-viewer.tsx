"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bvh, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import {
  AnatomyModel,
  AnatomyViewer,
  DEFAULT_LAYERS,
  type LayerVisibility,
} from "open-anatomy-3d-react";
import {
  type AnatomySex,
  type AnatomyStructure,
  type AnatomySystem,
  SYSTEMS,
  SYSTEM_LABELS,
  ATTRIBUTION,
  getStructure,
} from "open-anatomy-3d";
import { RotateCcw } from "lucide-react";
import { ModelErrorBoundary, ModelFallback, supportsWebGL } from "./anatomy-fallback";

const modelUrls = {
  male: "/models/anatomy-male.glb",
  female: "/models/anatomy-female.glb",
};

const initialLayers = {
  skin: true,
  skeleton: true,
  joints: true,
  muscles: false,
  organs: true,
  vessels: false,
  nerves: false,
};

const unsupportedFallback = (
  <ModelFallback
    title="3D viewing is unavailable"
    message="Your browser or device does not support WebGL. You can still start an assessment or choose a symptom area."
  />
);

export function FullBodyViewer({
  highlightedKeys,
  onStructureClick,
  onSexChange,
}: {
  highlightedKeys: string[];
  onStructureClick: (key: string, structure: AnatomyStructure) => void;
  onSexChange: () => void;
}) {
  if (!supportsWebGL()) return unsupportedFallback;

  return (
    <ModelErrorBoundary
      fallback={
        <ModelFallback
          title="The 3D model could not be loaded"
          message="Check your connection, then reload the page to try again."
        />
      }
    >
      <div className="full-body-viewer">
        <AnatomyViewer
          className="ent-anatomy-viewer"
          defaultSex="female"
          defaultLayers={initialLayers}
          highlightedKeys={highlightedKeys}
          hoverHint="Select to inspect"
          modelUrls={modelUrls}
          onSexChange={onSexChange}
          onStructureClick={onStructureClick}
          showLayerToggles
          showRotateControl
          showSexToggle
          showZoomControls
          hoverColor="#008550"
          highlightColor="#006c45"
        />
        <p className="viewer-attribution">{ATTRIBUTION}</p>
      </div>
    </ModelErrorBoundary>
  );
}

const headNeckKeys = [
  "skull",
  "spine_cervical",
  "arteries_head",
  "larynx",
  "pharynx",
  "neck_muscles_l",
  "neck_muscles_r",
];

const headNeckLayers: LayerVisibility = {
  ...DEFAULT_LAYERS,
  muscles: false,
  vessels: false,
  nerves: false,
};

function HeadNeckScene({
  sex,
  layers,
  selectedKey,
  hoveredKey,
  onSelect,
  onHover,
}: {
  sex: AnatomySex;
  layers: LayerVisibility;
  selectedKey: string | null;
  hoveredKey: string | null;
  onSelect: (key: string) => void;
  onHover: (key: string | null) => void;
}) {
  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[0, 1.52, 1.35]}
        fov={34}
      />
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 6, 5]} intensity={1.3} />
      <directionalLight position={[-3, 2, -4]} intensity={0.6} />
      <Bvh firstHitOnly>
        <AnatomyModel
          sex={sex}
          layers={layers}
          highlightedKeys={
            selectedKey
              ? new Set([...headNeckKeys, selectedKey])
              : new Set(headNeckKeys)
          }
          hoveredKey={hoveredKey}
          onHover={onHover}
          onSelect={onSelect}
          highlightColor="#008550"
          hoverColor="#008550"
        />
      </Bvh>
      <OrbitControls
        makeDefault
        target={[0, 1.52, 0]}
        minDistance={0.45}
        maxDistance={2.8}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}

export function HeadNeckViewer({
  onStructureClick,
}: {
  onStructureClick: (key: string, structure: AnatomyStructure) => void;
}) {
  const [sex, setSex] = useState<AnatomySex>("female");
  const [layers, setLayers] = useState<LayerVisibility>(headNeckLayers);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [cameraVersion, setCameraVersion] = useState(0);
  const selectedStructure = selectedKey ? getStructure(selectedKey) : undefined;

  if (!supportsWebGL()) {
    return (
      <ModelFallback
        title="3D viewing is unavailable"
        message="Your browser or device does not support WebGL. You can still start an assessment or choose a symptom area."
      />
    );
  }

  return (
    <ModelErrorBoundary
      fallback={
        <ModelFallback
          title="The head-and-neck model could not be loaded"
          message="Check your connection, then reload the page to try again."
        />
      }
    >
      <div className="full-body-viewer head-neck-viewer">
        <div className="head-neck-controls">
          <div className="head-neck-sex" role="group" aria-label="Body model">
            {(["female", "male"] as const).map((bodySex) => (
              <button
                type="button"
                key={bodySex}
                aria-pressed={sex === bodySex}
                className={sex === bodySex ? "is-active" : ""}
                onClick={() => {
                  setSex(bodySex);
                  setSelectedKey(null);
                }}
              >
                {bodySex === "female" ? "Female" : "Male"}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="head-neck-reset"
            onClick={() => {
              setSelectedKey(null);
              setHoveredKey(null);
              setCameraVersion((version) => version + 1);
            }}
          >
            <RotateCcw aria-hidden="true" size={14} />
            Reset view
          </button>
        </div>
        <div className="head-neck-canvas">
          <Canvas
            key={`${sex}-${cameraVersion}`}
            dpr={[1, 1.5]}
            frameloop="demand"
            gl={{ antialias: false, powerPreference: "low-power" }}
          >
            <color attach="background" args={["#f2f4f3"]} />
            <HeadNeckScene
              sex={sex}
              layers={layers}
              selectedKey={selectedKey}
              hoveredKey={hoveredKey}
              onSelect={(key) => {
                setSelectedKey(key);
                const structure = getStructure(key);
                if (structure) onStructureClick(key, structure);
              }}
              onHover={setHoveredKey}
            />
          </Canvas>
          <div className="regional-canvas-hint">
            {selectedStructure?.label ??
              (hoveredKey ? getStructure(hoveredKey)?.label : null) ??
              "Head & neck · drag to rotate, scroll or pinch to zoom"}
          </div>
        </div>
        <div className="head-neck-layer-controls" role="group" aria-label="Head and neck body systems">
          {SYSTEMS.map((system: AnatomySystem) => (
            <button
              key={system}
              type="button"
              aria-pressed={layers[system]}
              className={layers[system] ? "is-active" : ""}
              onClick={() =>
                setLayers((current) => ({ ...current, [system]: !current[system] }))
              }
            >
              {SYSTEM_LABELS[system]}
            </button>
          ))}
        </div>
        <div className="head-neck-selected" aria-live="polite">
          <span className="hero-detail-marker" />
          <span>
            {selectedStructure
              ? `${selectedStructure.label} · ${selectedStructure.category}`
              : "Select a structure in the model to inspect it."}
          </span>
        </div>
        <p className="viewer-attribution">{ATTRIBUTION}</p>
      </div>
    </ModelErrorBoundary>
  );
}
