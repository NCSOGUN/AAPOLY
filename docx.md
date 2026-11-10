**LOCATION INTELLIGENCE SERVICE**  
**Project Documentation**

**Document Type:** System Specification & Technical Guide  
**Version:** 1.0  
**Date:** November 2026  
**Status:** Ready for Development  

---

### 1. Document Purpose

This document provides the complete specification for the **Location Intelligence Service** — a standalone system that centralizes all location, hospital registry, specialty matching, and intelligent facility recommendation logic for the ENT-Care AI platform.

It is intended for the team that will build and maintain this service. It explains:

- The problem we are solving
- The structure of the overall platform and how this service fits
- What the service must deliver
- Technical decisions and why they were made
- Expected API behaviour
- Admin interface requirements
- Data model
- Integration expectations with the Patient and Hospital applications

---

### 2. Problem Statement

In the broader ENT-Care AI platform, multiple applications need accurate answers to location-related questions:

- Which accredited hospitals near a patient can handle a specific ENT condition?
- What is the distance and estimated travel time (walking, motorcycle/okada, car)?
- Which facilities offer particular specialties or services (Otology, Rhinology, Audiology, nasal endoscopy, etc.)?
- How do we keep hospital data, accreditation status, and specialties consistent across all applications?

If every application implements its own location logic, hospital list, and matching rules, we will face:

- Inconsistent recommendations
- Duplicate maintenance of hospital data
- Higher risk of errors
- Difficulty updating accreditation or specialties
- Repeated geocoding and distance calculations

**We solve this by creating one authoritative Location Intelligence Service** that owns:

- Hospital and facility registry
- Accreditation status
- Specialties and services
- Geospatial queries
- Intelligent matching based on diagnosis or clinical need

All other systems simply call this service.

---

### 3. Overall Platform Context

The ENT-Care AI ecosystem consists of three main systems:

| System                        | Platform              | Primary Users              | Responsibility                                      |
|-------------------------------|-----------------------|----------------------------|-----------------------------------------------------|
| Patient Application           | Mobile-first PWA      | Patients                   | Symptom intake, analysis, booking, viewing recommendations |
| Hospital / Specialist App     | Desktop Web App       | Doctors, Hospital Staff    | Patient records, appointment management, outcomes   |
| **Location Intelligence Service** | Standalone Next.js App | Internal systems + Admins | **All location, registry, and matching logic**     |

The Location Intelligence Service is the single source of truth for:

- Facility data
- Geographic calculations
- Specialty matching
- AI-assisted hospital recommendation

---

### 4. Solution Overview

We will build a dedicated **Location Intelligence Service** with two main interfaces:

1. **Public API** (for Patient App and Hospital App)
2. **Admin GUI** (for internal team to manage hospitals, specialties, and accreditation)

#### Core Capabilities

- Accept user location (coordinates **or** place name: town, LGA, state, country)
- Return accurate list of nearby accredited hospitals
- Accept diagnosis / clinical context and return the most suitable hospitals
- Maintain a managed registry of hospitals with specialties and services
- Provide a visual admin interface to add, edit, and accredit facilities
- Calculate distance and approximate travel times
- Support future expansion beyond Ogun State

---

### 5. Technology Stack Decisions

| Layer                  | Chosen Technology              | Reason for Decision |
|------------------------|--------------------------------|---------------------|
| Framework              | **Next.js 15 (App Router)**    | Excellent Vercel support, single codebase for API + Admin GUI, fast development |
| Language               | TypeScript                     | Type safety and better maintainability |
| Database               | **Neon PostgreSQL** (preferred) or Supabase | Free tier, Prisma-friendly, serverless-compatible, supports geographic queries |
| ORM                    | **Prisma**                     | Rapid development, excellent TypeScript support, easy migrations |
| Hosting                | **Vercel**                     | Zero-config deployment, perfect for Next.js, free tier sufficient for early stage |
| Authentication (Admin) | NextAuth.js or Clerk           | Simple protection of the admin interface |
| AI Matching            | **Groq** (Llama 3.1 / 3.3)     | Very high free rate limits, fast inference, good for clinical text understanding |
| Geocoding              | Google Maps Geocoding API + Nominatim fallback | Best accuracy in Nigeria + free credit, with free backup |
| Distance Calculation   | Haversine formula (SQL or application level) | Reliable on serverless without requiring full PostGIS initially |
| Styling (Admin)        | Tailwind CSS + shadcn/ui       | Fast, consistent, modern admin interface |

**Why this stack?**

- Fully compatible with Vercel serverless environment
- Prisma enables very fast development of the data layer
- Neon/Supabase free tiers are generous enough for MVP and early growth
- Groq currently offers the best free AI performance for this use case
- One codebase serves both the API and the management GUI

---

### 6. System Architecture

```
┌──────────────────────┐     ┌──────────────────────┐
│   Patient PWA        │     │  Hospital Desktop    │
│   (Next.js)          │     │  Application         │
└──────────┬───────────┘     └──────────┬───────────┘
           │                            │
           │   HTTP / JSON              │
           ▼                            ▼
┌─────────────────────────────────────────────────────┐
│           Location Intelligence Service             │
│                   (Next.js on Vercel)               │
│                                                     │
│  /api/v1/*          ← Public API                    │
│  /admin/*           ← Protected Admin GUI           │
│                                                     │
│  Prisma Client  →  Neon PostgreSQL                  │
│  Groq / Gemini  →  AI Diagnosis Matching            │
│  Google Maps    →  Geocoding & fallback             │
└─────────────────────────────────────────────────────┘
```

---

### 7. Core Features

#### 7.1 Public API Features

- Receive coordinates or place description
- Return ranked list of nearby accredited facilities
- Filter by specialty, services, accreditation status, and radius
- Accept free-text or structured diagnosis and return intelligently matched hospitals
- Provide distance and estimated travel times (walking, motorcycle, car)
- Return clean, consistent JSON responses

#### 7.2 Admin GUI Features

- Secure login for authorized staff
- Dashboard showing total facilities, accredited count, recent additions
- Create / Edit / Soft-delete facilities
- Set exact coordinates (manual entry + map helper)
- Manage specialties (add, edit, assign to facilities)
- Manage services offered by each facility
- Toggle accreditation status
- Search and filter facilities

#### 7.3 AI Matching Features

- Accept diagnosis text or clinical summary
- Extract relevant specialties and required services
- Match against the facility registry
- Rank results by clinical relevance + geographic proximity
- Return transparent reasoning (which specialties were detected)

---

### 8. API Specification (Expected Behaviour)

**Base Path:** `/api/v1`

#### 8.1 Nearby Facilities

```http
POST /api/v1/nearby
```

**Request Body Example:**
```json
{
  "latitude": 6.9123,
  "longitude": 3.6481,
  "place": "Abeokuta, Ogun State",          // optional alternative to coordinates
  "radiusKm": 40,
  "specialty": "ENT",
  "services": ["Audiometry"],
  "onlyAccredited": true,
  "limit": 10
}
```

**Expected Response:**
```json
{
  "status": "success",
  "query": { ... },
  "results": [
    {
      "id": "...",
      "name": "Federal Medical Centre Abeokuta",
      "address": "...",
      "latitude": 7.155,
      "longitude": 3.345,
      "distanceKm": 12.4,
      "travelEstimates": {
        "walking": "2h 40m",
        "motorcycle": "25–35 min",
        "car": "30–40 min"
      },
      "specialties": ["ENT", "Otology"],
      "services": ["Audiometry", "Nasal Endoscopy"],
      "accredited": true,
      "contact": { "phone": "...", "email": "..." }
    }
  ]
}
```

#### 8.2 Match by Diagnosis (AI)

```http
POST /api/v1/match-by-diagnosis
```

**Request Body Example:**
```json
{
  "latitude": 6.9123,
  "longitude": 3.6481,
  "diagnosis": "Persistent nasal obstruction and loss of smell for 3 months. Suspected nasal polyps. Needs rhinology assessment and possible endoscopy.",
  "urgency": "priority",
  "limit": 8
}
```

The service will:
1. Use AI to detect relevant specialties (Rhinology, ENT)
2. Identify useful services (Nasal Endoscopy)
3. Query matching accredited facilities
4. Rank by clinical fit + distance
5. Return results with a short explanation of the matching logic

---

### 9. Data Model (Prisma)

The following models form the core of the system:

- **Facility** — Hospitals, clinics, diagnostic centres
- **Specialty** — ENT, Otology, Rhinology, Laryngology, Audiology, etc.
- **FacilitySpecialty** — Many-to-many relationship
- **FacilityService** — Specific services/equipment (Audiometry, CT, Endoscopy, etc.)

Key fields on Facility include:

- Geographic coordinates (`latitude`, `longitude`)
- Accreditation status and date
- Contact information
- Operating hours (stored as JSON)
- City, State, Country for text-based search

---

### 10. Admin Interface Expectations

The Admin GUI must allow non-technical team members to:

1. Add a new hospital with name, address, coordinates, contact details
2. Mark a hospital as accredited
3. Assign one or more specialties
4. Add available services
5. Edit existing records
6. Search and filter the registry

The interface should be clean, fast, and mobile-responsive enough for occasional use on tablets.

---

### 11. Integration Contract with Other Systems

Other applications in the ENT-Care platform must:

- Never maintain their own hospital lists or hard-coded locations
- Always call this service for facility recommendations
- Send either precise coordinates or a clear place description
- Treat the response as the authoritative list of suitable facilities
- Handle the case where no suitable facility is found within the requested radius

This service guarantees consistent, up-to-date, and clinically relevant recommendations.

---

### 12. Deployment & Environment

- Hosted on **Vercel**
- Database on **Neon** (recommended) or Supabase
- Environment variables for:
  - Database connection
  - Google Maps API key
  - Groq (or alternative AI) API key
  - Admin authentication secrets
- Preview deployments for testing
- Production domain (example): `location.entcare.ai` or similar

---

### 13. Success Criteria

The Location Intelligence Service is considered successful when:

1. Other applications can reliably get accurate nearby hospital lists by sending coordinates or place names
2. Diagnosis-based matching returns clinically relevant facilities
3. The admin team can independently add and accredit new hospitals without developer intervention
4. All location and matching logic lives in one place
5. The system remains performant and free-tier friendly during early usage

---

### 14. Future Extensions (Out of Scope for MVP)

- Full PostGIS for advanced geospatial queries
- Real-time traffic-aware travel times
- Public transport routing
- Hospital wait-time estimates
- Multi-state expansion beyond Ogun
- Webhook notifications when new facilities are accredited

---

**Document Owner:** Product & Engineering  
**Next Action:** Development team to scaffold the Next.js + Prisma project based on this specification.

This document is the single source of truth for the Location Intelligence Service.


## Key 
API Key
AQ.Ab8RN6L99vW3lNTUPnGkKJrtVNExAp6sqX5kdIHSLyNCdnbfJA
Name
ent-api-key
Project name
projects/780439255969
Project number
780439255969


curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent" \
  -H 'Content-Type: application/json' \
  -H 'X-goog-api-key: AQ.Ab8RN6L99vW3lNTUPnGkKJrtVNExAp6sqX5kdIHSLyNCdnbfJA' \
  -X POST \
  -d '{
    "contents": [
      {
        "parts": [
          {
            "text": "Explain how AI works in a few words"
          }
        ]
      }
    ]
  }'


**Best Free Open-Source Location Stack for Your System**

Here is the strongest free + open-source combination you can actually control and customize well for the Location Intelligence Service (especially for Nigeria / Ogun State).

### Recommended Open-Source Stack

| Purpose                    | Best Open-Source Choice          | License     | Can You Fully Control It? | Notes |
|---------------------------|----------------------------------|-------------|---------------------------|-------|
| **Geocoding** (Address → Coordinates) | **Nominatim** (OpenStreetMap)   | Free        | Yes (self-host)          | Best free option |
| **Reverse Geocoding**     | Nominatim                        | Free        | Yes                      | Very good |
| **Routing & Travel Times**| **OSRM** (Open Source Routing Machine) | Free   | Yes (self-host)          | Excellent performance |
| **Alternative Routing**   | **Valhalla** or **GraphHopper**  | Free        | Yes                      | Strong alternatives |
| **Map Display**           | **MapLibre GL JS** or **Leaflet**| Free        | Yes                      | Beautiful & customizable |
| **Geospatial Database**   | **PostGIS** (with PostgreSQL)    | Free        | Yes                      | Powerful for nearest queries |
| **Data Source**           | **OpenStreetMap**                | Free        | Yes (you can improve data)| Community data |

---

### Why This Stack is the Best Choice for You

- Completely free and open source
- You can self-host every part later (full control)
- Good enough accuracy for Nigeria when combined with your own hospital registry
- You are not locked into Google
- You can improve the data yourself (very important for hospitals in Ogun State)
- Works well with your Next.js + Prisma setup

---

### Practical Architecture (Recommended)

**Phase 1 (Now – Easy & Free)**
- Use **public Nominatim** for geocoding
- Calculate distance yourself with **Haversine formula** (in Prisma/PostgreSQL)
- Use **public OSRM** demo servers carefully or approximate travel times
- Store all hospital coordinates in your own database

**Phase 2 (Better Control)**
- Self-host **Nominatim** (for geocoding)
- Self-host **OSRM** (for real walking / driving routes)
- Add **PostGIS** for advanced nearest-neighbour queries

---

### Best Combination Right Now

| Function               | Tool                        | Recommendation |
|-----------------------|-----------------------------|----------------|
| Geocoding             | Nominatim                   | Primary        |
| Distance              | Haversine (your DB)         | Primary        |
| Travel Time           | OSRM                        | Best open source |
| Map in Admin GUI      | MapLibre GL JS              | Best modern choice |
| Fallback Geocoding    | Photon or OpenCage (free tier) | Backup       |

---

### My Strong Recommendation

**Go with this order:**

1. **Nominatim** → for turning town/LGA/state into coordinates
2. **Your own database + Haversine** → for finding nearest hospitals (most important)
3. **OSRM** → for proper travel time later
4. **MapLibre** → for the map in the Admin GUI

This gives you maximum freedom to manipulate the system.

---

**Best Ready-to-Use Free Endpoints (Nominatim + OSRM)**

Here are the most reliable free public endpoints you can start using **today** for your Location Intelligence Service.

### 1. Nominatim (Geocoding & Reverse Geocoding)

**Base URL:**  
`https://nominatim.openstreetmap.org`

#### Important Rules (You must follow these)
- Maximum **1 request per second**
- You **must** send a valid `User-Agent` header (example: `ENT-Care-Location-Service/1.0`)
- Do not send heavy traffic

#### Useful Endpoints

**A. Search (Address / Town → Coordinates)**
```http
GET https://nominatim.openstreetmap.org/search?q=Abeokuta,Ogun State,Nigeria&format=json&limit=5
```

**B. Reverse Geocoding (Coordinates → Address)**
```http
GET https://nominatim.openstreetmap.org/reverse?lat=7.155&lon=3.345&format=json
```

**C. Better structured search (Recommended)**
```http
GET https://nominatim.openstreetmap.org/search?
  city=Abeokuta&
  state=Ogun&
  country=Nigeria&
  format=json&
  limit=5
```

---

### 2. OSRM (Routing & Travel Time)

**Public Demo Server:**  
`https://router.project-osrm.org`

#### Main Endpoint (Route)

```http
GET https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false&steps=false
```

**Example:**
```http
https://router.project-osrm.org/route/v1/driving/3.6481,6.9123;3.3450,7.1550?overview=false
```

**Response contains:**
- `distance` (in meters)
- `duration` (in seconds)

You can convert:
- Duration → minutes
- Distance → kilometers

#### Supported Profiles
- `driving` → Car
- `walking` → Walking
- `cycling` → Can be used as approximate for motorcycle/okada (not perfect, but usable)

---

### Recommended Usage Pattern for Your System

```text
1. User sends coordinates or place name
2. If place name → Call Nominatim → Get lat/lng
3. Query your own database for nearby hospitals (Haversine)
4. For top results → Call OSRM to get real travel time
5. Return clean response to the main apps
```

---

### Example Combination (Pseudo flow)

```ts
// 1. Geocode if needed
const geo = await fetch(
  `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1`,
  {
    headers: {
      "User-Agent": "ENT-Care-Location-Service/1.0"
    }
  }
);

// 2. Get route from user to hospital
const route = await fetch(
  `https://router.project-osrm.org/route/v1/driving/${userLon},${userLat};${hospitalLon},${hospitalLat}?overview=false`
);
```

---

### Important Warnings

| Service     | Limitation                          | Advice                                      |
|-------------|-------------------------------------|---------------------------------------------|
| Nominatim   | 1 request/second                    | Add caching + rate limiting                 |
| OSRM Public | Not for heavy production traffic    | Fine for MVP, self-host later               |
| Both        | No SLA                              | Always have fallback logic                  |

---

### Better Free Alternatives (Optional)

| Purpose       | Better Free Option              | Notes                     |
|---------------|----------------------------------|---------------------------|
| Geocoding     | **LocationIQ** (free tier)       | More generous than Nominatim |
| Routing       | **OpenRouteService**             | Good free tier + open source |
| Combined      | **GraphHopper**                  | Clean free tier           |

---

