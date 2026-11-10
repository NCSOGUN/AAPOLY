# Location Intelligence Service

**ENT-Care AI Platform — Hospital Registry & Intelligent Facility Matching**

A standalone Next.js application providing location intelligence, hospital registry management, and AI-powered facility recommendations for the ENT-Care AI ecosystem.

## Overview

This service is the single source of truth for:
- Hospital and facility registry
- Accreditation status
- Specialties and services
- Geospatial queries and distance calculations
- Intelligent matching based on diagnosis or clinical need

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: Neon PostgreSQL (serverless) / Supabase
- **ORM**: Prisma
- **AI**: Gemini (Google Generative AI)
- **Authentication**: NextAuth.js
- **Geocoding**: Nominatim (OpenStreetMap) + Google Maps fallback
- **Styling**: Tailwind CSS + shadcn/ui components
- **Hosting**: Vercel

## Project Structure

```
ent-location-sys/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/            # React components
│   ├── lib/                   # Utilities and helpers
│   └── types/                 # TypeScript types
├── .env.local                 # Environment variables (not in git)
├── .env.example               # Template for environment variables
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- PostgreSQL database (Neon or Supabase recommended)

### Installation

1. **Clone and install dependencies**:
   ```bash
   cd /Users/apple/Documents/ent-location-sys
   npm install --legacy-peer-deps --ignore-scripts
   ```

2. **Set up environment variables**:
   Copy `.env.example` to `.env.local` and fill in your values:
   ```bash
   cp .env.example .env.local
   ```

   Required variables:
   - `DATABASE_URL` — PostgreSQL connection string
   - `GEMINI_API_KEY` — Google Generative AI API key
   - `NEXTAUTH_SECRET` — Generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` — Your app URL (http://localhost:3000 for dev)

3. **Initialize the database**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Core Features

### Public API Endpoints

- **`POST /api/v1/nearby`** — Find accredited hospitals near coordinates or place name
- **`POST /api/v1/match-by-diagnosis`** — AI-powered matching based on clinical context
- **`GET /api/v1/facilities/:id`** — Get full details for a single facility

### Admin Interface

- **`/admin`** — Protected GUI for managing hospitals, specialties, and accreditation

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `NEXTAUTH_SECRET` | Secret for NextAuth.js | ✅ |
| `NEXTAUTH_URL` | Application URL | ✅ |
| `GEMINI_API_KEY` | Google Generative AI API key | ✅ |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key (optional) | ❌ |
| `ADMIN_EMAIL` | Initial admin email for seed | ❌ |
| `ADMIN_PASSWORD` | Initial admin password for seed | ❌ |

## Database Schema

The Prisma schema includes:
- **Facility** — Hospitals, clinics, diagnostic centers
- **Specialty** — ENT, Otology, Rhinology, Laryngology, Audiology, etc.
- **FacilitySpecialty** — Many-to-many relationship
- **FacilityService** — Specific services (Audiometry, CT, Endoscopy, etc.)
- **AdminUser** — Protected admin accounts

## Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Open Prisma Studio
npx prisma studio
```

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

### Database Setup

Use [Neon](https://neon.tech) or [Supabase](https://supabase.com) for serverless PostgreSQL:

1. Create a new project
2. Copy the connection string
3. Add to `DATABASE_URL` in `.env.local` and Vercel environment variables
4. Run `npx prisma db push` to create tables

## Documentation

See [`docx.md`](./docx.md) for the complete system specification and technical guide.

## Integration

Other applications in the ENT-Care platform should:
- Never maintain their own hospital lists
- Always call this service for facility recommendations
- Send coordinates or clear place descriptions
- Handle cases where no suitable facility is found

## License

Private — ENT-Care AI Platform

---

**Status**: Initial setup complete. Ready for implementation of API endpoints and admin interface.
