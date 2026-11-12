# Diagnosis & Analysis — Desktop App Guide
**For: Hospital & Medical Centre Desktop App Team**
**Requirement: Internet connection required to run diagnosis**

---

## Important: Online-Only Feature

Diagnosis and analysis calls this service's AI engine — it cannot run offline.

Your app must check connectivity before allowing a doctor to run a diagnosis.
If offline, show a clear message:

> **"Diagnosis requires an internet connection. Please connect to run a clinical analysis."**

Do not disable the diagnosis button permanently — just gate it on connectivity status and retry when online.

---

## Who Runs Diagnosis

A **doctor or specialist** runs diagnosis on behalf of a patient during or before a consultation.

The doctor:
- Enters the patient's symptoms (from their own assessment, or from what the patient described)
- Optionally uploads an image of the affected area (ear canal photo, throat photo, etc.)
- Submits to get a structured clinical analysis
- Uses the result to assist with their diagnosis decision — it is **not a replacement** for clinical judgement

---

## Step 1 — Run the Analysis

```http
POST https://ent-server.hostl.cloud/api/v1/analyze
X-API-Key: hu_xxxx...        ← use your hospital user token
Content-Type: application/json
```

**Request body — what the doctor fills in:**

```json
{
  "symptoms": "Patient reports 4 days of right ear pain, reduced hearing, and yellow discharge. Preceded by upper respiratory tract infection. No previous ear surgery.",
  "affectedArea": "ear",
  "duration": "4 days",
  "onsetPattern": "sudden",
  "age": 28,
  "additionalContext": "Patient is on no current medications. No known allergies. Febrile at 38.2°C on presentation.",
  "latitude": 6.849044,
  "longitude": 3.653023,
  "includeNearby": false,
  "limit": 5
}
```

**All fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `symptoms` | string | **Yes** | The clinical description — the richer the better. Write it as a doctor would describe it, or transcribe the patient's own words. |
| `affectedArea` | string | No | `"ear"` \| `"nose"` \| `"throat"` \| `"head_neck"` — narrows the matching. Always send if known. |
| `duration` | string | No | How long symptoms have been present: `"4 days"`, `"3 weeks"`, `"6 months"` |
| `onsetPattern` | string | No | `"sudden"` \| `"gradual"` \| `"episodic"` \| `"chronic"` |
| `age` | number | No | Patient age — affects matching (some conditions are age-specific) |
| `additionalContext` | string | No | Vital signs, relevant history, medications, allergies, previous similar episodes — anything extra. The more you send, the better the AI analysis. |
| `latitude` | number | No | The hospital's coordinates — used to find referral facilities nearby |
| `longitude` | number | No | The hospital's coordinates |
| `includeNearby` | boolean | No | Set `false` during analysis. Use `/nearby-for-report` separately when you need referral options. |

---

## Step 2 — What You Receive

**Full response structure:**

```json
{
  "status": "success",
  "data": {
    "input": {
      "symptoms": "Patient reports 4 days of right ear pain...",
      "affectedArea": "ear",
      "duration": "4 days",
      "age": 28
    },
    "analysis": {
      "method": "ai_assisted",
      "confidence": "high",
      "primaryCondition": {
        "id": "otitis-media-acute",
        "name": "Acute Otitis Media",
        "commonName": "Middle ear infection",
        "category": "ear",
        "confidence": 100,
        "matchedOn": ["ear pain", "fever", "hearing loss", "ear discharge"]
      },
      "differentials": [
        {
          "id": "otitis-externa",
          "name": "Otitis Externa",
          "commonName": "Swimmer's ear",
          "category": "ear",
          "confidence": 65,
          "matchedOn": ["ear pain", "ear discharge"]
        },
        {
          "id": "eustachian-tube-dysfunction",
          "name": "Eustachian Tube Dysfunction",
          "commonName": "Blocked ears",
          "category": "ear",
          "confidence": 50,
          "matchedOn": ["muffled hearing", "blocked ear"]
        }
      ],
      "aiInsights": {
        "specialties": ["ENT", "Otology"],
        "services": ["Otoscopy", "Audiometry", "Tympanometry"],
        "reasoning": "Ear pain with discharge and hearing loss following an URTI points to acute otitis media. ENT and otology are indicated. Audiometry and tympanometry assess degree of conductive hearing loss."
      }
    },
    "clinical": {
      "urgencyScore": 6,
      "urgencyLevel": "Soon",
      "urgencyColor": "yellow",
      "referralThreshold": "urgent_week",
      "immediateAction": "Book an appointment with a doctor within the next few days.",
      "patientAdvice": "Prescribe analgesia. Keep the ear dry. Review in 72 hours if no improvement. Refer to ENT if no response to antibiotics.",
      "redFlags": [
        "swelling behind the ear (mastoiditis)",
        "facial drooping or asymmetry",
        "neck stiffness with headache",
        "sudden complete hearing loss",
        "high fever unresponsive to antipyretics"
      ],
      "specialists": ["ENT", "Paediatric ENT"],
      "investigations": [
        "otoscopy",
        "pneumatic otoscopy",
        "tympanometry",
        "audiometry if recurrent"
      ],
      "possibleCauses": [
        "Streptococcus pneumoniae",
        "Haemophilus influenzae",
        "respiratory viruses",
        "Eustachian tube dysfunction",
        "upper respiratory infection"
      ],
      "complications": [
        "mastoiditis",
        "meningitis",
        "permanent hearing loss",
        "tympanic membrane perforation"
      ]
    },
    "nearbyFacilities": null,
    "locationNote": null,
    "aiStatus": {
      "available": true
    },
    "escalation": {
      "isComplex": false
    }
  }
}
```

---

## Step 3 — Display in the Doctor's Consultation Workspace

Map the response to your clinical UI:

### Primary condition panel
```
Most likely: Acute Otitis Media (Middle ear infection)
Confidence: HIGH  |  Category: Ear  |  Urgency: Soon (6/10)
Matched on: ear pain · fever · hearing loss · ear discharge
```

### Differential diagnoses (show as a ranked list)
```
Differentials:
1. Otitis Externa          — 65% match
2. Eustachian Tube Dysfunction — 50% match
```

### AI reasoning (show as a clinical note)
```
AI Reasoning:
"Ear pain with discharge and hearing loss following an URTI points to
acute otitis media. ENT and otology are indicated..."
```

### Recommended investigations
```
Investigations to consider:
• Otoscopy
• Pneumatic otoscopy
• Tympanometry
• Audiometry (if recurrent)
```

### Possible causes
```
Likely causative organisms / factors:
• Streptococcus pneumoniae
• Haemophilus influenzae
• Respiratory viruses
• Eustachian tube dysfunction
```

### Red flags — show prominently
```
⚠ Refer immediately to emergency if any of these present:
• Swelling behind the ear (mastoiditis)
• Facial drooping or asymmetry
• Neck stiffness with headache
• Sudden complete hearing loss
• High fever unresponsive to antipyretics
```

### Potential complications
```
Complications if untreated:
• Mastoiditis · Meningitis · Permanent hearing loss · Tympanic membrane perforation
```

---

## Step 4 — Save the Report

After running the diagnosis, always save it so it's traceable:

```http
POST https://ent-server.hostl.cloud/api/v1/reports
X-API-Key: hu_xxxx...
Content-Type: application/json

{
  "symptoms": "Patient reports 4 days of right ear pain...",
  "affectedArea": "ear",
  "duration": "4 days",
  "age": 28,
  "additionalContext": "Febrile at 38.2°C...",
  "analysisResult": { ...full data object from /analyze response... },
  "primaryConditionId": "otitis-media-acute",
  "primaryConditionName": "Acute Otitis Media",
  "urgencyScore": 6,
  "urgencyLevel": "Soon",
  "referralThreshold": "urgent_week",
  "latitude": 6.849044,
  "longitude": 3.653023,
  "patientProfileId": null
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "trackingId": "ENT-2026-A3F9C2D1",
    "createdAt": "2026-11-11T14:30:00.000Z",
    "message": "Report saved."
  }
}
```

**Save the `trackingId` to the patient's local SQLite record.** This links the consultation to the analysis report. The patient can also use it to retrieve their report later.

---

## Step 5 — Get Referral Options (when needed)

When the doctor decides to refer the patient, call this to show nearby facilities:

```http
POST https://ent-server.hostl.cloud/api/v1/nearby-for-report
X-API-Key: hu_xxxx...
Content-Type: application/json

{
  "primaryCondition": "Acute Otitis Media",
  "specialists": ["ENT", "Otology"],
  "urgencyScore": 6,
  "requiredServices": ["Audiometry", "Tympanometry"],
  "latitude": 6.849044,
  "longitude": 3.653023,
  "radiusKm": 50,
  "limit": 8,
  "onlyAccredited": true
}
```

Pull the values directly from the analysis result:
- `primaryCondition` ← `analysis.primaryCondition.name`
- `specialists` ← `analysis.aiInsights.specialties`
- `urgencyScore` ← `clinical.urgencyScore`
- `requiredServices` ← `analysis.aiInsights.services`

**Each facility in the response:**
```json
{
  "id": "cm...",
  "name": "Federal Medical Centre (FMC) Abeokuta",
  "address": "Olabisi Onabanjo Way, Idi-Aba, Abeokuta",
  "city": "Abeokuta",
  "state": "Ogun",
  "distanceKm": 39.2,
  "accredited": true,
  "specialties": ["ENT", "Otology", "Rhinology", "Laryngology"],
  "matchedSpecialties": ["ENT"],
  "travelTimes": {
    "driving": "47 min",
    "walking": "7h 50m",
    "motorcycle": "31 min"
  },
  "relevanceScore": 41
}
```

The `query.sortNote` field tells you how results were ranked:
- **Emergency (9–10):** closest first
- **Urgent (7–8):** distance + specialty match
- **Soon / Routine (1–6):** best specialty match first

---

## Step 6 — Analyze an Image (Optional)

If the doctor has a clinical image (otoscope photo, throat photo), it can be sent for AI-assisted analysis:

```http
POST https://ent-server.hostl.cloud/api/v1/analyze-image
X-API-Key: hu_xxxx...
Content-Type: application/json

{
  "imageBase64": "data:image/jpeg;base64,...",
  "imageType": "ear",
  "additionalContext": "Patient presents with 4 days of ear pain and discharge. Febrile."
}
```

| `imageType` | Use for |
|---|---|
| `"ear"` | Otoscope images, ear canal photos |
| `"nose"` | Nasal cavity, nasal endoscopy images |
| `"throat"` | Oropharynx, tonsillar images |
| `"general"` | Any other ENT-related image |

**Response:**
```json
{
  "status": "success",
  "data": {
    "imageType": "ear",
    "analysis": {
      "findings": [
        "Erythematous and bulging tympanic membrane",
        "Loss of normal light reflex",
        "Possible middle ear effusion"
      ],
      "possibleConditions": [
        "Acute Otitis Media",
        "Otitis Media with Effusion"
      ],
      "urgencyScore": 6,
      "nextSteps": [
        "Confirm with pneumatic otoscopy",
        "Consider audiometry",
        "Initiate antibiotic therapy if AOM confirmed"
      ],
      "specialistReviewNeeded": false
    },
    "disclaimer": "This is an AI-assisted preliminary assessment based on the uploaded image. It is NOT a clinical diagnosis and should not replace professional medical evaluation.",
    "consentNotice": "Images you upload may be retained for diagnostic quality improvement and specialist review purposes...",
    "referenceId": "img_a1b2c3d4",
    "processedAt": "2026-11-11T14:30:00.000Z"
  }
}
```

**Always display `disclaimer` in your UI** next to any image analysis result.
The image is automatically stored in the ENT-Care secure storage and linked to the `referenceId`.

---

## Escalation — Complex Cases

If the analysis flags a case as complex, it is automatically saved as an escalated case:

```json
"escalation": {
  "isComplex": true,
  "caseId": "cm...",
  "message": "Your symptoms suggest a condition that may need a specialist's attention...",
  "requiresConsent": true,
  "consentEndpoint": "POST /api/v1/escalation/{id}/consent"
}
```

**When `isComplex: true`, trigger specialist review:**

```http
POST https://ent-server.hostl.cloud/api/v1/escalation/{caseId}/consent
X-API-Key: hu_xxxx...
Content-Type: application/json

{
  "consent": true,
  "email": "patient-contact@email.com"
}
```

The case enters the ENT-Care specialist review queue. As a hospital doctor, you can also view and respond to escalated cases assigned to your facility:

```http
GET https://ent-server.hostl.cloud/api/admin/escalated-cases?status=pending
X-API-Key: hu_xxxx...
```

```http
PATCH https://ent-server.hostl.cloud/api/admin/escalated-cases/{id}
X-API-Key: hu_xxxx...
Content-Type: application/json

{
  "specialistNotes": "Patient reviewed. AOM confirmed. Prescribed amoxicillin 500mg TDS x 7 days. Follow-up in 1 week.",
  "status": "responded"
}
```

---

## When AI is Unavailable

The service always returns a result — even when AI is unavailable. Check `aiStatus`:

```json
"aiStatus": {
  "available": false,
  "code": "AI_QUOTA_EXCEEDED",
  "message": "Our AI analysis service has reached its daily limit. Results are based on our medical database."
}
```

| `code` | What to show the doctor |
|---|---|
| `AI_QUOTA_EXCEEDED` | "AI analysis unavailable — results from medical database" |
| `AI_TIMEOUT` | "AI analysis timed out — results from medical database" |
| `AI_UNAVAILABLE` | "AI analysis temporarily unavailable" |
| `AI_ERROR` | "AI analysis encountered an error" |

The clinical result (`urgencyScore`, `redFlags`, `investigations`, etc.) is still populated from the 150-condition local database — it is never empty.

---

## Analysis Method Reference

The `analysis.method` field tells you how the result was generated:

| Method | Meaning |
|---|---|
| `dataset_match` | Matched against local 150-condition database — no AI used |
| `ai_assisted` | Dataset match + AI specialty extraction |
| `ai_full_analysis` | Low dataset confidence — full Gemini clinical analysis used |
| `ai_only` | No dataset match — AI analysis only |
| `fallback` | Neither dataset nor AI matched well — result is best-effort |

For `fallback` results, consider flagging in the UI: "Low confidence — clinical review strongly recommended."

---

## Complete Request-to-Result Flow (Summary)

```
Doctor opens patient consultation
  ↓
[ONLINE CHECK] — if offline, show "Diagnosis requires internet"
  ↓
Doctor fills in: symptoms, affected area, duration, age, context
Optionally: uploads otoscope/clinical image
  ↓
  ① POST /api/v1/analyze-image (if image uploaded)
     ← findings, possible conditions, urgencyScore
  ↓
  ② POST /api/v1/analyze
     ← primaryCondition, differentials, clinical, aiInsights, escalation
  ↓
Display results in consultation workspace
  ↓
  ③ POST /api/v1/reports (save + get trackingId)
     Save trackingId to patient's local SQLite record
  ↓
Doctor makes clinical decision
  ↓
If referral needed:
  ④ POST /api/v1/nearby-for-report
     ← ranked referral facilities
  Doctor selects facility
  Generate referral document locally
  ↓
If complex case (escalation.isComplex: true):
  ⑤ POST /api/v1/escalation/{id}/consent
     ← specialist review queued
```

---

## Key Rules

1. **Diagnosis requires internet.** Gate it on connectivity. Never call `/analyze` offline — it will fail.
2. **Always save the report.** Call `/reports` immediately after every analysis. The `trackingId` is the audit trail.
3. **AI assists, doctors decide.** Display results as "suggested findings" — never as a confirmed diagnosis.
4. **Always show the disclaimer** next to AI-generated content, especially image analysis.
5. **Escalation is automatic.** You don't need to trigger it — the service does it. You just handle the consent UI.
6. **The `hu_` token is your API key.** Use it as `X-API-Key` on all calls. No separate API key needed.

---

## Error Reference

| HTTP | Situation | What to show |
|---|---|---|
| 400 | Missing `symptoms` field | "Please enter the patient's symptoms before running analysis" |
| 401 | Token invalid or expired | Force online re-login via `/api/v1/hospital-auth` |
| 403 | Account disabled | "This account has been disabled. Contact ENT-Care support." |
| 413 | Image too large (>4MB) | "Image too large. Maximum size is 4MB." |
| 500 | Server error | "Analysis service temporarily unavailable. Please try again." |

---

## Questions & Support

- **API Docs:** `https://ent-server.hostl.cloud/docs`
- **Admin panel:** `https://ent-server.hostl.cloud/admin`
