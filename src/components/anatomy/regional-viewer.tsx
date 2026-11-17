"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bounds, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { Eye, EyeOff, RotateCcw, Search } from "lucide-react";
import { ModelErrorBoundary, ModelFallback, supportsWebGL } from "./anatomy-fallback";

export type RegionalModelId = "ear" | "nose" | "pharynx" | "larynx";

const modelUrls: Record<RegionalModelId, string> = {
  ear: "/models/ear-anatomy-model.glb",
  nose: "/models/nose.glb",
  pharynx: "/models/pharynx.glb",
  larynx: "/models/larynx.glb",
};

type Structure = {
  id: string;
  name: string;
};

type PreparedModel = {
  scene: THREE.Group;
  structures: Structure[];
};

function formatStructureName(name: string) {
  return name
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function prepareModel(source: THREE.Group): PreparedModel {
  const scene = source.clone(true);
  const structures: Structure[] = [];

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    structures.push({
      id: object.uuid,
      name: formatStructureName(object.name || "Anatomical structure"),
    });

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    object.material = materials.map((material) => {
      const copy = material.clone();
      if ("emissive" in copy) {
        copy.userData.baseEmissive = copy.emissive.getHex();
      }
      return copy;
    });
  });

  return { scene, structures };
}

function ModelScene({
  modelId,
  selectedId,
  hiddenIds,
  isolateSelected,
  onHover,
  onSelect,
  onPrepared,
}: {
  modelId: RegionalModelId;
  selectedId: string | null;
  hiddenIds: Set<string>;
  isolateSelected: boolean;
  onHover: (name: string | null) => void;
  onSelect: (id: string, name: string) => void;
  onPrepared: (structures: Structure[]) => void;
}) {
  const { scene: source } = useGLTF(modelUrls[modelId]);
  const prepared = useMemo(() => prepareModel(source), [source]);

  useEffect(() => {
    onPrepared(prepared.structures);
  }, [onPrepared, prepared.structures]);

  useEffect(() => {
    prepared.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      object.visible = !hiddenIds.has(object.uuid) &&
        (!isolateSelected || object.uuid === selectedId);

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) {
        if (!("emissive" in material)) continue;
        const baseEmissive = material.userData.baseEmissive;
        if (object.uuid === selectedId) {
          material.emissive.set("#008550");
          material.emissiveIntensity = 0.34;
        } else {
          if (typeof baseEmissive === "number") {
            material.emissive.setHex(baseEmissive);
          }
          material.emissiveIntensity = 0;
        }
      }
    });
  }, [hiddenIds, isolateSelected, prepared.scene, selectedId]);

  const handlePointer = (event: ThreeEvent<MouseEvent | PointerEvent>, select: boolean) => {
    event.stopPropagation();
    const object = event.object;
    if (!(object instanceof THREE.Mesh)) return;
    const name = formatStructureName(object.name || "Anatomical structure");
    if (select) {
      onSelect(object.uuid, name);
    } else {
      onHover(name);
    }
  };

  return (
    <Bounds fit clip margin={1.28}>
      <primitive
        object={prepared.scene}
        onClick={(event: ThreeEvent<MouseEvent>) => handlePointer(event, true)}
        onPointerOver={(event: ThreeEvent<PointerEvent>) => handlePointer(event, false)}
        onPointerOut={() => onHover(null)}
      />
    </Bounds>
  );
}

export function RegionalViewer({
  modelId,
  title,
}: {
  modelId: RegionalModelId;
  title: string;
}) {
  const [structures, setStructures] = useState<Structure[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [isolateSelected, setIsolateSelected] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [cameraVersion, setCameraVersion] = useState(0);

  const updateStructures = useCallback((next: Structure[]) => {
    setStructures(next);
    setModelLoaded(true);
  }, []);
  const visibleStructures = structures.filter((structure) =>
    structure.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const selectStructure = (id: string, name: string) => {
    setSelectedId(id);
    setSelectedName(name);
    setIsolateSelected(false);
  };

  const toggleVisibility = (id: string) => {
    setHiddenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (id === selectedId) {
      setSelectedId(null);
      setSelectedName(null);
      setIsolateSelected(false);
    }
  };

  const resetModel = () => {
    setSelectedId(null);
    setSelectedName(null);
    setHoveredName(null);
    setHiddenIds(new Set());
    setIsolateSelected(false);
    setCameraVersion((version) => version + 1);
  };

  if (!supportsWebGL()) {
    return (
      <ModelFallback
        title={`${title} 3D view is unavailable`}
        message="This device does not support WebGL. Try the interactive anatomy view on a WebGL-enabled device."
      />
    );
  }

  const renderViewer = () => (
    <ModelErrorBoundary
      fallback={
        <ModelFallback
          title={`${title} could not be loaded`}
          message="Check your connection, then reload the page to try again."
        />
      }
    >
      <div className="regional-model-layout">
        <div className="regional-canvas-wrap">
          <div className="regional-canvas">
            <Canvas
              key={`${modelId}-${cameraVersion}`}
              camera={{ position: [0, 0, 4], fov: 40 }}
              dpr={[1, 1.5]}
              frameloop="demand"
              onPointerMissed={() => {
                setSelectedId(null);
                setSelectedName(null);
                setIsolateSelected(false);
              }}
            >
              <color attach="background" args={["#f2f4f3"]} />
              <ambientLight intensity={1.5} />
              <directionalLight position={[4, 6, 5]} intensity={2.2} />
              <directionalLight position={[-4, 1, -3]} intensity={0.75} />
              <ModelScene
                modelId={modelId}
                selectedId={selectedId}
                hiddenIds={hiddenIds}
                isolateSelected={isolateSelected}
                onHover={setHoveredName}
                onSelect={selectStructure}
                onPrepared={updateStructures}
              />
              <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
            </Canvas>
            <div className="regional-canvas-hint">
              {hoveredName
                ? `Select ${hoveredName} to inspect`
                : "Drag to rotate · scroll or pinch to zoom"}
            </div>
            {!modelLoaded && (
              <div className="regional-model-loading" role="status">
                <span className="regional-loading-mark" aria-hidden="true" />
                <span>Loading {title.toLowerCase()} structures…</span>
              </div>
            )}
          </div>
          <div className="regional-viewer-actions">
            <button type="button" onClick={resetModel}>
              <RotateCcw aria-hidden="true" size={15} />
              Reset view
            </button>
            <button
              type="button"
              disabled={!selectedId}
              aria-pressed={isolateSelected}
              onClick={() => setIsolateSelected((value) => !value)}
            >
              {isolateSelected ? "Show all structures" : "Isolate selection"}
            </button>
            <button
              type="button"
              disabled={hiddenIds.size === 0 && !isolateSelected}
              onClick={() => {
                setHiddenIds(new Set());
                setIsolateSelected(false);
              }}
            >
              Restore model
            </button>
          </div>
        </div>

        <aside className="structure-inspector" aria-label={`${title} structures`}>
          <div className="structure-inspector-heading">
            <div>
              <p className="inspector-label">MODEL STRUCTURES</p>
              <h3>{selectedName ?? "Explore this model"}</h3>
            </div>
            <span>{structures.length}</span>
          </div>
          <p className="inspector-description">
            {selectedName
              ? "Selected structure. Choose another structure to inspect it, or isolate it in the model."
              : "Select a structure in the model or use this list to inspect it."}
          </p>
          <label className="structure-search">
            <Search aria-hidden="true" size={15} />
            <span className="sr-only">Search structures</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a structure"
            />
          </label>
          <ul className="structure-list">
            {visibleStructures.map((structure) => {
              const isHidden = hiddenIds.has(structure.id);
              return (
                <li key={structure.id} className={isHidden ? "is-hidden" : ""}>
                  <button
                    type="button"
                    className={selectedId === structure.id ? "is-selected" : ""}
                    aria-pressed={selectedId === structure.id}
                    onClick={() => selectStructure(structure.id, structure.name)}
                  >
                    {structure.name}
                  </button>
                  <button
                    type="button"
                    className="structure-visibility"
                    aria-label={`${isHidden ? "Show" : "Hide"} ${structure.name}`}
                    title={`${isHidden ? "Show" : "Hide"} ${structure.name}`}
                    onClick={() => toggleVisibility(structure.id)}
                  >
                    {isHidden ? (
                      <EyeOff aria-hidden="true" size={15} />
                    ) : (
                      <Eye aria-hidden="true" size={15} />
                    )}
                  </button>
                </li>
              );
            })}
            {visibleStructures.length === 0 && (
              <li className="structure-empty">No structures match “{query}”.</li>
            )}
          </ul>
        </aside>
      </div>
    </ModelErrorBoundary>
  );

  return renderViewer();
}
