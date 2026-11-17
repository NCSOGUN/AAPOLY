# ENT-Care Patient Web App — Full Handover
**Team:** Patient Web App (PWA / Mobile-First)
**Service:** ENT-Care Location Intelligence Service
**Date:** November 2026

---
the brand logo (aap-logo-img.png)
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

## 3. Interactive Anatomy — Landing Page Feature

The landing page introduces the service through an interactive anatomy workspace, not a decorative or autoplaying 3D background. The patient can explore the full-body model, focus the head and neck, or switch to focused ENT anatomy.

### Anatomy views

| View | Model and behaviour |
|---|---|
| Whole body | Interactive male/female full-body model; select structures and toggle anatomical systems |
| Head & neck | The same full-body asset, reframed to the head and neck for close inspection |
| Ear | Dedicated interactive ear model |
| Nose & sinuses | Dedicated interactive nasal and sinus model |
| Throat | Switch between the pharynx and larynx models |

The supplied full-body models are provided by the Open Anatomy 3D project. The supplied regional GLBs are separate assets; keep the original files intact and do not merge them into the full-body scene. Check the embedded attribution and licence details before redistribution.

### Interaction and presentation

- Selecting an anatomy view updates both the active control and the model in the bounded, light canvas.
- Models support deliberate drag-to-rotate, zoom, structure selection, visibility controls, and a reset view where available.
- The head-and-neck selection must visibly focus the model; a distant full-body model with only a highlighted label is not sufficient.
- Use the same logo-derived green selection treatment across anatomy views. Do not assign arbitrary colours to different ENT areas.
- Keep the controls available on touch screens and when WebGL is unavailable. Provide a clear, useful fallback rather than a blank canvas.
- Anatomy is for education and exploration only; never present it as a diagnostic tool.

### Loading and performance

- Lazy-load the viewer code and wait until the anatomy panel is close to the viewport before requesting a model.
- Load only the selected anatomy asset. Do not download the ear, nose, pharynx, and larynx models on the initial visit.
- Cache models between view changes, show an explicit loading state, and preserve the original GLB files.
- Keep rendering resolution and layout responsive on mobile; do not make a full-screen model the first obstacle before a patient can start an assessment.
- Stop/unmount inactive viewers where practical and respect reduced-motion preferences.
- If WebGL is unavailable, keep the page and assessment actions usable and explain that 3D viewing is unavailable.

---

## 4. Design System — Light, Minimal, Functional

> **Design decision (November 2026):** ENT-Care uses a light-only interface. The visual direction is Google-inspired minimalism: calm, precise, accessible, and highly functional. This is a reference to the restraint and clarity of Google's product interfaces, not a request to copy Google branding or proprietary components.

### 4.1 Design principles

1. **Content before decoration.** Every visual element must help the patient understand, decide, or act.
2. **White is the default.** Use white page surfaces, pale neutral section backgrounds, and fine borders. Do not use dark panels or dark-mode styling.
3. **One clear primary action per screen.** Secondary actions must look secondary.
4. **Colour communicates meaning.** Logo-derived green is for primary interaction and anatomy selection. Red, orange, and amber are reserved for clinical urgency states; green urgency styling is used only for the routine status.
5. **No artificial visual effects.** Do not use glassmorphism, neon glow, floating gradient blobs, heavy shadows, excessive blur, animated particles, or decorative 3D objects.
6. **Motion must explain a state change.** Avoid animation that exists only to make the interface look busy.
7. **Design mobile-first, then expand.** The mobile experience must be complete, not a compressed desktop layout.
8. **Accessible by default.** Clear focus states, keyboard operation, readable contrast, labelled controls, and touch targets of at least 44 × 44 px.

### 4.2 Colour tokens

Use the following tokens consistently. Do not introduce a new colour for every component.

```css
:root {
  color-scheme: light;

  /* Base surfaces */
  --background: #ffffff;
  --surface: #ffffff;
  --surface-subtle: #f8f9fa;
  --surface-muted: #f1f3f4;

  /* Borders and dividers */
  --border: #dadce0;
  --border-strong: #bdc1c6;

  /* Text */
  --text-primary: #202124;
  --text-secondary: #5f6368;
  --text-muted: #80868b;
  --text-disabled: #9aa0a6;

  /* Brand / interaction: sampled from the supplied logo */
  --primary: #008550;
  --primary-hover: #006c45;
  --primary-pressed: #005638;
  --primary-subtle: #e8f4ee;
  --focus-ring: #008550;

  /* Clinical status — use only for urgency and safety */
  --status-emergency: #d93025;
  --status-emergency-bg: #fce8e6;
  --status-urgent: #e37400;
  --status-urgent-bg: #fef7e0;
  --status-soon: #b06000;
  --status-soon-bg: #fef7e0;
  --status-routine: #188038;
  --status-routine-bg: #e6f4ea;

  /* Anatomy selection */
  --anatomy-selected: #008550;
  --anatomy-selected-bg: #e8f4ee;

  /* Shape and elevation */
  --radius-control: 8px;
  --radius-card: 12px;
  --radius-panel: 16px;
  --shadow-menu: 0 2px 8px rgb(60 64 67 / 16%);
  --shadow-dialog: 0 8px 24px rgb(60 64 67 / 18%);
}
```

**Usage rules**
- Use the logo-derived green (`#008550`) for primary interaction and anatomy selection.
- Main page background: `--background`.
- Grouped form sections and quiet supporting areas: `--surface-subtle`.
- Inputs and cards: white with a 1 px `--border`.
- Use shadows only for overlays, menus, and dialogs. Standard cards should rely on spacing and borders, not elevation.
- Do not use the clinical status colours as general brand colours.
- Do not assign unrelated colours to Ear, Nose, and Throat. Use the same logo-green selection treatment for all selected anatomy regions; the label provides the distinction.

### 4.3 Typography

Use one dependable sans-serif family throughout. Prefer **Inter**; use a system sans-serif fallback. Do not mix Inter, DM Sans, DM Mono, and decorative display fonts.

```css
:root {
  --font-sans: Inter, "Google Sans", Roboto, Arial, sans-serif;
}

body {
  font-family: var(--font-sans);
  color: var(--text-primary);
  font-size: 16px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

h1 { font-size: clamp(2rem, 4vw, 2.75rem); line-height: 1.15; font-weight: 600; }
h2 { font-size: 1.5rem; line-height: 1.3; font-weight: 600; }
h3 { font-size: 1.125rem; line-height: 1.4; font-weight: 600; }
small, .supporting-text { font-size: 0.875rem; color: var(--text-secondary); }
```

Use sentence case for headings and buttons. Avoid all-caps labels except short status labels where needed. Report IDs may use a monospace font for legibility, but do not use monospace for ordinary content.

### 4.4 Layout, spacing, and components

- Use a consistent 4 px spacing base, with most layout gaps on an 8 px rhythm.
- Main content width: `min(100% - 32px, 1120px)`; use wider layouts only for the hospital map or anatomy workspace where the content benefits from it.
- Desktop header: approximately 64 px high. Mobile header: approximately 56 px high.
- Standard input and button height: 44–48 px.
- Form fields should have a visible label above the control. Placeholder text is an example, never the only label.
- Cards: 12 px radius, 1 px neutral border, white background, no permanent heavy shadow.
- Buttons: solid logo-green for the primary action; white with a border for secondary actions; text buttons for low-priority actions.
- Use Lucide icons consistently. Icons must have a label or an obvious accessible name; do not use emoji as the primary icon system.
- Use consistent skeletons for loading content. Do not shift the page layout when data arrives.
- Empty, error, success, disabled, hover, pressed, and keyboard-focus states must be designed—not left to browser defaults.

### 4.5 Motion and interaction

Keep motion restrained and fast:
- Typical hover/focus transition: 120–160 ms.
- Small state transition: 160–220 ms.
- Avoid large page slides, springy overshoot, pulsing cards, continuous shimmer, and looping attention effects.
- Respect `prefers-reduced-motion`.
- Do not show a percentage-based progress bar unless the API provides real progress. For analysis, show a calm loading state with truthful status text (for example, “Reviewing your symptoms…”). Do not invent a “3-second” completion promise or imply that separate steps are running if they are not.
- 3D model rotation must be user-controlled by default. If a subtle idle movement is retained on the landing page, it must stop when the user interacts, respect reduced-motion preferences, and never distract from the main action.

### 4.6 3D anatomy presentation

The anatomy model is a functional selection aid, not a decorative background:
- Keep it inside a clearly bounded, light canvas with a neutral background.
- Provide visible Ear, Nose, Throat, and Head/Neck controls alongside the model. The controls must remain usable if WebGL fails.
- Selecting an area must update both the model highlight and the selected control state.
- Hover may preview a structure; click/tap selects it. Do not make hover the only way to discover or select an area.
- Provide concise labels and a reset-view control. Do not place large glowing labels over the model.
- On small screens, use a compact model panel with the area controls directly below or beside it; do not force a full-screen 3D experience.
- Load the model only where needed, show a useful loading fallback, and provide a static illustration or direct area buttons when WebGL is unavailable.
- Do not autoplay a full rotation or run continuous animation on the symptom form.
- The 3D model must not block form completion, keyboard navigation, or screen-reader access.

### 4.7 Interactive patient-page visual system

- Use the approved assessment workspace as the visual reference for diagnosis, saved-report, report-lookup, and hospital-finder pages. Keep the compact branded header, pale cool-neutral page surface, editorial page heading, clear progress or section labels, bordered white work panels, and logo-green primary actions.
- Keep diagnosis and report content structured and scannable. Use a restrained side panel for context or a next action; on mobile, stack it after the main task.
- Use the same input, button, card, spacing, focus, selected, loading, error, empty, and success treatments across patient-facing interactive pages.
- Do not apply this assessment layout to the landing page. The anatomy-led landing page remains its own approved design.

---

## 5. Screen-by-Screen UI Plan

The following is the visual and interaction specification. Keep the same light design system on every screen. The wireframes are structural guides, not pixel-perfect mockups.

### Screen 1 — Landing

**Purpose:** Explain the service quickly and get the patient into the assessment or report lookup.

**Desktop layout**
- Header with the supplied brand logo and ENT-Care wordmark on the left, and a small set of useful links and the primary assessment action on the right.
- Two-column hero: concise headline, assessment action, and anatomy-view selector on the left; contained interactive anatomy workspace on the right.
- White background. No full-screen model, gradient backdrop, decorative blobs, or carousel.
- Do not add a “No account required” badge or another generic reassurance slogan.
- Keep anatomy models in a bounded canvas. The selected view must be apparent from both the selector and the model.

**Mobile layout**
- Compact header with the supplied logo, wordmark, and primary assessment action.
- Place the headline, short explanation, assessment action, and compact anatomy-view selector before the viewer.
- Stack the bounded model panel below the selector; keep the panel and controls within the viewport width.
- Do not download anatomy assets until the viewer is near the viewport. Do not make the user scroll past an autoplaying model to start an assessment.

**Content hierarchy**
1. “Begin with the part that’s bothering you.”
2. One short sentence connecting anatomy exploration to symptom guidance.
3. Primary button: “Start symptom check”
4. Anatomy views: Whole body, Head & neck, Ear, Nose & sinuses, and Throat.

### Screen 2 — Symptom Entry (Step 1 of 2)

- Show a clear step indicator and a back action.
- Heading: “Where are you experiencing symptoms?”
- Present Ear, Nose, and Throat as image-led selectable cards using the locally hosted images in `public/ent-images/`; do not include a Head/Neck symptom area.
- Keep the selected area clear with a logo-green border and selected state. Do not rely on the image alone to communicate the label.
- Label the symptom textarea clearly: “Describe what you’re feeling”.
- Provide duration as a small set of selectable options, while allowing an “Other” or free-text option if the API accepts it.
- Age remains optional.
- Primary action: “Continue”.
- Validate with clear inline messages. Do not rely on colour alone.
- Do not disable continuation based on an arbitrary character count unless product/backend validation explicitly requires it; explain what is missing when validation fails.

### Screen 3 — Additional Context and Photo (Step 2 of 3)

- Mark the page clearly as optional and provide a visible “Skip this step” action.
- Separate additional context, optional image upload, and location sharing into distinct sections.
- Image upload area should be a simple bordered drop zone with a camera/upload icon, supported file types, and the 4 MB size limit.
- Before any image is sent, show the consent wording supplied by the service and require an affirmative action. Do not hide consent in a tooltip or footer.
- Explain why location is requested and what it enables. Location sharing must be optional.
- If GPS is declined or unavailable, offer the place-name input described in the API guide.
- Primary action: “Review and submit” or the agreed next-step label.

### Screen 4 — Analysing

- Keep the page quiet and reassuring.
- Show a small progress indicator or spinner with truthful text such as “Reviewing your symptoms”.
- Do not fabricate a percentage, countdown, or sequence of backend operations.
- If the request takes longer than expected, update the message without implying a guaranteed completion time.
- Provide a recoverable error state with a retry action if the request fails.
- Avoid a large pulsing 3D head or flashing highlights during analysis.

### Screen 5 — Results

This is the most important screen. The patient must understand urgency and the next action before reading secondary details.

**Recommended order**
1. Urgency status and the service-provided immediate action.
2. Plain-language possible condition, with the clinical name as supporting information.
3. Red flags, clearly separated and easy to scan.
4. Patient advice.
5. Other possible conditions and causes, where returned by the service.
6. Recommended specialist(s).
7. Report tracking ID and copy action.
8. Find a hospital action, when appropriate under the service's urgency guidance.

The diagnosis/results page uses the shared interactive patient-page visual system in Section 4.7. Preserve its urgency-first content order and keep the emergency instruction prominent.

**Presentation rules**
- Use a compact urgency panel with a restrained status tint and strong text contrast. Do not make the entire screen red/orange/yellow/green.
- Use the service's returned urgency level and wording. Do not invent a diagnosis or turn a confidence value into a guarantee.
- Label the result as preliminary/AI-assisted where the service requires it. Display the image-analysis disclaimer prominently whenever image analysis is shown.
- Red flags must be visually distinct, but not hidden inside an accordion by default.
- The tracking ID should be selectable and have a clearly labelled “Copy report ID” action. Explain that the user should keep it to retrieve the report later.
- Use clear loading, copy-success, and copy-failure feedback.
- Do not display example conditions, percentages, or advice as if they were real patient results.

**Emergency state**
- Follow the service's actual `urgencyLevel`, `referralThreshold`, and emergency instructions.
- Keep emergency instructions prominent and immediately actionable.
- Do not use a full-screen decorative red overlay that obscures information or traps the user.
- Do not implement a hard-coded numeric threshold until the backend team confirms the authoritative rule. The handover currently mentions `urgencyScore >= 9`, while the API guide maps the `Emergency` urgency level separately; confirm the source of truth before implementation.
- Keep the emergency contact/action visible and accessible. Do not make a patient search through the page to find it.

### Screen 6 — Hospital Finder

- Use a two-part layout on desktop: map and results list side by side. On mobile, show the map first in a bounded panel, followed by the list.
- Hospital cards should show name, address, distance, available travel times, accreditation, and matched specialties only when those fields are returned.
- Keep the list order and map marker numbers synchronised.
- Selecting a card highlights its map marker; selecting a marker highlights the matching card.
- Provide a clear “Directions” action that opens the appropriate map destination.
- Do not invent ratings, opening hours, availability, or travel times.
- Include loading, no-results, location-denied, and service-error states.
- Make the place-name fallback easy to find when GPS is unavailable.

### Screen 7 — Report Lookup

- Keep the page focused on one task.
- Label the input “Report ID” and show an example format as helper text.
- Primary action: “Find report”.
- Provide a clear not-found state and a retry option.
- Only offer lookup by email/phone if the backend endpoint and privacy rules support that exact flow. The API guide describes tracking-ID retrieval; confirm contact-based lookup behaviour before promising it in the UI.
- Do not imply that a patient can recover a report using contact details unless the service confirms it.

### Shared responsive behaviour

| Area | Mobile | Tablet / Desktop |
|---|---|---|
| Navigation | Compact header; no crowded menu | Simple horizontal header |
| Content | Single column with 16 px side padding | Centred content, max width around 1120 px |
| Forms | Full-width controls | Comfortable form column; avoid excessively wide fields |
| Anatomy | Compact panel; controls always visible | Model and controls side by side |
| Results | Single-column reading order | Main result column with optional supporting sidebar |
| Hospitals | Map then cards | Map and cards side by side |
| Actions | Full-width primary action where useful | Natural-width primary action |

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
X-API-Key: <server-side ENT_API_KEY environment variable>
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
    color: "#ef4444", bg: "#fef2f2", border: "#fecaca",
    icon: "🚨", label: "EMERGENCY",
    action: "Call 112 or go to your nearest emergency room immediately.",
    override: true,   // hide "Find hospital" — show "Call 112" only
  },
  Urgent: {
    color: "#f97316", bg: "#fff7ed", border: "#fed7aa",
    icon: "⚠️", label: "URGENT",
    action: "See a doctor today or tomorrow. Do not delay.",
    override: false,
  },
  Soon: {
    color: "#d97706", bg: "#fffbeb", border: "#fde68a",
    icon: "🕐", label: "SEE A DOCTOR SOON",
    action: "Book an appointment within the next few days.",
    override: false,
  },
  Routine: {
    color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0",
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
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
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
ENT_API_KEY=your_rotated_secret_key
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

*Document version 1.1 — November 2026*
*Maintained by ENT-Care Platform*
