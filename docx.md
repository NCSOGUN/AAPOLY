**LOCATION INTELLIGENCE SERVICE**  
**Project Documentation**

**Document Type:** System Specification & Technical Guide  
**Version:** 1.0  
**Date:** November 2026  
**Status:** Ready for Development  

---

### 1. Document Purpose

This document provides the complete specification for the **Location Intelligence Service** - a standalone system that centralizes all location, hospital registry, specialty matching, and intelligent facility recommendation logic for the ENT-Care AI platform.

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
| AI Matching            | **Groq** (`openai/gpt-oss-120b`) | Structured extraction of relevant specialties and possible services |
| Geocoding              | Nominatim + Photon (OpenStreetMap) | Free place search and reverse geocoding with a secondary search provider |
| Distance Calculation   | Haversine formula (SQL or application level) | Reliable on serverless without requiring full PostGIS initially |
| Styling (Admin)        | Tailwind CSS + shadcn/ui       | Fast, consistent, modern admin interface |

**Why this stack?**

- Fully compatible with Vercel serverless environment
- Prisma enables very fast development of the data layer
- Neon/Supabase free tiers are generous enough for MVP and early growth
- Diagnosis matching requires a Groq API key configured as `GROQ_API_KEY`; keep it in environment variables and never commit it
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
│  Groq           →  AI Diagnosis Matching            │
│  Google Maps    →  Geocoding & fallback             │
└─────────────────────────────────────────────────────┘
```

---

### 7. Core Features

#### 7.1 Public API Features

- Receive coordinates or place description
- Resolve coordinates into available address components with map-based reverse geocoding (no AI required)
- Return ranked nearby facilities without AI, using the internal registry and unverified external map listings
- Run diagnosis interpretation with AI only when clinical text is supplied
- Fall back to nearest facilities when diagnosis AI is unavailable, clearly marking that those results are not diagnosis-matched
- Filter by specialty, services, accreditation status, and radius
- Accept free-text or structured diagnosis and return intelligently matched hospitals when AI is available
- Provide distance and estimated travel times (walking, motorcycle, car)
- Return clean, consistent JSON responses

#### 7.2 Admin GUI Features

- Secure login for authorized staff
- Issue, revoke, re-enable, and delete consumer-specific API keys from `/admin/api-keys`; show each raw key only once and store only its hash
- Dashboard showing total facilities, accredited count, recent additions
- Create / Edit / Soft-delete facilities
- Use an interactive map in the facility form to search for a place or click/drag a pin; automatically populate the exact coordinates and reverse-geocoded address, town/LGA, state, and country (with manual field edits still available)
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
3. Search matching facilities in the internal registry and OpenStreetMap Nominatim for hospitals within 25 km of the supplied coordinates in Nigeria
4. Match external specialty tags when present; label external listings as unverified and never represent them as accredited by this system
5. Rank by clinical fit + distance and return the AI extraction and source/verification details

OpenStreetMap is a community-maintained map, not a medical accreditation directory. Its facility, specialty, and service information may be incomplete or out of date. External results must be shown as unverified; users should contact a facility to confirm services and availability. API consumers displaying these records must preserve the `© OpenStreetMap contributors` attribution and source link.

#### AI Failure Fallback

If Groq is unavailable or returns no relevant specialty, the service still returns ordinary nearby facilities within 50 km (registry plus external map results where available). Such responses use `matchingMode: "nearby_fallback"` and identify the AI status in `diagnosisMatching`. These are distance-based options only; they are not represented as clinically matched recommendations. Coordinate-only `/api/v1/nearby` and `/api/v1/reverse-geocode` do not require or call AI.

#### Coordinate Address Resolution

GPS coordinates are the precise input point. Reverse geocoding uses OpenStreetMap address data, not AI; the most specific available output may be a street, neighbourhood, town, LGA, state, or country. It cannot guarantee a building number when the map provider has no such data.

---

### 9. Data Model (Prisma)

The following models form the core of the system:

- **Facility** - Hospitals, clinics, diagnostic centres
- **Specialty** - ENT, Otology, Rhinology, Laryngology, Audiology, etc.
- **FacilitySpecialty** - Many-to-many relationship
- **FacilityService** - Specific services/equipment (Audiometry, CT, Endoscopy, etc.)

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
   - Search for the hospital or surrounding area on the embedded map, then click or drag the pin to its exact location
   - Automatically resolve and populate the address, city/LGA, state, country, latitude, and longitude from the selected point
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

The internal registry is the source of truth for its accreditation records. External map listings can be incomplete or out of date and are always identified as unverified candidates; the service must not claim they are accredited or confirm services without evidence.

---

### 12. Deployment & Environment

- Hosted on **Vercel**
- Database on **Neon** (recommended) or Supabase
- Environment variables for:
  - Database connection
  - `GROQ_API_KEY` for `openai/gpt-oss-120b` diagnosis matching
  - Admin authentication secrets
- Preview deployments for testing
- Production domain (example): `location.entcare.ai` or similar

---

### 13. Success Criteria

The Location Intelligence Service is considered successful when:

1. Other applications can reliably get accurate nearby hospital lists by sending coordinates or place names
2. Diagnosis-based matching returns registry matches and clearly marked external candidates, with specialty evidence and accreditation status visible
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

**Best Free Open-Source Location Stack for Your System**

Here is the strongest free + open-source combination you can control and customize for the Location Intelligence Service, especially for Nigeria and Ogun State.

### Recommended Open-Source Stack

| Purpose | Best Open-Source Choice | License | Can You Fully Control It? | Notes |
|---|---|---|---|---|
| **Geocoding** (Address → Coordinates) | **Nominatim** (OpenStreetMap) | Free | Yes (self-host) | Best free option |
| **Reverse Geocoding** | Nominatim | Free | Yes | Very good |
| **Routing & Travel Times** | **OSRM** (Open Source Routing Machine) | Free | Yes (self-host) | Excellent performance |
| **Alternative Routing** | **Valhalla** or **GraphHopper** | Free | Yes | Strong alternatives |
| **Map Display** | **MapLibre GL JS** or **Leaflet** | Free | Yes | Customizable |
| **Geospatial Database** | **PostGIS** (with PostgreSQL) | Free | Yes | Powerful for nearest queries |
| **Data Source** | **OpenStreetMap** | Free | Yes (you can improve data) | Community data |

### Why This Stack

- Open source and self-hostable for greater control
- Useful coverage for Nigeria when combined with the verified internal facility registry
- Avoids dependence on Google for core location workflows
- Community-maintained data can be corrected and improved over time
- Compatible with the Next.js + Prisma service

### Practical Architecture

**Phase 1 (MVP)**
- Use public Nominatim carefully for geocoding, reverse geocoding, and bounded hospital-category search
- Calculate distance using the Haversine formula
- Use public OSRM demo servers carefully or approximate travel times
- Store verified facility and accreditation data in the service database
- Label external OSM results as unverified candidates

**Phase 2 (More Control)**
- Self-host Nominatim for geocoding and facility search
- Self-host OSRM for actual walking/driving routes
- Add PostGIS for advanced nearest-neighbour queries

### Recommended Combination

| Function | Tool | Recommendation |
|---|---|---|
| Geocoding | Nominatim | Primary |
| Distance | Haversine (service) | Primary |
| Travel time | OSRM | Best open-source option |
| Map in Admin GUI | Leaflet | Current embedded map |
| Fallback geocoding | Photon | Secondary provider |
| Nearby external hospitals | Nominatim + OpenStreetMap | Unverified discovery source |

### Nominatim Usage Rules

- Maximum one request per second per application
- Send a descriptive `User-Agent` header
- Cache responses and avoid heavy traffic
- Public Nominatim has no service-level agreement; use a hosted provider or self-host for production traffic

**Base URL:** `https://nominatim.openstreetmap.org`

#### Search (Address or Town to Coordinates)
```http
GET https://nominatim.openstreetmap.org/search?q=Abeokuta,Ogun%20State,Nigeria&format=json&limit=5
```

#### Reverse Geocoding (Coordinates to Address)
```http
GET https://nominatim.openstreetmap.org/reverse?lat=7.155&lon=3.345&format=json
```

#### Structured Search (Recommended)
```http
GET https://nominatim.openstreetmap.org/search?city=Abeokuta&state=Ogun&country=Nigeria&format=json&limit=5
```

#### Bounded Hospital Search (Nigeria)
The diagnosis endpoint searches a bounded area around the supplied coordinates for OSM hospital records. External records do not establish accreditation or prove that a specialty or service is available.

### OSRM (Routing & Travel Time)

**Public demo server:** `https://router.project-osrm.org`

```http
GET https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false&steps=false
```

The route response includes distance in meters and duration in seconds. Public demo services are not intended for high-volume production traffic; self-host or use a contracted service when usage grows.

**Example:**
```http
https://router.project-osrm.org/route/v1/driving/3.6481,6.9123;3.3450,7.1550?overview=false
```

Convert route duration from seconds to minutes and distance from meters to kilometres.

Supported public demo profiles:
- `driving` for car routes
- `walking` where supported by the deployed routing profile
- `cycling` as an approximate route for motorcycle/okada, not an exact motorcycle profile

### Recommended Location Workflow

```text
1. Receive coordinates or a place name
2. Geocode a place name with Nominatim
3. Reverse-geocode coordinates for the best available address and search nearest hospitals without AI
4. If diagnosis text is also supplied, use AI to extract specialty/service intent and rank suitable facilities
5. If AI is unavailable, keep the location flow working and return clearly labeled distance-only facilities
6. Expose accreditation, source, and verification state; return external listings as unverified unless independently checked
7. Use OSRM for real travel-time estimates when production routing is configured
```

### Example Integration Flow

These are illustrative server-side provider calls for this service. Integrating applications should call the Location Intelligence Service API rather than these providers directly.

```ts
const geoResponse = await fetch(
  `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1`,
  { headers: { "User-Agent": "ENT-Care-Location-Service/1.0" } }
);

const routeResponse = await fetch(
  `https://router.project-osrm.org/route/v1/driving/${userLongitude},${userLatitude};${facilityLongitude},${facilityLatitude}?overview=false`
);
```

The production application should call this service's API rather than calling geocoding or routing providers independently.

### Public Provider Limitations

| Service | Limitation | Recommendation |
|---|---|---|
| Nominatim | Maximum one request per second; public service has no SLA | Cache and self-host or use a hosted provider as traffic grows |
| Public OSRM | Demo service is not for high-volume production use | Self-host or use a contracted routing provider |
| OpenStreetMap facility data | Community-maintained and incomplete; does not establish accreditation | Return external facilities as unverified until staff validate them |

### Future Extensions

- Self-host Nominatim and OSRM
- Add PostGIS for larger registries and optimized proximity search
- Expand external facility discovery beyond hospitals if suitable, reliable data is available
- Add manual review workflows for external facilities before they become verified registry records
- Consider LocationIQ, OpenRouteService, or GraphHopper hosted plans if public-service limits become restrictive
