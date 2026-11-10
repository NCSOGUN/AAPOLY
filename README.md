# Location Intelligence Service

**ENT-Care AI Platform — Hospital Registry & Intelligent Facility Matching**

A standalone Next.js application providing location intelligence, hospital registry management, and AI-powered facility recommendations for the ENT-Care AI ecosystem.

---

## Overview

The Location Intelligence Service is the **single source of truth** for all location, hospital registry, specialty matching, and intelligent facility recommendation logic across the ENT-Care AI platform.

Other systems (Patient PWA, Hospital Desktop App) never maintain their own hospital lists — they call this service instead.

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
│  /api/v1/*          ← Public API (no auth)         │
│  /admin/*           ← Protected Admin GUI          │
│                                                     │
│  Prisma Client  →  Neon PostgreSQL                  │
│  Gemini AI      →  Diagnosis Matching               │
│  Nominatim OSM  →  Geocoding (Nigeria)              │
│  OSRM           →  Real travel time estimates       │
└─────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Next.js 15 (App Router) | API + Admin GUI in one codebase |
| Language | TypeScript | Type safety throughout |
| Database | Neon PostgreSQL (serverless) | Free tier, Prisma-friendly |
| ORM | Prisma | Fast development, easy migrations |
| AI Matching | Google Gemini 1.5 Flash | Extract specialties from clinical text |
| Authentication | NextAuth.js v5 | Protect the Admin GUI |
| Geocoding | Nominatim (OpenStreetMap) | Free, Nigeria-aware geocoding |
| Routing | OSRM (public API) | Real driving/walking travel times |
| Distance | Haversine formula | Offline fallback, no PostGIS needed |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent Admin interface |
| Hosting | Vercel | Zero-config, serverless-compatible |

---

## Project Structure

```
ent-location-sys/
├── prisma/
│   ├── schema.prisma           # Database schema (Facility, Specialty, etc.)
│   └── seed.ts                 # Seed: 6 specialties, 5 Ogun facilities, admin user
├── src/
│   ├── app/
│   │   ├── admin/              # Protected Admin GUI pages
│   │   │   ├── page.tsx        # Dashboard (stats + recent facilities)
│   │   │   ├── layout.tsx      # Admin shell with sidebar
│   │   │   ├── login/          # Login page + form
│   │   │   ├── facilities/     # List, New, Edit facility pages
│   │   │   └── specialties/    # Specialties management page
│   │   ├── api/
│   │   │   ├── v1/             # Public API (no auth required)
│   │   │   │   ├── nearby/     # POST - nearby facilities
│   │   │   │   ├── match-by-diagnosis/  # POST - AI matching
│   │   │   │   └── facilities/ # GET /:id - single facility
│   │   │   ├── admin/          # Protected admin API
│   │   │   │   ├── facilities/ # CRUD for facilities
│   │   │   │   ├── specialties/ # CRUD for specialties
│   │   │   │   └── stats/      # Dashboard stats
│   │   │   └── auth/           # NextAuth handler
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx            # Landing page (API info)
│   ├── components/
│   │   ├── admin/              # Sidebar, StatCard, FacilityForm
│   │   └── ui/                 # shadcn/ui primitives
│   └── lib/
│       ├── auth.ts             # NextAuth config (credentials provider)
│       ├── gemini.ts           # Gemini AI specialty extraction
│       ├── geocoding.ts        # Nominatim geocode + reverse geocode
│       ├── haversine.ts        # Distance formula + travel estimates
│       ├── prisma.ts           # Prisma singleton client
│       ├── routing.ts          # OSRM travel times + fallback
│       └── utils.ts            # cn() Tailwind utility
├── .env.example                # Environment variable template
├── package.json
├── prisma/schema.prisma
├── tailwind.config.ts
└── tsconfig.json
```

---

## Setup Instructions

### Prerequisites

- Node.js 20+
- npm
- PostgreSQL database — [Neon](https://neon.tech) or [Supabase](https://supabase.com) (free tier)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the template and fill in your values:

```bash
cp .env.example .env.local
```

Open `.env.local` and set:

```env
# Required
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
NEXTAUTH_SECRET="run: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
GEMINI_API_KEY="your-google-generative-ai-key"

# Optional
GOOGLE_MAPS_API_KEY=""          # Not currently used; Nominatim is primary
ADMIN_EMAIL="admin@entcare.ai"  # Used by prisma seed
ADMIN_PASSWORD="yourpassword"   # Used by prisma seed
```

### 3. Set up the database

Generate the Prisma client and push the schema:

```bash
npx prisma generate
npx prisma db push
```

### 4. Seed sample data (optional but recommended)

Loads 6 specialties, 5 Ogun State facilities, and the initial admin account:

```bash
npm run db:seed
```

> Default admin credentials (unless you override via env): `admin@entcare.ai` / `admin123`  
> **Change the password immediately after first login in a real deployment.**

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Admin GUI

The Admin GUI lives at `/admin` and is protected by NextAuth.js session authentication.

### Access

Navigate to [http://localhost:3000/admin/login](http://localhost:3000/admin/login) and sign in with your admin credentials.

### Pages

| Page | Path | What it does |
|---|---|---|
| Dashboard | `/admin` | Stats overview + recent facilities |
| Facilities list | `/admin/facilities` | Search, paginate, delete facilities |
| Add facility | `/admin/facilities/new` | Create a facility with coordinates, specialties, services |
| Edit facility | `/admin/facilities/:id/edit` | Update any facility field, toggle accreditation |
| Specialties | `/admin/specialties` | Create, rename, and delete specialty definitions |

### Admin API (authenticated endpoints)

These endpoints are used by the Admin GUI and require a valid NextAuth session:

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/facilities` | List all facilities (paginated, searchable) |
| POST | `/api/admin/facilities` | Create a new facility |
| GET | `/api/admin/facilities/:id` | Get a facility with full relations |
| PUT | `/api/admin/facilities/:id` | Update a facility |
| DELETE | `/api/admin/facilities/:id` | Delete a facility |
| GET | `/api/admin/specialties` | List all specialties |
| POST | `/api/admin/specialties` | Create a specialty |
| PUT | `/api/admin/specialties/:id` | Update a specialty |
| DELETE | `/api/admin/specialties/:id` | Delete a specialty |
| GET | `/api/admin/stats` | Dashboard stats (counts) |

---

## Public API Reference

Base path: `/api/v1`

No authentication required. These are the endpoints your other applications call.

---

### POST /api/v1/nearby

Find accredited hospitals near a location, filtered by specialty, radius, and services.

**Request body:**

```json
{
  "latitude": 6.9123,
  "longitude": 3.6481,
  "place": "Abeokuta, Ogun State",
  "radiusKm": 40,
  "specialty": "ENT",
  "onlyAccredited": true,
  "limit": 8
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `latitude` | number | ✅ or `place` | — | User latitude |
| `longitude` | number | ✅ or `place` | — | User longitude |
| `place` | string | ✅ or coords | — | Town / LGA / state (geocoded via Nominatim) |
| `radiusKm` | number | ❌ | 50 | Search radius in km |
| `specialty` | string | ❌ | — | Filter by specialty name (e.g. `"ENT"`) |
| `onlyAccredited` | boolean | ❌ | false | Only return accredited facilities |
| `limit` | number | ❌ | 10 | Max results |

**Example response:**

```json
{
  "status": "success",
  "data": {
    "userLocation": { "latitude": 6.9123, "longitude": 3.6481 },
    "radiusKm": 40,
    "total": 2,
    "facilities": [
      {
        "id": "clxyz123",
        "name": "Remo ENT & Head-Neck Surgery Clinic",
        "address": "22 Station Road",
        "city": "Shagamu",
        "state": "Ogun",
        "country": "Nigeria",
        "latitude": 6.8512,
        "longitude": 3.6512,
        "accredited": true,
        "specialties": ["ENT", "Head & Neck Surgery", "Rhinology"],
        "services": ["Parotidectomy", "Thyroidectomy", "Nasal Endoscopy", "FESS"],
        "distanceKm": 6.84,
        "travelTimes": {
          "driving": "12 min",
          "walking": "1h 22m",
          "motorcycle": "8 min"
        },
        "phone": "+234 816 777 8900",
        "email": "clinic@remoent.ng"
      }
    ]
  }
}
```

---

### POST /api/v1/match-by-diagnosis

AI-powered hospital matching. Send a clinical description and receive ranked, relevant facilities.

**Request body:**

```json
{
  "latitude": 6.9123,
  "longitude": 3.6481,
  "diagnosis": "Persistent nasal obstruction and loss of smell for 3 months. Suspected nasal polyps. Needs rhinology assessment and possible endoscopy.",
  "urgency": "priority",
  "limit": 8
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `latitude` | number | ✅ | — | User latitude |
| `longitude` | number | ✅ | — | User longitude |
| `diagnosis` | string | ✅ | — | Free-text clinical description |
| `urgency` | string | ❌ | `"routine"` | `"routine"` \| `"priority"` \| `"emergency"` |
| `limit` | number | ❌ | 10 | Max results |

**What the AI does:**

1. Passes `diagnosis` to Gemini 1.5 Flash
2. Extracts relevant specialties from the validated list (ENT, Otology, Rhinology, Laryngology, Audiology, Head & Neck Surgery, Facial Plastics)
3. Identifies required services (e.g. "Nasal Endoscopy", "FESS")
4. Queries the database for accredited facilities matching those specialties
5. Ranks by clinical relevance + distance (or distance-only for `"emergency"`)
6. Returns results with the AI's reasoning

**Example response:**

```json
{
  "status": "success",
  "data": {
    "userLocation": { "latitude": 6.9123, "longitude": 3.6481 },
    "diagnosis": "Persistent nasal obstruction...",
    "urgency": "priority",
    "aiExtraction": {
      "specialties": ["Rhinology", "ENT"],
      "services": ["Nasal Endoscopy", "FESS"],
      "reasoning": "Description indicates chronic rhinosinusitis with nasal polyps requiring rhinology evaluation and functional endoscopic sinus surgery."
    },
    "total": 3,
    "facilities": [
      {
        "id": "clxyz456",
        "name": "Abeokuta ENT & Audiology Centre",
        "distanceKm": 24.1,
        "accredited": true,
        "specialties": ["ENT", "Audiology", "Rhinology"],
        "matchedSpecialties": ["Rhinology", "ENT"],
        "services": ["Audiometry", "Hearing Aid Fitting", "Nasal Endoscopy", "FESS"],
        "travelEstimate": {
          "driving": "31 min",
          "walking": "4h 49m",
          "motorcycle": "21 min"
        }
      }
    ]
  }
}
```

---

### GET /api/v1/facilities/:id

Get full details for a single facility by its ID.

**Example request:**

```
GET /api/v1/facilities/clxyz456
```

**Example response:**

```json
{
  "status": "success",
  "data": {
    "id": "clxyz456",
    "name": "Abeokuta ENT & Audiology Centre",
    "slug": "abeokuta-ent-audiology-centre",
    "address": "15 Ibara Road",
    "city": "Abeokuta",
    "state": "Ogun",
    "country": "Nigeria",
    "latitude": 7.1475,
    "longitude": 3.3619,
    "phone": "+234 807 455 6789",
    "email": "info@abeokutaentcentre.ng",
    "website": null,
    "accredited": true,
    "accreditationDate": "2021-09-01T00:00:00.000Z",
    "operatingHours": null,
    "notes": "Specialises in paediatric and adult hearing rehabilitation",
    "specialties": [
      { "id": "...", "name": "ENT", "code": "ENT-001", "description": "..." },
      { "id": "...", "name": "Audiology", "code": "AUD-001", "description": "..." },
      { "id": "...", "name": "Rhinology", "code": "RHI-001", "description": "..." }
    ],
    "services": [
      { "id": "...", "name": "Audiometry", "available": true },
      { "id": "...", "name": "Hearing Aid Fitting", "available": true }
    ]
  }
}
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (Neon / Supabase recommended) |
| `NEXTAUTH_SECRET` | ✅ | Random secret for NextAuth — generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | Full URL of this app (e.g. `https://location.entcare.ai`) |
| `GEMINI_API_KEY` | ✅ | Google Generative AI key — used by `/api/v1/match-by-diagnosis` |
| `GOOGLE_MAPS_API_KEY` | ❌ | Optional — Nominatim is the primary geocoder; Maps key reserved for future use |
| `ADMIN_EMAIL` | ❌ | Email for the initial admin account created by the seed script |
| `ADMIN_PASSWORD` | ❌ | Password for the initial admin account |

---

## Database Commands

```bash
# Generate Prisma client (runs automatically on npm install)
npx prisma generate

# Push schema changes to the database (development)
npm run db:push

# Seed sample specialties, facilities, and admin user
npm run db:seed

# Open Prisma Studio (visual DB browser)
npm run db:studio
```

---

## Development Commands

```bash
npm run dev       # Start local dev server at http://localhost:3000
npm run build     # Production build (TypeScript check + Next.js build)
npm start         # Start production server (after build)
npm run lint      # Run ESLint
```

---

## Deployment (Vercel)

1. Push the repository to GitHub
2. Import the project at [vercel.com](https://vercel.com)
3. Set all required environment variables in the Vercel project settings
4. Deploy — Vercel auto-detects Next.js, no config needed
5. After first deploy, run `npx prisma db push` against your production database (Neon/Supabase dashboard or via Vercel CLI)
6. Run the seed script once: `npm run db:seed`

Recommended production domain: `location.entcare.ai`

---

## Integration Contract

Applications in the ENT-Care platform must:

- **Never** maintain their own hospital lists or hard-coded locations
- **Always** call this service for facility recommendations
- Send either precise coordinates (`latitude` + `longitude`) or a clear `place` description
- Treat the response as the authoritative list of suitable facilities
- Handle gracefully the case where `total: 0` (no facilities found in radius)

---

## Full System Specification

See [`docx.md`](./docx.md) for the complete product specification, architecture decisions, and integration contract.

---

## License

Private — ENT-Care AI Platform
