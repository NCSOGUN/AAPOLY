# ENT-Care Desktop Application — Integration Guide
**For: Hospital & Medical Centre Desktop App Team**
**Service: ENT Location Intelligence Service**
**Last Updated: November 2026**

---

## Overview

You are building the **Hospital / Medical Centre Desktop Application** — the tool used by doctors, specialists, and hospital staff to manage patient referrals, review escalated cases, update facility information, and interact with the ENT-Care platform.

Your app does **not** manage its own hospital data, location logic, or patient matching. All of that lives in this central service. Your job is to consume it cleanly.

---

## Service URLs

| Environment | URL |
|---|---|
| **Production (Primary)** | `https://ent-server.hostl.cloud` |
| **Production (Vercel)** | `https://ent-location-sys.vercel.app` |
| **API Docs** | `https://ent-server.hostl.cloud/docs` |
| **Admin Panel** | `https://ent-server.hostl.cloud/admin` |

Use `ent-server.hostl.cloud` as your primary base URL.

---

## Your API Key (Development)

```
X-API-Key: ent_f7d9f9487aaabd5e0fbfb54c06b8b6100fc2820eb2e8b79d
```

Include this header on **every request**. Store it in your app's environment config — never hard-code it in source files.

```typescript
// config.ts
export const API_BASE_URL = "https://ent-server.hostl.cloud/api/v1";
export const API_KEY = process.env.ENT_API_KEY; // load from env
```

---

## Authentication — How the Desktop App Logs In

This is critical. The desktop app uses a **two-layer authentication** system:

### Layer 1 — First-time online setup
When a hospital account is created by the ENT-Care admin, they receive:
- An **email** and **password** for the hospital user
- A **long-lived access token** (starts with `hu_`)

On first launch (requires internet):
```http
POST https://ent-server.hostl.cloud/api/v1/hospital-auth
Content-Type: application/json

{
  "email": "dr.adeyemi@oouth.ng",
  "password": "their-password"
}
```

**Success response:**
```json
{
  "status": "success",
  "data": {
    "token": "hu_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "user": {
      "id": "cm...",
      "name": "Dr. Adeyemi Oluwafemi",
      "email": "dr.adeyemi@oouth.ng",
      "role": "doctor",
      "specialization": "Otologist",
      "facilityId": "cm...",
      "facility": {
        "id": "cm...",
        "name": "Olabisi Onabanjo University Teaching Hospital (OOUTH)",
        "city": "Sagamu",
        "state": "Ogun",
        "latitude": 6.849044,
        "longitude": 3.653023,
        "accredited": true,
        "specialties": ["ENT", "Otology", "Rhinology", "Laryngology"]
      }
    },
    "tokenIssuedAt": "2026-11-11T00:00:00.000Z",
    "instructions": "Store this token securely. Use as X-API-Key header on all subsequent API calls."
  }
}
```

**Save to local SQLite:**
- The `token` (use as `X-API-Key` from now on)
- The full `user` object
- The full `facility` object (for offline use)

### Layer 2 — All subsequent calls (online or offline)
Once you have the token, use it as your API key:
```http
X-API-Key: hu_xxxxxxxxxxxx...
```

This token works for all `/api/v1/*` endpoints — no separate API key needed.

### Token verification (periodic online check)
When the app comes online after offline use:
```http
GET https://ent-server.hostl.cloud/api/v1/hospital-auth/verify
X-Hospital-Token: hu_xxxxxxxxxxxx...
```

Returns the user + facility data fresh from the server. Use this to refresh your local SQLite cache.

### Error responses
| Code | Meaning |
|---|---|
| `INVALID_CREDENTIALS` | Wrong email or password |
| `ACCOUNT_DISABLED` | Account has been disabled by admin — contact ENT-Care support |

---

## Offline-First Architecture

Your app must work offline after the first successful login. Here is the recommended approach:

```
First launch (online required):
  POST /api/v1/hospital-auth → save token + user + facility to SQLite

Daily use:
  - Read patient referrals from local SQLite
  - Queue any outgoing updates (referral status changes, notes)
  - Run fully offline

When internet is available:
  GET /api/v1/hospital-auth/verify → confirm token still active
  Sync: push queued updates, pull new escalated cases
  Cache refresh: facility data, specialties list

If token is rejected (account disabled):
  Show clear message, prevent further use until admin re-enables
```

---

## Endpoints Your App Will Use

### 1. Get your facility details
```http
GET /api/v1/facilities/{facilityId}
X-API-Key: hu_xxxx...
```

Returns the full facility record including specialties, services, operating hours.

---

### 2. Find nearby hospitals (for referrals)
When a doctor wants to refer a patient, show them nearby facilities that can handle the case:

```http
POST /api/v1/nearby-for-report
X-API-Key: hu_xxxx...
Content-Type: application/json

{
  "primaryCondition": "Acute Otitis Media",
  "specialists": ["ENT", "Paediatric ENT"],
  "urgencyScore": 6,
  "requiredServices": ["Audiometry"],
  "latitude": 6.849044,
  "longitude": 3.653023,
  "radiusKm": 50,
  "limit": 8
}
```

This powers the **"Find Referral Hospital"** button in your UI.

**Response includes:**
- `facilities[]` — ranked list by urgency-aware scoring
- Each facility: name, address, distance, travel times, specialties, accreditation status
- `query.sortNote` — explains why results are ranked the way they are

---

### 3. Find nearby hospitals (simple, by coordinates)
For a basic map view of nearby facilities:

```http
POST /api/v1/nearby
X-API-Key: hu_xxxx...
Content-Type: application/json

{
  "latitude": 6.849044,
  "longitude": 3.653023,
  "radiusKm": 50,
  "specialty": "ENT",
  "onlyAccredited": true,
  "limit": 10
}
```

---

### 4. Fetch a patient's diagnosis report
When a patient arrives with a tracking ID (e.g. `ENT-2026-A3F9C2D1`):

```http
GET /api/v1/reports/ENT-2026-A3F9C2D1
X-API-Key: hu_xxxx...
```

Returns the full analysis report the patient received, including:
- Symptoms they reported
- Primary condition identified
- Urgency level
- AI analysis details
- Nearby facilities shown to the patient at the time

This gives the doctor context before the consultation.

---

### 5. View escalated cases assigned to your facility
Patients whose cases were automatically flagged as complex are saved as escalated cases. Doctors can review and respond:

```http
GET /api/admin/escalated-cases?status=pending
X-API-Key: hu_xxxx...
```

**Note:** This is an admin-protected route. Hospital staff with `role: "admin"` can access it. Doctors use their `hu_` token which grants access.

**Update a case with specialist notes:**
```http
PATCH /api/admin/escalated-cases/{id}
X-API-Key: hu_xxxx...
Content-Type: application/json

{
  "specialistNotes": "Patient should come in for audiometry. Likely AOM. Prescribed amoxicillin.",
  "status": "responded"
}
```

---

## Data Your App Owns Locally (SQLite)

You manage this data locally on the hospital's machine:

| Table | What it stores |
|---|---|
| `auth_session` | token, user, facility (from hospital-auth) |
| `referrals` | outgoing referrals created by doctors |
| `patient_visits` | local patient visit records |
| `sync_queue` | pending updates to push when online |
| `cached_facilities` | nearby facilities list (refresh weekly) |

The ENT Location Service owns: facility registry, specialties, accreditation status, diagnosis conditions, escalated cases, patient profiles.

---

## Referral Flow — What to Build

Based on the PRD, here is the complete referral flow your app must support:

```
Doctor opens patient record
  ↓
Doctor clicks "Create Referral"
  ↓
App calls POST /api/v1/nearby-for-report
  → pass: primaryCondition, specialists needed, urgencyScore, doctor's coordinates
  ← receive: ranked list of referral hospitals
  ↓
Doctor selects target facility
  ↓
App generates referral document (locally)
  → patient name, condition, reason, referring doctor, target facility
  ↓
Save to local SQLite (status: "draft" → "submitted")
  ↓
When online: sync to backend (your own backend, not this service)
  ↓
Patient receives referral + hospital location
```

---

## Specialties Reference

Use these exact names when calling any specialty filter:

```
ENT · Otology · Rhinology · Laryngology · Head and Neck Surgery
Audiology · Paediatric ENT · General Surgery · Paediatrics
Obstetrics & Gynaecology · Internal Medicine · Orthopaedics
Ophthalmology · Radiology · Psychiatry · Cardiology · Nephrology
```

---

## Error Handling

All errors follow this shape:
```json
{
  "status": "error",
  "code": "ERROR_CODE",
  "message": "Human-readable description"
}
```

| HTTP | Code | Action |
|---|---|---|
| 401 | `INVALID_CREDENTIALS` | Show login error |
| 401 | (no code) | Token invalid — force re-login online |
| 403 | `ACCOUNT_DISABLED` | Show "account disabled" screen |
| 404 | `REPORT_NOT_FOUND` | Show "no report found for this tracking ID" |
| 503 | `API_KEY_STORE_UNAVAILABLE` | Service temporarily down — retry |
| 500 | — | Unexpected error — log and show generic message |

---

## Questions & Support

- **API Docs (interactive):** `https://ent-server.hostl.cloud/docs`
- **Admin panel (account management):** `https://ent-server.hostl.cloud/admin`
- For new hospital user accounts or token resets → contact the ENT-Care platform admin
