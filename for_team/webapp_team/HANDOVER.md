# ENT-Care Patient Web App — Full Handover
**Team:** Patient Web App (PWA / Mobile-First)
**Service:** ENT-Care Location Intelligence Service
**Date:** November 2026

---

## 1. What You Are Building

The ENT-Care Patient Web App gives any person in Nigeria immediate intelligent guidance about an ear, nose, or throat complaint — without needing to see a doctor first.

A patient opens the app, describes what they feel in plain language, and within seconds receives:
- A likely condition in plain language (not medical jargon)
- How urgent the situation is
- What to do right now
- Which nearby hospital or specialist can help
- A permanent report they can share with any doctor

**No login. No account. No friction.**

---

## 2. Recommended Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | Same as backend, Vercel-ready |
| Language | TypeScript | Full-stack type safety |
| Styling | Tailwind CSS v3 | Utility-first, production-proven |
| UI Components | shadcn/ui + Radix | Accessible, full control |
| Animations | Framer Motion | Best React animation library |
| **3D Models** | Three.js + @react-three/fiber + @react-three/drei | 3D anatomy viewer |
| Maps | Leaflet + React Leaflet | Free, no API key |
| Icons | Lucide React + Phosphor Icons | Clean, modern |
| Image Upload | react-dropzone | Mobile camera + drag-drop |
| PWA | next-pwa | Add to home screen |
| State | Zustand | Lightweight global state |
| Forms | React Hook Form + Zod | Fast validated forms |
| Fonts | Inter + DM Sans (Google) | Clean, modern, legible |
| Hosting | Vercel | Zero-config, free tier |

---

## 3. The 3D Anatomy Model — Hero Feature

The 3D anatomical head model is what makes this app different from every other health app.
When the user selects "Ear", the ear glows on the model. When they select "Nose", the nose highlights. This turns symptom entry into an experience.

### Where to Get Free 3D Models

| Source | Model | License | URL |
|---|---|---|---|
| Sketchfab | "Human Head Anatomy" by Zamerius | CC Attribution | sketchfab.com |
| Sketchfab | "Ear Anatomy Cross Section" | CC Attribution | sketchfab.com |
| NIH 3D Print Exchange | Ear canal, nasal cavity | Public domain | 3d.nih.gov |
| Free3D | ENT anatomy models | Free personal use | free3d.com |

Search Sketchfab for "ENT anatomy", "ear cross section", "nasal cavity anatomy".
Download as GLB (ready for Three.js). Convert OBJ/FBX using **gltf.report** (free online).

### Install

```bash
npm install three @react-three/fiber @react-three/drei
npm install @types/three
```

### Implementation

```tsx
// components/3d/AnatomyViewer.tsx
"use client";
import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";

function HeadModel({ highlightArea }: { highlightArea: "ear" | "nose" | "throat" | null }) {
  const { scene } = useGLTF("/models/ent-head.glb");
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
    }
  });

  const AREA_COLORS = { ear: 0x818cf8, nose: 0x34d399, throat: 0xfb923c };

  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const mat = child.material as THREE.MeshStandardMaterial;
      const name = child.name.toLowerCase();
      if (highlightArea && name.includes(highlightArea)) {
        mat.emissive = new THREE.Color(AREA_COLORS[highlightArea]);
        mat.emissiveIntensity = 0.5;
      } else {
        mat.emissiveIntensity = 0;
      }
    }
  });

  return <primitive ref={ref} object={scene} scale={1.2} />;
}

export function AnatomyViewer({ highlightArea }: { highlightArea: "ear" | "nose" | "throat" | null }) {
  return (
    <Canvas camera={{ position: [0, 0, 3], fov: 45 }} style={{ background: "transparent" }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <Suspense fallback={null}>
        <HeadModel highlightArea={highlightArea} />
        <Environment preset="studio" />
      </Suspense>
      <OrbitControls enableZoom={false} enablePan={false}
        minPolarAngle={Math.PI / 4} maxPolarAngle={Math.PI * 0.75} />
    </Canvas>
  );
}

useGLTF.preload("/models/ent-head.glb");
```

Place your `.glb` file at `public/models/ent-head.glb`.

### Fallback for Low-End Devices

```tsx
const canUse3D = typeof window !== "undefined" &&
  window.WebGLRenderingContext !== undefined;

// Render AnatomyViewer if canUse3D else render an SVG anatomical illustration
```

### Where the 3D Model Appears

| Screen | Use |
|---|---|
| Home | Full-screen background, slow rotation, glow on hover |
| Symptom entry | User taps ear/nose/throat on model to select area |
| Results | Small model in corner, affected area highlighted |
| Hospital map | Replace with Leaflet map |

---

## 4. Design System

### Colour Palette — Dark Mode First

```css
:root {
  /* Backgrounds */
  --bg:            #0a0a0a;   /* Page background */
  --surface:       #111111;   /* Cards */
  --surface-high:  #1a1a1a;   /* Elevated cards */
  --border:        #2a2a2a;   /* Borders */

  /* Text */
  --text-1:  #f5f5f5;  /* Primary */
  --text-2:  #a0a0a0;  /* Secondary */
  --text-3:  #606060;  /* Muted */

  /* Brand */
  --blue:      #3b82f6;
  --blue-glow: rgba(59,130,246,0.15);

  /* Urgency */
  --red:    #ef4444;
  --orange: #f97316;
  --yellow: #eab308;
  --green:  #22c55e;

  /* Area accents */
  --ear:    #818cf8;  /* Indigo */
  --nose:   #34d399;  /* Emerald */
  --throat: #fb923c;  /* Orange */
}
```

Provide a light mode toggle — some users prefer it.

### Typography

```
Headings: DM Sans 700, letter-spacing -0.02em
Body:     Inter 400, line-height 1.6
IDs:      DM Mono 500, letter-spacing 0.08em
```

```bash
# In layout.tsx via Google Fonts or next/font
import { Inter, DM_Sans, DM_Mono } from "next/font/google";
```

### Motion — Framer Motion

```tsx
// Page transitions
const page = {
  initial: { opacity: 0, y: 12 },
  enter:   { opacity: 1, y: 0,  transition: { duration: 0.25 } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

// Urgency badge pop-in
const badge = {
  initial: { scale: 0.8, opacity: 0 },
  enter:   { scale: 1,   opacity: 1, transition: { type: "spring", stiffness: 300, damping: 20 } },
};

// Analysis pulse
const pulse = {
  animate: { scale: [1, 1.04, 1], opacity: [0.7, 1, 0.7],
    transition: { duration: 2, repeat: Infinity } },
};
```

---

## 5. Screen-by-Screen UI Plan

### Screen 1 — Landing

```
┌──────────────────────────────────┐
│  [3D head, rotating slowly]      │
│  Soft gradient glow behind it    │
│                                  │
│  ENT-Care                        │
│  Describe your symptoms.         │
│  Get guidance instantly.         │
│                                  │
│  [ Start Assessment ]  ← big CTA │
│                                  │
│  Look up a previous report       │
│  [ ENT-2026-________ ] [ Find ]  │
└──────────────────────────────────┘
```

- 3D head fills 60% screen height on mobile
- Single primary CTA — nothing else competes
- Report lookup is secondary, below

---

### Screen 2 — Symptom Entry (Step 1 of 3)

```
┌──────────────────────────────────┐
│  ← Back          Step 1 of 3    │
│                                  │
│  Where does it hurt?             │
│  [3D head — tap to select]       │
│                                  │
│  [ 👂 Ear ] [ 👃 Nose ]          │
│  [ 🗣 Throat ] [ Head/Neck ]     │
│                                  │
│  Describe what you're feeling    │
│  ┌──────────────────────────┐    │
│  │ e.g. "pain in right ear  │    │
│  │  for 3 days, discharge"  │    │
│  └──────────────────────────┘    │
│                                  │
│  How long?                       │
│  [1-3 days][1 week][2+ weeks]    │
│                                  │
│  Your age (optional)  [    ]     │
│                                  │
│  [ Continue → ]                  │
└──────────────────────────────────┘
```

- Tapping the 3D model selects the area AND highlights it in the model
- Textarea auto-resizes as user types
- Duration = pill buttons (not a dropdown)
- Continue only enabled when symptoms >= 10 characters

---

### Screen 3 — Context & Photo (Step 2 of 3)

```
┌──────────────────────────────────┐
│  ← Back          Step 2 of 3    │
│  Optional — skip if you like     │
│                                  │
│  Any other symptoms?             │
│  ┌──────────────────────────┐    │
│  │ e.g. "also have fever"   │    │
│  └──────────────────────────┘    │
│                                  │
│  Upload a photo (optional)       │
│  ┌──────────────────────────┐    │
│  │   📷 Take / upload photo │    │
│  │   Ear, nose or throat    │    │
│  └──────────────────────────┘    │
│  "Images may be retained for     │
│   diagnostic purposes"  [i]      │
│                                  │
│  Share location for nearby       │
│  hospital results                │
│  [ Toggle OFF → ON ]             │
│  or type: [  Your town/area  ]   │
│                                  │
│  [ Analyse my symptoms → ]       │
└──────────────────────────────────┘
```

- Full "Skip" option — this screen is entirely optional
- Image upload: react-dropzone — mobile users get camera button
- Location toggle OFF by default — explain the benefit clearly
- If location OFF: show town/area text field as fallback

---

### Screen 4 — Analysing (Loading)

```
┌──────────────────────────────────┐
│                                  │
│  [3D head, pulsing glow on       │
│   the selected area]             │
│                                  │
│  Analysing your symptoms...      │
│                                  │
│  ██████████░░  Checking database │
│  ████████████  AI analysis       │
│  ████░░░░░░░░  Finding hospitals │
│                                  │
│  Takes about 3 seconds           │
│                                  │
└──────────────────────────────────┘
```

- Animated progress bar with real-looking steps
- If API > 5 seconds: "Still working — almost there"
- 3D model pulses in the accent colour for the selected area

---

### Screen 5 — Results (Most Important)

```
┌──────────────────────────────────┐
│                                  │
│  🟡 SEE A DOCTOR SOON            │
│  Book an appointment this week   │  ← full-width urgency banner
│                                  │
│  ─────────────────────────────── │
│                                  │
│  This may be                     │
│  Middle Ear Infection            │  ← commonName, large
│  Acute Otitis Media              │  ← clinical name, smaller
│  ████████████████░░  High match  │  ← confidence bar
│                                  │
│  What to do right now            │
│  ┌──────────────────────────┐    │
│  │ Take regular pain relief.│    │
│  │ Keep the ear dry. See a  │    │
│  │ doctor within the week.  │    │
│  └──────────────────────────┘    │
│                                  │
│  ⚠ Go to A&E immediately if...  │
│  · swelling behind the ear       │
│  · facial drooping               │
│  · sudden hearing loss           │
│                                  │
│  Other possibilities             │
│  · Otitis Externa       65%      │
│  · Eustachian Dysfunction 50%    │
│                                  │
│  Possible causes                 │
│  Bacteria · Recent cold          │
│                                  │
│  You should see                  │
│  ENT Specialist                  │
│                                  │
│  ─────────────────────────────── │
│                                  │
│  Your report ID                  │
│  ┌──────────────────────────┐    │
│  │  ENT-2026-A3F9C2D1 [Copy]│    │
│  └──────────────────────────┘    │
│  Save a copy → [ email/phone ]   │
│                                  │
│  [ Find a hospital near me ]     │
│  [ Start new assessment    ]     │
└──────────────────────────────────┘
```

**Emergency override** — if urgencyScore >= 9:
- Show full-screen red overlay
- Hide "Find hospital" button
- Show only: "Call 112" and "Get directions to nearest A&E"
- No other actions available

---

### Screen 6 — Hospital Finder

```
┌──────────────────────────────────┐
│  ← Results   Hospitals near you  │
│                                  │
│  ┌──────────────────────────┐    │
│  │   [ Leaflet Map ]        │    │
│  │   User pin 📍             │    │
│  │   Hospital pins 1 2 3    │    │
│  │   Tap pin = highlight    │    │
│  └──────────────────────────┘    │
│                                  │
│  4 hospitals found               │
│                                  │
│  ┌──────────────────────────┐    │
│  │ 1 OOUTH Sagamu           │    │
│  │   7.1km · 12min drive    │    │
│  │   ✓ Accredited · ENT     │    │
│  │   [Directions] [Details] │    │
│  └──────────────────────────┘    │
│  ┌──────────────────────────┐    │
│  │ 2 Babcock University...  │    │
│  │   8.0km · 14min drive    │    │
│  └──────────────────────────┘    │
│                                  │
│  Sorted by specialty relevance   │
└──────────────────────────────────┘
```

- Map pins numbered 1,2,3 — match the card order
- Tap pin → scroll to + highlight card
- "Directions" → opens Google/Apple Maps with lat/lng
- "Details" → bottom sheet with full facility info

---

### Screen 7 — Report Lookup

```
┌──────────────────────────────────┐
│  ← Home                          │
│                                  │
│  Look up your report             │
│                                  │
│  Enter your Report ID            │
│  ┌──────────────────────────┐    │
│  │  ENT-2026-________       │    │
│  └──────────────────────────┘    │
│  [ Find my report ]              │
│                                  │
│  ─────────────────────────────── │
│  Don't have your ID?             │
│  Enter the email or phone you    │
│  saved with your report          │
│  [ ________________________ ]    │
│  [ Look up by contact ]          │
└──────────────────────────────────┘
```

---

## 6. Architecture

### Directory Structure

```
src/
  app/
    page.tsx                       ← Landing
    assessment/
      page.tsx                     ← Symptom entry steps 1-2
    analyzing/
      page.tsx                     ← Loading screen
    results/
      [trackingId]/page.tsx        ← Results display
    hospitals/page.tsx             ← Hospital finder + map
    report/page.tsx                ← Report lookup
    api/                           ← SERVER-SIDE PROXIES (hide API key)
      analyze/route.ts
      analyze-image/route.ts
      report/route.ts
      hospitals/route.ts
      profile/route.ts
      escalation/route.ts
  components/
    3d/
      AnatomyViewer.tsx            ← Three.js canvas
      AnatomyIllustration.tsx      ← SVG fallback
    ui/
      UrgencyBanner.tsx
      ConditionCard.tsx
      RedFlagsList.tsx
      TrackingIdDisplay.tsx
      HospitalCard.tsx
      HospitalMap.tsx
    forms/
      SymptomForm.tsx
      ImageUpload.tsx
      LocationToggle.tsx
  lib/
    store.ts                       ← Zustand state
    utils.ts
    urgency.ts                     ← Urgency config constants
  public/
    models/ent-head.glb            ← 3D model file
    manifest.json                  ← PWA manifest
```

### State (Zustand)

```typescript
// lib/store.ts
import { create } from "zustand";

interface AssessmentState {
  symptoms: string;
  affectedArea: "ear" | "nose" | "throat" | "head_neck" | null;
  duration: string;
  age: number | null;
  additionalContext: string;
  imageBase64: string | null;
  latitude: number | null;
  longitude: number | null;
  place: string;
  analysisResult: unknown | null;
  trackingId: string | null;

  setSymptoms: (s: string) => void;
  setAffectedArea: (a: AssessmentState["affectedArea"]) => void;
  setAnalysisResult: (r: unknown) => void;
  setTrackingId: (id: string) => void;
  reset: () => void;
}

export const useAssessmentStore = create<AssessmentState>((set) => ({
  symptoms: "", affectedArea: null, duration: "", age: null,
  additionalContext: "", imageBase64: null, latitude: null,
  longitude: null, place: "", analysisResult: null, trackingId: null,

  setSymptoms: (symptoms) => set({ symptoms }),
  setAffectedArea: (affectedArea) => set({ affectedArea }),
  setAnalysisResult: (analysisResult) => set({ analysisResult }),
  setTrackingId: (trackingId) => set({ trackingId }),
  reset: () => set({ symptoms: "", affectedArea: null, analysisResult: null, trackingId: null }),
}));
```

### API Proxy Layer (CRITICAL — read this)

**Never expose the API key to the browser.**
All calls to the ENT service go through your own Next.js API routes.

```typescript
// app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";

const ENT_BASE = "https://ent-server.hostl.cloud/api/v1";
const ENT_KEY  = process.env.ENT_API_KEY!;  // server-side only

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${ENT_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": ENT_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
```

Your frontend calls `/api/analyze` (your own route).
Your route calls `ent-server.hostl.cloud` with the key.
The key never reaches the browser.

---

## 7. All API Endpoints — Complete Reference

### Service URLs

| Environment | URL |
|---|---|
| Primary | https://ent-server.hostl.cloud |
| Vercel | https://ent-location-sys.vercel.app |
| API Docs | https://ent-server.hostl.cloud/docs |

### Your API Key (Development)

```
X-API-Key: ent_f7d9f9487aaabd5e0fbfb54c06b8b6100fc2820eb2e8b79d
```

Store in `.env.local` as `ENT_API_KEY`. Server-side only. Never in a `NEXT_PUBLIC_` variable.

### Endpoint Map

| Method | Endpoint | Purpose | Your proxy |
|---|---|---|---|
| POST | `/api/v1/analyze` | Run symptom analysis (core) | `/api/analyze` |
| POST | `/api/v1/analyze-image` | Analyse uploaded photo | `/api/analyze-image` |
| POST | `/api/v1/reports` | Save report + get tracking ID | `/api/report` |
| GET  | `/api/v1/reports/:trackingId` | Fetch saved report | `/api/report/[id]` |
| POST | `/api/v1/nearby-for-report` | Find hospitals after analysis | `/api/hospitals` |
| POST | `/api/v1/nearby` | Find hospitals by place name | `/api/hospitals` |
| POST | `/api/v1/patient-profile` | Save optional patient profile | `/api/profile` |
| GET  | `/api/v1/patient-profile` | Look up profile by email/phone | `/api/profile` |
| POST | `/api/v1/escalation/:id/consent` | Consent for specialist review | `/api/escalation` |

---

## 8. Diagnosis Flow — Full Code

### Step 1 — Analyse Symptoms

```typescript
// User submits form → frontend calls your proxy → proxy calls ENT service
const response = await fetch("/api/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    symptoms:          store.symptoms,
    affectedArea:      store.affectedArea,     // "ear" | "nose" | "throat"
    duration:          store.duration,         // "3 days"
    age:               store.age,
    additionalContext: store.additionalContext,
    latitude:          store.latitude,
    longitude:         store.longitude,
    includeNearby:     false,  // always false here
  }),
});

const data = await response.json();
// data.data.analysis.primaryCondition.name       → "Acute Otitis Media"
// data.data.analysis.primaryCondition.commonName  → "Middle ear infection"
// data.data.clinical.urgencyScore                 → 6
// data.data.clinical.urgencyLevel                 → "Soon"
// data.data.clinical.urgencyColor                 → "yellow"
// data.data.clinical.immediateAction
// data.data.clinical.redFlags                     → string[]
// data.data.clinical.patientAdvice
// data.data.clinical.specialists                  → ["ENT"]
// data.data.clinical.investigations               → string[]
// data.data.clinical.possibleCauses               → string[]
// data.data.clinical.complications                → string[]
// data.data.analysis.differentials               → [{name, commonName, confidence}]
// data.data.analysis.aiInsights.specialties      → ["ENT", "Otology"]
// data.data.analysis.aiInsights.services         → ["Audiometry"]
// data.data.analysis.aiInsights.reasoning        → string
// data.data.analysis.aiStatus.available          → true/false
// data.data.escalation.isComplex                 → false
```

### Step 2 — Save Report Immediately

```typescript
// Always save — user gets their tracking ID
const reportRes = await fetch("/api/report", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    symptoms:             store.symptoms,
    affectedArea:         store.affectedArea,
    duration:             store.duration,
    age:                  store.age,
    analysisResult:       data.data,
    primaryConditionId:   data.data.analysis.primaryCondition?.id,
    primaryConditionName: data.data.analysis.primaryCondition?.name,
    urgencyScore:         data.data.clinical.urgencyScore,
    urgencyLevel:         data.data.clinical.urgencyLevel,
    referralThreshold:    data.data.clinical.referralThreshold,
    latitude:             store.latitude,
    longitude:            store.longitude,
    patientProfileId:     null,  // set after profile save
  }),
});

const { data: reportData } = await reportRes.json();
store.setTrackingId(reportData.trackingId);  // "ENT-2026-A3F9C2D1"
// SHOW THIS TO THE USER IMMEDIATELY
```

### Step 3 — Image Analysis (run in parallel with /analyze)

```typescript
const [analysisRes, imageRes] = await Promise.allSettled([
  fetch("/api/analyze", { method: "POST", body: JSON.stringify(analyzePayload) }),
  store.imageBase64
    ? fetch("/api/analyze-image", {
        method: "POST",
        body: JSON.stringify({
          imageBase64:        store.imageBase64,
          imageType:          store.affectedArea ?? "general",
          additionalContext:  store.additionalContext,
        }),
      })
    : Promise.resolve(null),
]);

// Image result:
// imageData.data.analysis.findings           → string[]
// imageData.data.analysis.possibleConditions → string[]
// imageData.data.analysis.urgencyScore       → number
// imageData.data.analysis.nextSteps          → string[]
// imageData.data.disclaimer  ← ALWAYS display this
// imageData.data.consentNotice
```

**Show before upload:**
> "Images you upload may be retained for diagnostic quality improvement and specialist review purposes. By submitting, you acknowledge and consent to this usage."

### Step 4 — Find Nearby Hospitals

Only call when user taps "Find a hospital near me":

```typescript
const hospitalsRes = await fetch("/api/hospitals", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    primaryCondition: data.data.analysis.primaryCondition?.name,
    specialists:      data.data.clinical.specialists,
    urgencyScore:     data.data.clinical.urgencyScore,
    requiredServices: data.data.analysis.aiInsights?.services ?? [],
    latitude:         store.latitude,
    longitude:        store.longitude,
    place:            store.place,     // fallback if no GPS
    radiusKm:         50,
    limit:            8,
    onlyAccredited:   true,
  }),
});

// Each facility:
// facility.name, facility.address, facility.city, facility.state
// facility.distanceKm, facility.accredited
// facility.specialties, facility.matchedSpecialties
// facility.travelTimes.driving / walking / motorcycle
// facility.latitude, facility.longitude  ← for Google Maps link
```

### Step 5 — Escalation Consent

If `data.data.escalation.isComplex === true`:

```typescript
// Show the escalation message to the user
// data.data.escalation.message
// Ask: "Yes, share with a specialist" / "No thank you"

await fetch("/api/escalation", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    caseId:  data.data.escalation.caseId,
    consent: true,          // or false
    email:   patientEmail,  // optional — if user provided
  }),
});
```

### Step 6 — Optional Profile Save

```typescript
await fetch("/api/profile", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    firstName: "Adaeze",
    email:     "adaeze@email.com",
    phone:     "+2348012345678",
    consentToDataRetention: true,  // REQUIRED to save
    consentToContactByEmail: true,
  }),
});
// Returns: { data: { id: "cm..." } }
// Use id to link to future reports via patientProfileId
```

---

## 9. Urgency Display — Exact Implementation

```typescript
// lib/urgency.ts
export const URGENCY_CONFIG = {
  Emergency: {
    color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "#ef4444",
    icon: "🚨", label: "EMERGENCY",
    action: "Call 112 or go to your nearest emergency room immediately.",
    override: true,   // hide "Find hospital" — show "Call 112" only
  },
  Urgent: {
    color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "#f97316",
    icon: "⚠️", label: "URGENT",
    action: "See a doctor today or tomorrow. Do not delay.",
    override: false,
  },
  Soon: {
    color: "#eab308", bg: "rgba(234,179,8,0.12)", border: "#eab308",
    icon: "🕐", label: "SEE A DOCTOR SOON",
    action: "Book an appointment within the next few days.",
    override: false,
  },
  Routine: {
    color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "#22c55e",
    icon: "✓", label: "ROUTINE",
    action: "Monitor symptoms and book an ENT appointment when convenient.",
    override: false,
  },
} as const;

export function mapReferralThreshold(value: string): string {
  const map: Record<string, string> = {
    emergency:    "Go to emergency room now.",
    urgent_24h:   "See a doctor today or tomorrow.",
    urgent_week:  "Book a doctor appointment this week.",
    routine:      "Book an ENT appointment at your convenience.",
    gp_only:      "Your regular doctor can help with this.",
  };
  return map[value] ?? "Consult a healthcare provider.";
}
```

---

## 10. PWA Setup

```bash
npm install next-pwa
```

```javascript
// next.config.js
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});
module.exports = withPWA({ reactStrictMode: true });
```

```json
// public/manifest.json
{
  "name": "ENT-Care",
  "short_name": "ENT-Care",
  "description": "Ear, Nose and Throat healthcare guidance",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## 11. Environment Variables

```bash
# .env.local
ENT_API_KEY=ent_f7d9f9487aaabd5e0fbfb54c06b8b6100fc2820eb2e8b79d
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

Never put `ENT_API_KEY` in a `NEXT_PUBLIC_` variable — that exposes it to the browser.

---

## 12. What You Must NOT Build

The ENT service handles all of this:

- Hospital database
- Distance and travel time calculations
- AI or ML models
- Geocoding (place name → coordinates)
- Condition knowledge base (150 conditions already exist server-side)
- Specialist matching logic
- Report storage and tracking ID generation

Your team builds: **UI, UX, symptom collection, results display, map rendering, report tracking flow.**

---

## 13. Suggested Build Order

| Sprint | Deliverable |
|---|---|
| 1 | Project scaffold, design system, fonts, Tailwind config, API proxy layer |
| 2 | 3D anatomy model on landing page, area selection working |
| 3 | Symptom entry form, Zustand state, form validation |
| 4 | Analysis loading screen + live ENT service integration |
| 5 | Results screen — urgency system, tracking ID, escalation UI |
| 6 | Hospital finder — Leaflet map + hospital cards |
| 7 | Report lookup screen, patient profile save, image upload |
| 8 | PWA setup, mobile testing on Android/iOS, error states |
| 9 | Polish — Framer Motion transitions, accessibility audit |
| 10 | Performance audit (Lighthouse), launch |

---

## 14. Service Links

| Resource | URL |
|---|---|
| ENT Service (Primary) | https://ent-server.hostl.cloud |
| ENT Service (Vercel) | https://ent-location-sys.vercel.app |
| API Docs | https://ent-server.hostl.cloud/docs |
| Admin panel | https://ent-server.hostl.cloud/admin |
| GitHub | https://github.com/dev-olayemi/ent-location-sys |
| Full API integration guide | See README.md in this folder |

---

*Document version 1.0 — November 2026*
*Maintained by ENT-Care Platform*
