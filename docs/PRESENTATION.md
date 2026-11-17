# ENT-Care AI Platform
## Project Presentation Document

**Institution:** Abraham Adesanya Polytechnic (AAPOLY)
**Project:** ENT-Care AI — Ear, Nose and Throat Healthcare Intelligence Platform
**Date:** November 2026
**Status:** Server complete. Apps in development.

---

## The Problem

### ENT Healthcare in Nigeria Is Broken

Ear, nose and throat conditions are among the most common reasons Nigerians visit a hospital.
Ear infections are the leading cause of preventable hearing loss in children under five.
Chronic sinusitis, throat infections, and tonsil disease affect millions of adults every year.

Yet the system fails patients at every step.

**1. People do not know what is wrong with them.**
A child cries from ear pain for three days. The parent does not know if this is an infection, a blocked ear, or something that requires emergency care. Without guidance, they wait — sometimes until the condition becomes serious.

**2. People go to the wrong place first.**
A patient with suspected nasal polyps visits a general practitioner, gets a misdiagnosis, tries patent medicine, wastes two weeks, and finally reaches an ENT specialist weeks later when the condition has worsened.

**3. ENT specialists are concentrated in major cities.**
The majority of ENT consultants in Nigeria practice in Lagos, Abuja, and Ibadan. A patient in Sagamu, Abeokuta, or Ota often does not know which hospital near them has an ENT department, let alone a rhinologist or audiologist.

**4. Hospital data is scattered and unreliable.**
When a doctor in a secondary hospital wants to refer a patient to a specialist facility, there is no reliable source of truth. Which hospitals within 40km have an ENT unit? Which are accredited? Which have an audiometry suite? This information lives in phone books, word of mouth, and outdated directories.

**5. Medical records are fragmented.**
A patient sees one doctor, then another, then a specialist. Each has incomplete information. The patient carries a folder of papers between appointments, loses documents, and starts over at every new provider. There is no portable, accessible record of their ENT history.

**6. Self-medication is dangerous.**
Lacking guidance, patients buy antibiotics over the counter, use olive oil for ear pain, ignore warning signs, and delay presentation until conditions are advanced. Unsafe self-treatment is the default because there is no accessible alternative.

---

## The Scale of the Problem

- Nigeria has approximately 220 million people.
- The country has fewer than 400 registered ENT surgeons.
- That is roughly 1 ENT specialist per 550,000 people.
- The WHO recommends 1 specialist per 50,000 people.
- Nigeria is operating at approximately 9% of the recommended specialist capacity.
- Over 60% of all disability-adjusted life years lost to ear conditions in Africa are preventable.
- Hearing loss is the most common disability in Nigerian children — the majority caused by untreated ear infections.

The problem is not the absence of hospitals. It is the absence of intelligent guidance that connects patients to the right care at the right time.

---

## What We Built

ENT-Care AI is a three-part platform that solves this problem end to end.

```
┌──────────────────────────────────────────────────────────────────┐
│                     ENT-CARE AI PLATFORM                         │
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  Patient Web App │    │  Hospital Desktop│                   │
│  │  (PWA)           │    │  Application     │                   │
│  │                  │    │                  │                   │
│  │  Any patient     │    │  Doctors,        │                   │
│  │  Any device      │    │  Specialists,    │                   │
│  │  No login        │    │  Hospital Staff  │                   │
│  └────────┬─────────┘    └────────┬─────────┘                   │
│           │                       │                              │
│           └───────────┬───────────┘                              │
│                       │                                          │
│                       ▼                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          Location Intelligence Service                    │   │
│  │          (The Central Brain)                              │   │
│  │                                                           │   │
│  │  Hospital Registry · Accreditation · Specialties         │   │
│  │  AI Diagnosis Engine · Condition Database (150 ENT)      │   │
│  │  Geospatial Matching · Report Tracking · Image Analysis  │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Part 1 — Location Intelligence Service (Built)

A standalone API service that is the single source of truth for:
- Every accredited ENT hospital and clinic in the registry
- Their exact coordinates, specialties, services, and accreditation status
- Intelligent matching of patients to the right hospital based on diagnosis
- Distance and travel time calculation (driving, walking, motorcycle)
- AI-powered symptom analysis using a 150-condition ENT knowledge base
- Report generation with permanent tracking IDs
- Specialist escalation for complex cases
- Clinical image analysis using Gemini AI vision

**This service was built first because every other part of the platform depends on it.**
Both the patient app and the hospital desktop app call this service.
No app duplicates the logic. The data is consistent everywhere.

### Part 2 — Patient Web App (In Development)

A mobile-first progressive web application that any patient can open in a browser — no download, no login, no account.

The patient describes their symptoms. The app tells them what it might be, how urgent it is, what to do right now, and shows them the nearest hospitals that can help — on a map, with distances and travel times.

### Part 3 — Hospital Desktop Application (In Development)

A desktop application for hospital staff, doctors, and specialists. It runs offline using a local database (SQLite). When connected, it syncs with the central service, verifies doctor credentials, pulls in referral hospital data, and allows doctors to run AI-assisted clinical analyses for patients in their care.

---

## How It Was Built

### Development Approach

The project was built mobile-first, API-first, and offline-aware from day one. Every technical decision was made to solve a specific real-world constraint.

### Technology Stack

| Layer | Technology | Why This Choice |
|---|---|---|
| **Framework** | Next.js 15 (App Router) | Single codebase for API + Admin GUI. Vercel deployment requires zero infrastructure management. |
| **Language** | TypeScript | Type safety catches errors before deployment. Critical in a healthcare context where data shape errors matter. |
| **Database** | Neon PostgreSQL (serverless) | Free tier sufficient for MVP. Prisma-compatible. Runs in a serverless environment without connection pooling issues. |
| **ORM** | Prisma | Fastest path from schema to working database queries. Auto-generates TypeScript types from the schema. |
| **AI Engine** | Google Gemini (gemini-flash-latest) | Fast, generous free tier, strong clinical text understanding, supports image analysis (vision). |
| **Fallback Knowledge** | 150-condition ENT database (custom) | When AI is unavailable or quota exceeded, the system still works. Built from a carefully authored dataset covering every common ENT condition. |
| **Geocoding** | Nominatim (OpenStreetMap) | Free, no API key, works for Nigeria. Used to convert town/LGA names to coordinates. |
| **Routing** | OSRM (open source) | Free travel time estimation for driving, walking, motorcycle — the three most common transport modes in Nigeria. |
| **Distance** | Haversine formula | Runs in-database without PostGIS. Fast, reliable, accurate for the distances involved. |
| **Image Storage** | iDrive E2 (S3-compatible) | Free tier, S3 API, stores clinical images uploaded by patients and doctors. |
| **Authentication** | NextAuth.js v5 | Session management for the admin panel. Hospital users use long-lived tokens (not sessions) for the desktop app. |
| **Hosting** | Vercel | Zero-config deployment. Edge network. Free tier handles early traffic. Auto-deploys from GitHub. |
| **Admin UI** | Tailwind CSS + shadcn/ui | Google-style minimal design. Fast to build. No unnecessary visual complexity. |

### Database Schema — What Was Modelled

The database captures the full complexity of the ENT healthcare ecosystem:

```
Facility          — Every hospital, clinic, diagnostic centre
Specialty         — ENT, Otology, Rhinology, Laryngology, Audiology, etc.
FacilitySpecialty — Many-to-many: which hospitals offer which specialties
FacilityService   — Specific equipment: Audiometry, Nasal Endoscopy, CT, MRI
Condition         — 150 ENT conditions, each with symptoms, causes, red flags,
                    urgency scores, treatment options, Nigeria-specific context
DiagnosisReport   — Every analysis saved with a tracking ID
PatientProfile    — Optional patient details (consent-gated)
EscalatedCase     — Complex cases flagged for specialist review
HospitalUser      — Doctor and specialist accounts for the desktop app
ApiKey            — API keys for external system access
AdminUser         — Admin panel accounts
```

### The AI System — Two Layers

The diagnosis engine uses two layers, so it always returns a result even when AI is unavailable.

**Layer 1 — Local condition database (always available)**
When a patient submits symptoms, the system first scores their input against 150 ENT conditions using keyword and symptom matching. This is fast (milliseconds), costs nothing, and works with no internet on the analysis server.

**Layer 2 — Gemini AI (when available)**
If the local match confidence is high, Gemini extracts specialties and services from the clinical text — it understands "rhinology review and possible nasal endoscopy" and maps it to the right specialist types.
If local confidence is low, Gemini performs a full clinical analysis — it reads the symptoms like a clinician and returns a structured assessment.

**If Gemini fails (quota exceeded, timeout, unavailable):**
The system still returns a result from Layer 1. The patient receives a clear, honest message: "AI analysis is temporarily unavailable — results are based on our medical database." Nothing breaks. The user is never left with an empty screen.

### Image Analysis

Patients and doctors can upload a photograph of the affected area — an ear canal, the throat, nasal passages. The image is sent to Gemini's vision model, which returns:
- Visible findings (redness, discharge, swelling)
- Possible conditions suggested by the image
- Urgency score
- Recommended next steps
- Whether specialist review is needed

Every image is stored encrypted in iDrive E2 cloud storage. A consent notice is shown before every upload. Patients can request deletion.

### The Tracking ID System

Every diagnosis generates a permanent tracking ID in the format `ENT-2026-A3F9C2D1`.

This solves a real problem: patients in Nigeria frequently see multiple providers, often in different cities or states. The tracking ID is their portable medical record for that complaint. They can:
- Show it to any doctor: "Look up my ENT report from last month"
- Access it on any device, years later
- Share it via WhatsApp, SMS, or verbally

No login. No account. The ID itself is the access key.

### The Escalation System

When a case is complex — high urgency score, ambiguous diagnosis, detailed clinical history — the system automatically saves it as an escalated case and asks the patient for consent to share it with a specialist.

The message never uses words like "critical" or "serious" to avoid causing unnecessary alarm. Instead: *"Your symptoms suggest a condition that may benefit from a specialist's attention."*

If the patient consents, the case enters a specialist review queue. Hospital staff can view and respond to these cases through the admin panel.

### Offline-First Hospital Desktop App

The hospital desktop application was designed for the reality of Nigerian network conditions. After the first online login, all core functionality works without internet using a local SQLite database.

The online-first operations (diagnosis, referral search, escalation) are clearly marked. When offline, the app shows which features are available and which require connectivity — no silent failures.

---

## Features Delivered

### Admin Panel (ent-server.hostl.cloud/admin)

| Feature | Description |
|---|---|
| Dashboard | Total facilities, accredited count, specialties, active services |
| Facility Management | Add, edit, delete hospitals. Set coordinates, specialties, services, operating hours, accreditation status |
| Quick Accreditation Toggle | Click to accredit or de-accredit a hospital from the list view |
| Specialties Management | Add, edit ENT specialties and subspecialties |
| API Key Management | Generate, revoke, and monitor keys for external systems. Last-used timestamp visible |
| Hospital User Accounts | Create doctor/specialist accounts with long-lived tokens for the desktop app |
| Escalated Cases | View complex patient cases, add specialist notes, update status |

### Public API (/api/v1/*)

| Endpoint | What It Does |
|---|---|
| POST /analyze | Submit symptoms → receive full clinical analysis |
| POST /analyze-image | Upload a clinical photo → AI image analysis |
| POST /nearby-for-report | From an analysis result → find matched hospitals |
| POST /nearby | Coordinates or place name → nearest hospitals |
| GET /facilities/:id | Full facility record |
| POST /reports | Save a diagnosis report, receive tracking ID |
| GET /reports/:trackingId | Retrieve a saved report |
| POST /patient-profile | Save optional patient profile (consent-gated) |
| GET /patient-profile | Look up profile by email or phone |
| POST /escalation/:id/consent | Patient consents to specialist review |
| POST /hospital-auth | Doctor/specialist login for desktop app |
| GET /hospital-auth/verify | Token verification after offline period |

### Knowledge Base

- 150 ENT conditions fully documented
- Each condition includes: symptoms (primary, secondary, rare), affected areas, onset pattern, typical duration, age groups, risk factors, causes, red flags, diagnostic clues, differential diagnoses, investigations, treatment options, referral threshold, urgency score (1–10), patient advice, prevention tips, complications, related conditions, keywords for plain-language matching
- Nigeria-specific context on every condition: local prevalence, harmattan and environmental factors, access considerations, patent medicine vendor culture

### Hospital Registry

- 17 facilities seeded (Ogun State — real hospitals with verified coordinates)
- 17 medical specialties defined
- Accreditation status tracked with dates
- Services and equipment catalogued per facility
- Operating hours stored
- Ready for national expansion

---

## Problems Solved — Summary

| Problem | Solution |
|---|---|
| Patient does not know what is wrong | AI symptom analysis in plain language |
| Patient does not know how urgent it is | Urgency score 1–10 with clear plain-language guidance |
| Patient goes to the wrong hospital | Specialty-matched hospital finder with accreditation filter |
| Patient does not know how far hospitals are | Real distance + travel time (car, walking, motorcycle) |
| Patient forgets their medical history | Permanent tracking ID — no login needed |
| Doctor cannot find a suitable referral | Urgency-aware referral finder with specialty matching |
| Hospital data is scattered and outdated | Central accredited registry — single source of truth |
| AI fails or quota runs out | 150-condition local database always available as fallback |
| Complex cases need specialist attention | Automatic escalation with patient consent system |
| Desktop app unusable on poor networks | Offline-first with SQLite, online-only clearly marked |
| Clinical images need analysis | Gemini vision API with encrypted storage and consent system |
| Multiple apps maintain different hospital lists | One service, one source of truth — all apps call the same API |

---

## Architecture Principles

**1. One source of truth.**
Hospital data, specialties, accreditation, and matching logic live in exactly one place. No app duplicates it. If a hospital gets accredited or de-accredited, every app reflects it immediately.

**2. Graceful degradation.**
The system is designed to never leave a user with nothing. If AI fails, the database answers. If the network is unavailable, the local cache answers. Every failure mode has a handled response.

**3. No lock-in.**
Every component uses open standards. Nominatim instead of Google Maps. OSRM instead of paid routing services. iDrive E2 (S3-compatible) for storage. If any service changes pricing or availability, it can be replaced without rewriting the application.

**4. Consent at every data boundary.**
Patient profile data is never saved without explicit consent. Images are not uploaded without a visible consent notice. Escalation never happens without patient approval. These are not optional — they are built into the API contracts.

**5. Designed for Nigeria.**
Travel times include motorcycle (okada) — the most common form of medical transport in many areas. Geocoding works for LGA and town names. The condition database includes Nigeria-specific prevalence data, harmattan-related conditions, and notes on local access constraints. The urgency system accounts for limited emergency infrastructure.

---

## Development Timeline

| Phase | What Was Built |
|---|---|
| **Phase 1** | Project scaffold — Next.js, Prisma, Neon DB, Tailwind, NextAuth |
| **Phase 2** | Core database schema — Facility, Specialty, FacilityService, AdminUser |
| **Phase 3** | Public API — /nearby, /match-by-diagnosis, /facilities/:id |
| **Phase 4** | Admin GUI — dashboard, facility management, specialties management |
| **Phase 5** | Seed data — 17 Ogun State facilities, 17 specialties, real coordinates |
| **Phase 6** | AI integration — Gemini API for diagnosis matching |
| **Phase 7** | 150-condition ENT database — imported and indexed |
| **Phase 8** | /analyze endpoint — dataset + AI two-layer diagnosis engine |
| **Phase 9** | Escalation system — complex case detection, specialist review queue |
| **Phase 10** | Image analysis — Gemini vision + iDrive E2 storage |
| **Phase 11** | Hospital user accounts — doctor auth, long-lived tokens |
| **Phase 12** | Patient profiles + report tracking — tracking ID system |
| **Phase 13** | /nearby-for-report — urgency-aware hospital matching |
| **Phase 14** | API key management — generate, revoke, monitor |
| **Phase 15** | API documentation page — live, domain-aware, copyable |
| **Phase 16** | Terms of use — NDPA/NDPR compliant, clinical responsibility clauses |
| **Phase 17** | Team handover documents — desktop app, web app teams |

---

## Deployment

| Component | Where |
|---|---|
| Location Intelligence Service | Vercel (ent-location-sys.vercel.app) |
| Custom domain (Primary) | ent-server.hostl.cloud |
| Database | Neon PostgreSQL (us-east-2) |
| Image Storage | iDrive E2 (us-west-4, bucket: ent-system) |
| Source code | github.com/dev-olayemi/ent-location-sys |

---

## Who Benefits

**Patients**
Any person in Nigeria with an ear, nose, or throat complaint gets immediate, intelligent, plain-language guidance — in seconds, on any phone, with no login, no download, and no cost.

**Doctors and Specialists**
Clinical decision support that organises patient-submitted information before the consultation. AI-assisted analysis to surface relevant conditions and investigations. Fast, accurate referral hospital finding. Specialist review of complex cases.

**Hospitals and Clinics**
Visibility to patients searching for ENT care. Accurate listing of specialties and services. Accreditation status publicly displayed. Referral inbound from the network of doctors using the platform.

**The Healthcare System**
Patients reach the right facility the first time. Referrals are informed and appropriate. ENT conditions are caught earlier, before they become emergencies. Preventable hearing loss in children is reduced.

---

## What This Is Not

This platform is clinical decision support. It is not a replacement for a doctor.

Every analysis result includes a clear statement that it is not a clinical diagnosis. Every doctor using the system is told that their professional judgement takes precedence. Every emergency result bypasses the platform entirely and directs the patient to call 112.

The goal is not to replace the healthcare system. It is to make it easier to reach.

---

## Repository Structure

```
ent-location-sys/
  prisma/
    schema.prisma          ← Full database schema (12 models)
    data/conditions.json   ← 150 ENT conditions dataset
    seed.ts                ← Hospital and specialty seed data
    import-conditions.ts   ← Conditions import script
  src/
    app/
      admin/               ← Admin GUI (dashboard, facilities, users, keys)
      api/
        v1/                ← Public API (analyze, nearby, reports, auth)
        admin/             ← Admin API (CRUD, escalation, stats)
    lib/
      ai-matching.ts       ← Gemini integration + fallback logic
      condition-matcher.ts ← Local 150-condition database matching
      storage.ts           ← iDrive E2 image storage
      api-auth.ts          ← API key + hospital token validation
      haversine.ts         ← Distance calculation
      geocoding.ts         ← Nominatim geocoding
      routing.ts           ← OSRM travel times
      tracking-id.ts       ← ENT-YYYY-XXXXXXXX ID generation
    components/
      admin/               ← Admin UI components
      docs/                ← API docs components
  for_team/
    desktop_app_team/      ← Full handover for hospital desktop team
    webapp_team/           ← Full handover for patient web app team
    legal/                 ← Terms of use (NDPA compliant)
  docs/
    PRESENTATION.md        ← This document
```

---

## In One Sentence

ENT-Care AI solves the most critical bottleneck in ENT healthcare delivery in Nigeria: the gap between a patient who does not know what is wrong with them and the right specialist who can help — by building intelligent infrastructure that any app can call, any patient can use, and any hospital can join.

---

*ENT-Care AI Platform*
*Abraham Adesanya Polytechnic (AAPOLY)*
*November 2026*
