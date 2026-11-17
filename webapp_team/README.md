# ENT-Care Patient Web Application — Integration Guide
**For: Patient Web App Team (PWA / Mobile-First)**
**Service: ENT Location Intelligence Service**
**Last Updated: November 2026**

---

## Overview

You are building the **Patient-facing Web Application** — the interface that patients use to describe their symptoms, receive a diagnosis analysis, find nearby hospitals, and track their reports.

Your app does **not** run any AI, store hospital data, or calculate distances. All of that is handled by this central service. You collect the user's input, call the right endpoints, and display the results.

---

## Service URLs

| Environment | URL |
|---|---|
| **Production (Primary)** | `https://ent-server.hostl.cloud` |
| **Production (Vercel)** | `https://ent-location-sys.vercel.app` |
| **API Docs** | `https://ent-server.hostl.cloud/docs` |

Use `ent-server.hostl.cloud` as your primary base URL.

---

## API Key Configuration

```
<redacted; configure ENT_API_KEY in .env.local>
```

Copy `../.env.example` to the project root as `.env.local` and set `ENT_API_KEY` there. Keep the key server-side; never expose it in client-side code or commit it to source control. The key previously embedded in this guide should be rotated in the service administration panel before use.

```typescript
// lib/ent-service.ts
const BASE_URL = "https://ent-server.hostl.cloud/api/v1";
const API_KEY = process.env.ENT_API_KEY; // server-side only

async function entFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY!,
      ...options.headers,
    },
  });
  return res.json();
}
```

**Important:** Call this service from your **server-side** (Next.js API routes, server actions, etc.). Never expose the API key to the browser.

The report integration below documents `POST /api/v1/reports` and `GET /api/v1/reports/:trackingId`. The currently published API reference at `https://ent-server.hostl.cloud/docs` does not list these report endpoints. Confirm that the deployed service supports them before relying on permanent report storage; the app surfaces upstream errors and does not fabricate report IDs or diagnoses.

### Emailing a Patient Report

The assessment can collect a patient's name and email for the generated PDF and an explicit "Email me my report" action. These details are not part of the documented analyze request and must not be forwarded to the diagnosis service. The email API sends the generated PDF through the app's SMTP account and does not log or persist the recipient details.

Set these server-only values in `.env.local` (never commit credentials):

```env
SMTP_HOST=
SMTP_PORT=465
SMTP_ENCRYPTION=ssl
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=ENT-Care
```

`SMTP_ENCRYPTION` accepts `ssl`, `tls`, or `starttls`. The email route limits each client to three messages per 15 minutes and accepts PDF attachments up to 5 MB. Configure the same variables in the production host's secret manager.

---

## No User Login Required

There is no authentication system for patients. Users do not create accounts or log in. The experience is:

1. User describes symptoms → gets analysis
2. Gets a **Tracking ID** (e.g. `ENT-2026-A3F9C2D1`)
3. Optionally enters their name and email to personalize and email the PDF report
4. Can retrieve their report any time with just the Tracking ID

---

## Core User Flow — What to Build

```
User opens app
  ↓
Step 1: Symptom input
  → Text field: "Describe what you're feeling"
  → Select: Affected area (Ear / Nose / Throat)
  → Select: How long? (1-3 days / 1 week / 2+ weeks / months)
  → Optional: Age
  → Optional: Share GPS location, with explicit permission
  → Optional: Additional context (affected side, other symptoms, recent illness, conditions, medicines or allergies)
  → Optional: Upload a photo of the affected area

Step 2: Call analyze endpoint
  → POST /api/v1/analyze

Step 3: Show results
  → Urgency badge (Emergency / Urgent / Soon / Routine)
  → Most likely condition (name + plain-language explanation)
  → What to do right now (immediateAction)
  → Red flags (go to A&E if any of these appear)
  → Possible causes
  → "Find a hospital near me" button

Step 4: Save report
  → POST /api/v1/reports
  → Show tracking ID to user: "Your report ID: ENT-2026-XXXXXXXX"
  → "Save your report? Enter email or phone →" (optional)

Step 5: Find nearby hospitals (triggered by button)
  → POST /api/v1/nearby-for-report
  → Show hospital cards with distance + travel times
```

---

## Endpoints — Full Reference

### 1. Analyze Symptoms (Core Endpoint)

```http
POST /api/v1/analyze
X-API-Key: ...
Content-Type: application/json
```

**Request:**
```json
{
  "symptoms": "I have pain in my right ear, some discharge, and can't hear properly. It started 3 days ago.",
  "affectedArea": "ear",
  "duration": "3 days",
  "age": 32,
  "additionalContext": "Had a cold last week",
  "latitude": 6.9123,
  "longitude": 3.6481,
  "includeNearby": false,
  "limit": 5
}
```

**Fields:**
| Field | Type | Required | Notes |
|---|---|---|---|
| `symptoms` | string | Yes | Free text — the patient's own words |
| `affectedArea` | string | No | `"ear"` \| `"nose"` \| `"throat"` \| `"head_neck"` |
| `duration` | string | No | e.g. `"3 days"`, `"2 weeks"` |
| `age` | number | No | Patient age |
| `additionalContext` | string | No | Any extra context |
| `latitude` | number | No | User's GPS coordinates |
| `longitude` | number | No | User's GPS coordinates |
| `includeNearby` | boolean | No | Set `false` here, use `/nearby-for-report` separately |

**Response — key fields to display:**
```json
{
  "status": "success",
  "data": {
    "analysis": {
      "method": "ai_assisted",
      "confidence": "high",
      "primaryCondition": {
        "name": "Acute Otitis Media",
        "commonName": "Middle ear infection",
        "confidence": 100
      },
      "differentials": [...],
      "aiInsights": {
        "specialties": ["ENT", "Paediatric ENT"],
        "services": ["Audiometry"],
        "reasoning": "..."
      },
      "aiStatus": {
        "available": true
      }
    },
    "clinical": {
      "urgencyScore": 6,
      "urgencyLevel": "Soon",
      "urgencyColor": "yellow",
      "referralThreshold": "urgent_week",
      "immediateAction": "Book an appointment with a doctor within the next few days.",
      "patientAdvice": "Give regular pain relief and keep the ear dry...",
      "redFlags": [
        "swelling behind the ear",
        "facial drooping",
        "neck stiffness with headache"
      ],
      "specialists": ["ENT", "Paediatric ENT"],
      "possibleCauses": ["Streptococcus pneumoniae", "respiratory viruses"],
      "complications": ["mastoiditis", "permanent hearing loss"]
    },
    "escalation": {
      "isComplex": false
    }
  }
}
```

**Display mapping:**
| Field | Where to show it |
|---|---|
| `urgencyLevel` + `urgencyColor` | Prominent badge at the top (red/orange/yellow/green) |
| `primaryCondition.commonName` | Main heading: "This may be: Middle ear infection" |
| `clinical.immediateAction` | Action box — what to do right now |
| `clinical.redFlags` | Warning section — "Go to A&E immediately if you experience..." |
| `clinical.patientAdvice` | Full advice paragraph |
| `clinical.specialists` | "You need to see: ENT Specialist" |
| `analysis.aiStatus` | If `available: false`, show: "AI analysis unavailable — results based on medical database" |

**Escalation handling:**
If `escalation.isComplex === true`:
```json
"escalation": {
  "isComplex": true,
  "caseId": "cm...",
  "message": "Your symptoms suggest a condition that may need a specialist's attention...",
  "requiresConsent": true,
  "consentEndpoint": "POST /api/v1/escalation/{id}/consent"
}
```
Show the message and a consent button: "Yes, share with a specialist" / "No thank you"

The assessment form sends every supported `/analyze` input it collects: symptoms, affected area, duration, age, additional context, and GPS coordinates when the patient explicitly shares them. Nearby search is kept separate with `includeNearby: false`; the service request also sets the documented result limit. Do not collect or send unlisted clinical fields without confirming that the service accepts them.

The downloadable patient report is generated from the service response and patient-provided details. It is branded with the institution logo and a watermark, and must clearly state that its possible-condition estimate is not a confirmed diagnosis or a substitute for in-person care.

---

### 2. Analyze an Uploaded Image (Optional)

If the user uploads a photo of their ear/nose/throat:

```http
POST /api/v1/analyze-image
X-API-Key: ...
Content-Type: application/json

{
  "imageBase64": "data:image/jpeg;base64,...",
  "imageType": "ear",
  "additionalContext": "Patient reports 3 days of pain and discharge"
}
```

**Before sending this request, show the user:**
> "Images you upload may be retained for diagnostic quality improvement and specialist review purposes. By submitting, you acknowledge and consent to this usage."

**Response:**
```json
{
  "status": "success",
  "data": {
    "analysis": {
      "findings": ["Redness visible in ear canal", "Possible discharge"],
      "possibleConditions": ["Otitis externa", "Otitis media"],
      "urgencyScore": 5,
      "nextSteps": ["See an ENT specialist within the week"],
      "specialistReviewNeeded": true
    },
    "disclaimer": "This is an AI-assisted preliminary assessment... NOT a clinical diagnosis.",
    "consentNotice": "Images you upload may be retained...",
    "referenceId": "img_...",
    "processedAt": "..."
  }
}
```

Always display `disclaimer` prominently below image analysis results.

---

### 3. Save a Diagnosis Report

Call this immediately after `/analyze` to save the result and get a tracking ID:

```http
POST /api/v1/reports
X-API-Key: ...
Content-Type: application/json

{
  "symptoms": "ear pain, discharge, hearing loss",
  "affectedArea": "ear",
  "duration": "3 days",
  "age": 32,
  "analysisResult": { ...full response from /analyze... },
  "primaryConditionId": "otitis-media-acute",
  "primaryConditionName": "Acute Otitis Media",
  "urgencyScore": 6,
  "urgencyLevel": "Soon",
  "referralThreshold": "urgent_week",
  "latitude": 6.9123,
  "longitude": 3.6481,
  "patientProfileId": null
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "cm...",
    "trackingId": "ENT-2026-A3F9C2D1",
    "createdAt": "2026-11-11T...",
    "message": "Report saved. Use the trackingId to retrieve this report at any time."
  }
}
```

**Always show the tracking ID to the user.** This is their receipt. Suggest they screenshot it or write it down.

---

### 4. Retrieve a Saved Report

When a user enters their tracking ID to look up a previous report:

```http
GET /api/v1/reports/ENT-2026-A3F9C2D1
X-API-Key: ...
```

Returns the full saved report. The tracking ID is case-insensitive.

---

### 5. Find Nearby Hospitals (after analysis)

The "Find a hospital near me" button calls this:

```http
POST /api/v1/nearby-for-report
X-API-Key: ...
Content-Type: application/json

{
  "primaryCondition": "Acute Otitis Media",
  "specialists": ["ENT", "Paediatric ENT"],
  "urgencyScore": 6,
  "requiredServices": ["Audiometry"],
  "latitude": 6.9123,
  "longitude": 3.6481,
  "radiusKm": 50,
  "limit": 5
}
```

Pass the values directly from the `/analyze` response:
- `primaryCondition` ← `analysis.primaryCondition.name`
- `specialists` ← `clinical.specialists`
- `urgencyScore` ← `clinical.urgencyScore`
- `requiredServices` ← `analysis.aiInsights.services`

**Response per facility:**
```json
{
  "id": "cm...",
  "name": "Olabisi Onabanjo University Teaching Hospital (OOUTH)",
  "address": "Hospital Road, Sagamu",
  "city": "Sagamu",
  "state": "Ogun",
  "distanceKm": 7.05,
  "accredited": true,
  "specialties": ["ENT", "Otology", "Rhinology"],
  "matchedSpecialties": ["ENT"],
  "travelTimes": {
    "driving": "12 min",
    "walking": "1h 25m",
    "motorcycle": "8 min"
  }
}
```

**Display as cards:** name, distance, travel times, accreditation badge, matched specialties, directions link (open in Google Maps using lat/lng).

---

### 6. Save Patient Profile (Optional)

If the user wants to save their details for future reports:

```http
POST /api/v1/patient-profile
X-API-Key: ...
Content-Type: application/json

{
  "firstName": "Adaeze",
  "lastName": "Okafor",
  "email": "adaeze@email.com",
  "phone": "+2348012345678",
  "age": 32,
  "knownAllergies": ["Penicillin"],
  "consentToDataRetention": true,
  "consentToContactByEmail": true
}
```

If `consentToDataRetention` is `false` or missing, the profile is **not saved** — the response explains this clearly.

**After getting a profile ID, link it to future reports:**
```json
// In POST /api/v1/reports:
{
  "patientProfileId": "cm..." // from patient-profile response
}
```

---

### 7. Consent for Escalation

If the analysis returns `escalation.isComplex: true`:

```http
POST /api/v1/escalation/{caseId}/consent
X-API-Key: ...
Content-Type: application/json

{
  "consent": true,
  "email": "patient@email.com"
}
```

| `consent` | What happens |
|---|---|
| `true` | Case shared with a specialist, patient will be contacted |
| `false` | Case closed, no specialist review |

---

### 8. Find by Place Name (no GPS)

If the user doesn't share GPS location, let them type their town:

```http
POST /api/v1/nearby
X-API-Key: ...
Content-Type: application/json

{
  "place": "Sagamu, Ogun State, Nigeria",
  "radiusKm": 30,
  "specialty": "ENT",
  "onlyAccredited": true
}
```

---

## Urgency Display Guide

Map `urgencyColor` to your UI:

| `urgencyLevel` | `urgencyColor` | Display |
|---|---|---|
| Emergency | `red` | 🔴 Bold red banner — "Go to A&E immediately" |
| Urgent | `orange` | 🟠 Orange banner — "See a doctor today" |
| Soon | `yellow` | 🟡 Yellow banner — "See a doctor this week" |
| Routine | `green` | 🟢 Green banner — "Book an appointment" |

**For Emergency cases:** disable the "Find nearby hospital" button flow — instead show: "Call 112 or go to your nearest emergency room immediately. Do not wait for an online consultation."

---

## AI Status Handling

Always check `analysis.aiStatus` and show appropriate messaging:

```typescript
if (!data.analysis.aiStatus.available) {
  // Show subtle notice
  showNotice("Results based on medical database — AI analysis temporarily unavailable");
}

if (data.analysis.aiStatus.code === "AI_QUOTA_EXCEEDED") {
  showNotice("Our AI service has reached its daily limit. Results are from our medical database.");
}
```

---

## Image Upload Guidelines

- **Max size:** 4MB per image
- **Formats:** JPEG, PNG
- **Send as:** base64 data URL (`data:image/jpeg;base64,...`)
- **Always show consent notice before upload** (text provided in API response as `consentNotice`)
- **Supported `imageType` values:** `"ear"` | `"nose"` | `"throat"` | `"general"`

---

## Report Tracking ID — UX Guidance

The tracking ID (`ENT-2026-XXXXXXXX`) is the user's key to their report. Design for it:

- Show it in a large, copyable text box after analysis
- "Save this ID to access your report later"
- Provide a "Look up report" page where they enter the ID
- Consider: SMS it to them if they provided a phone number
- Consider: Email it to them if they provided an email

---

## Referral Threshold — What to Tell Users

Map `referralThreshold` to plain language:

| Value | Tell the user |
|---|---|
| `emergency` | Go to emergency room now |
| `urgent_24h` | See a doctor today or tomorrow |
| `urgent_week` | Book with a doctor this week |
| `routine` | Book an ENT appointment at your convenience |
| `gp_only` | Your regular doctor can manage this |

---

## Error Handling

```typescript
const data = await entFetch("/analyze", { method: "POST", body: JSON.stringify(payload) });

if (data.status === "error") {
  switch (data.code) {
    case "AI_QUOTA_EXCEEDED":
      // Show: results from database, AI unavailable
      break;
    case "AI_TIMEOUT":
      // Show: results from database, AI timed out
      break;
    case "REPORT_NOT_FOUND":
      // Show: "No report found with that tracking ID"
      break;
    default:
      // Show: generic error, try again
  }
}
```

---

## What You Don't Need to Build

The ENT Location Service handles all of this — do not duplicate it in your app:

- ❌ Hospital database
- ❌ Distance calculations
- ❌ AI/ML model
- ❌ Specialty matching logic
- ❌ Geocoding (place name → coordinates)
- ❌ Travel time calculations
- ❌ Condition knowledge base

You focus on: **great UX, symptom collection, result display, report tracking.**

---

## Questions & Support

- **API Docs:** `https://ent-server.hostl.cloud/docs`
- **Full docs are at the docs URL** — interactive with live base URL that updates per domain
