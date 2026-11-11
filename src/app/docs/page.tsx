import type { Metadata } from "next";
import { headers } from "next/headers";
import { DocsSidebar } from "@/components/docs/sidebar";
import { EndpointSection } from "@/components/docs/endpoint-section";
import { CodeBlock } from "@/components/docs/code-block";
import { Badge } from "@/components/docs/badge";
import { BaseUrlBanner } from "@/components/docs/base-url-banner";

export const metadata: Metadata = {
  title: "API Documentation - ENT-Care Location Intelligence Service",
  description:
    "Complete API reference for integrating with the ENT-Care Location Intelligence Service.",
};

export const dynamic = "force-dynamic";

async function getBaseUrl(): Promise<string> {
  // On the server, read the actual request host so it works on any domain
  try {
    const headersList = await headers();
    const host = headersList.get("host") ?? "ent-location-sys.vercel.app";
    const proto = headersList.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}/api/v1`;
  } catch {
    return "https://ent-location-sys.vercel.app/api/v1";
  }
}

export default async function DocsPage() {
  const baseUrl = await getBaseUrl();
  const origin = baseUrl.replace("/api/v1", "");
  return (
    <div className="flex min-h-screen bg-white">
      <DocsSidebar />

      {/* Main content */}
      <main className="flex-1 min-w-0 pl-64">
        <div className="max-w-3xl mx-auto px-8 py-12">

          {/* ─── Header ─── */}
          <div id="overview" className="mb-12 pb-8 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-medium text-[#5f6368] uppercase tracking-widest">
                API Reference
              </span>
            </div>
            <h1 className="text-3xl text-[#202124] mb-3">
              Location Intelligence Service
            </h1>
            <p className="text-[#5f6368] leading-relaxed">
              A standalone service that owns all location logic, hospital data,
              specialties, and intelligent matching for the ENT-Care AI platform.
              Other systems - Patient PWA, Hospital Desktop - call this API
              instead of maintaining their own hospital lists or location code.
            </p>

            <div className="mt-6 rounded-md border border-gray-200 bg-gray-50 px-5 py-4">
              <p className="text-xs text-[#5f6368] mb-2 font-medium uppercase tracking-wide">Base URL</p>
              <BaseUrlBanner baseUrl={baseUrl} />
            </div>
          </div>

          {/* ─── Authentication ─── */}
          <section id="authentication" className="mb-12 pb-8 border-b border-gray-200">
            <h2 className="text-xl text-[#202124] mb-3">Authorization</h2>
            <p className="text-sm text-[#5f6368] leading-relaxed mb-5">
              Every request to the API requires an API key. An administrator can create a
              consumer-specific key in{" "}
              <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">/admin/api-keys</code>.
              The full key is shown once; store it securely in the calling application&apos;s
              server-side environment and never expose it in browser code.
            </p>

            <div className="mb-5">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Sending the key</h4>
              <p className="text-sm text-[#5f6368] mb-3">Send the key with either supported header:</p>
              <CodeBlock language="http" filename="Option A — X-API-Key header (recommended)" code={`POST /api/v1/nearby
Content-Type: application/json
X-API-Key: your-secret-key`} />
              <div className="mt-3">
                <CodeBlock language="http" filename="Option B — Bearer token" code={`POST /api/v1/nearby
Content-Type: application/json
Authorization: Bearer your-secret-key`} />
              </div>
            </div>

            <div className="mb-5">
              <h4 className="text-sm font-medium text-[#202124] mb-3">TypeScript example</h4>
              <CodeBlock language="typescript" filename="api-client.ts" code={`const BASE_URL = "${baseUrl}";
const API_KEY = process.env.LOCATION_SERVICE_API_KEY; // store in your app's env

async function callLocationService(path: string, body: object) {
  if (!API_KEY) throw new Error("LOCATION_SERVICE_API_KEY is not configured");
  const res = await fetch(\`\${BASE_URL}\${path}\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}`} />
            </div>

            <div className="rounded-md border border-gray-200 overflow-hidden text-sm">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Response</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-2.5 font-mono text-xs text-green-700">200 OK</td>
                    <td className="px-4 py-2.5 text-xs text-[#5f6368]">Valid active API key</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-mono text-xs text-red-600">401 Unauthorized</td>
                    <td className="px-4 py-2.5 text-xs text-[#5f6368]">Missing, invalid, or revoked API key</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-mono text-xs text-amber-700">503 Unavailable</td>
                    <td className="px-4 py-2.5 text-xs text-[#5f6368]">API-key database could not be reached</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[#5f6368] mt-3">
              The admin interface (<code className="font-mono bg-gray-100 px-1 rounded">/admin/*</code>) uses a separate session-based login — email and password set via{" "}
              <code className="font-mono bg-gray-100 px-1 rounded">ADMIN_EMAIL</code> /{" "}
              <code className="font-mono bg-gray-100 px-1 rounded">ADMIN_PASSWORD</code> env vars.
            </p>
          </section>

          {/* ─── Response Format ─── */}
          <section id="response-format" className="mb-12 pb-8 border-b border-gray-200">
            <h2 className="text-xl text-[#202124] mb-3">Response Format</h2>
            <p className="text-sm text-[#5f6368] leading-relaxed mb-5">
              All endpoints return JSON with a consistent envelope:
            </p>
            <CodeBlock language="json" code={`{
  "status": "success" | "error",
  "data": { ... }          // present on success
  "message": "..."         // present on error
}`} />
            <p className="text-sm text-[#5f6368] leading-relaxed mt-5">
              HTTP status codes follow standard conventions: <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">200</code> success,{" "}
              <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">400</code> bad request,{" "}
              <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">404</code> not found,{" "}
              <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">500</code> server error.
            </p>
          </section>

          {/* ─── Endpoints heading ─── */}
          <section id="endpoints" className="mb-6">
            <h2 className="text-xl text-[#202124] mb-1">Endpoints</h2>
            <p className="text-sm text-[#5f6368]">Seven API endpoints cover all integration needs.</p>
          </section>

          {/* ─── 1. POST /nearby ─── */}
          <EndpointSection
            id="nearby"
            method="POST"
            path="/api/v1/nearby"
            summary="Find nearby hospitals"
            description="Given a user's coordinates (or a place name), returns nearest internal registry facilities plus available OpenStreetMap hospital listings. This coordinate-based search does not use AI."
          >
            {/* Request */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Request body</h4>
              <div className="rounded-md border border-gray-200 overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Field</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Type</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Required</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      ["latitude", "float", "Yes*", "User's latitude. Required if place is not given."],
                      ["longitude", "float", "Yes*", "User's longitude. Required if place is not given."],
                      ["place", "string", "Yes*", "Place name alternative - town, LGA, state. e.g. \"Abeokuta, Ogun State\". Geocoded via Nominatim."],
                      ["radiusKm", "number", "No", "Search radius in kilometres. Default: 50."],
                      ["specialty", "string", "No", "Filter by specialty name. e.g. \"ENT\", \"Rhinology\"."],
                      ["services", "string[]", "No", "Require all listed services to be available at a facility."],
                      ["onlyAccredited", "boolean", "No", "If true, only return accredited facilities. Default: false."],
                      ["limit", "number", "No", "Maximum results to return. Default: 10."],
                    ].map(([field, type, req, desc]) => (
                      <tr key={field} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-[#1a73e8]">{field}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368] font-mono">{type}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368]">{req}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368]">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-[#5f6368] mt-2">* Provide either <code className="font-mono bg-gray-100 px-1 rounded">latitude + longitude</code> or <code className="font-mono bg-gray-100 px-1 rounded">place</code>. Not both required.</p>
              <p className="text-xs text-[#5f6368] mt-2">Coordinates are used directly for distance. Reverse geocoding uses map data (not AI) to find the best available address and may resolve only to a road, neighbourhood, or town. Unfiltered nearby searches may include external OpenStreetMap hospitals, always marked unverified; external results are excluded for accreditation, specialty, or service-filtered searches. External search is capped at 50 km.</p>
            </div>

            {/* Example request */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Example request</h4>
              <CodeBlock language="json" filename="POST /api/v1/nearby" code={`{
  "latitude": 6.9123,
  "longitude": 3.6481,
  "radiusKm": 40,
  "limit": 8
}`} />
            </div>

            {/* Place name alternative */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Using a place name instead of coordinates</h4>
              <CodeBlock language="json" filename="POST /api/v1/nearby" code={`{
  "place": "Abeokuta, Ogun State, Nigeria",
  "radiusKm": 30,
  "onlyAccredited": true
}`} />
            </div>

            {/* Example response */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Response</h4>
              <CodeBlock language="json" filename="200 OK" code={`{
  "status": "success",
  "data": {
    "userLocation": {
      "latitude": 6.9123,
      "longitude": 3.6481,
      "addressStatus": "resolved",
      "address": {
        "formatted": "Abeokuta, Ogun State, Nigeria",
        "town": "Abeokuta",
        "lga": "Abeokuta South",
        "state": "Ogun",
        "country": "Nigeria",
        "countryCode": "ng",
        "road": null,
        "houseNumber": null,
        "neighbourhood": null,
        "postcode": null,
        "components": {}
      }
    },
    "radiusKm": 40,
    "externalSearch": {
      "source": "OpenStreetMap Nominatim",
      "attribution": "© OpenStreetMap contributors",
      "geographicScope": "Nigeria",
      "radiusKm": 40,
      "status": "available",
      "facilitiesFound": 1
    },
    "total": 3,
    "facilities": [
      {
        "id": "cmxxx...",
        "name": "Olabisi Onabanjo University Teaching Hospital (OOUTH)",
        "slug": "oouth-sagamu",
        "address": "Hospital Road, Sagamu",
        "city": "Sagamu",
        "state": "Ogun",
        "country": "Nigeria",
        "source": "internal_registry",
        "verificationStatus": "registry_record",
        "accreditationStatus": "accredited",
        "latitude": 6.849044,
        "longitude": 3.653023,
        "phone": null,
        "email": null,
        "website": null,
        "accredited": true,
        "specialties": ["ENT", "Otology", "Rhinology", "Laryngology"],
        "services": [],
        "distanceKm": 7.05,
        "accredited": true,
        "matchStatus": "not_assessed",
        "travelTimes": {
          "driving": "8 min",
          "walking": "1h 25m",
          "motorcycle": "6 min"
        }
      },
      {
        "id": "osm:way:123",
        "name": "Example Community Hospital",
        "source": "openstreetmap",
        "sourceUrl": "https://www.openstreetmap.org/way/123",
        "verificationStatus": "unverified",
        "accreditationStatus": "unverified",
        "accredited": null,
        "matchStatus": "specialty_unverified",
        "distanceKm": 8.4
      }
    ]
  }
}`} />
            </div>
          </EndpointSection>

          {/* ─── 2. POST /match-by-diagnosis ─── */}
          <EndpointSection
            id="match-by-diagnosis"
            method="POST"
            path="/api/v1/match-by-diagnosis"
            summary="AI-assisted diagnosis matching with nearby fallback"
            description="Send a free-text clinical diagnosis or symptom description. Groq (openai/gpt-oss-120b) extracts relevant specialties and services, then the API searches both the internal registry and OpenStreetMap Nominatim for nearby hospitals in Nigeria."
          >
            <div className="mb-5 rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-xs text-[#1a73e8] leading-relaxed">
                <strong>How it works:</strong> Groq is only used to interpret the diagnosis. When available, the endpoint uses the extracted specialties/services to match internal registry records and nearby OpenStreetMap hospitals. If Groq is unavailable or cannot identify a relevant specialty, it falls back to ordinary nearest-facility search and marks the results as not clinically assessed. Normal coordinate-to-address and nearest-hospital requests use no AI. External records are unverified, and OpenStreetMap does not confirm accreditation or current service availability.
              </p>
            </div>

            {/* Request fields */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Request body</h4>
              <div className="rounded-md border border-gray-200 overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Field</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Type</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Required</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      ["latitude", "float", "Yes", "User's latitude."],
                      ["longitude", "float", "Yes", "User's longitude."],
                      ["diagnosis", "string", "Yes", "Free-text clinical description, symptoms, or diagnosis summary. Can be in plain language."],
                      ["urgency", "string", "No", "\"routine\" | \"priority\" | \"emergency\". Affects ranking - emergency sorts purely by distance. Default: \"routine\"."],
                      ["limit", "number", "No", "Maximum results to return. Default: 10."],
                    ].map(([field, type, req, desc]) => (
                      <tr key={field} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-[#1a73e8]">{field}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368] font-mono">{type}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368]">{req}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368]">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Urgency explanation */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Urgency levels</h4>
              <div className="rounded-md border border-gray-200 overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Value</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Ranking behaviour</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-[#5f6368]">routine</td>
                      <td className="px-4 py-2.5 text-xs text-[#5f6368]">Ranked by clinical relevance + distance (default)</td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-[#5f6368]">priority</td>
                      <td className="px-4 py-2.5 text-xs text-[#5f6368]">Ranked by clinical relevance + distance (same as routine)</td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-[#5f6368]">emergency</td>
                      <td className="px-4 py-2.5 text-xs text-[#5f6368]">Ranked by distance only - closest hospital first regardless of specialty match score</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Example request</h4>
              <CodeBlock language="json" filename="POST /api/v1/match-by-diagnosis" code={`{
  "latitude": 6.9123,
  "longitude": 3.6481,
  "diagnosis": "Persistent nasal obstruction and loss of smell for 3 months. Suspected nasal polyps. Needs rhinology assessment and possible endoscopy.",
  "urgency": "priority",
  "limit": 5
}`} />
            </div>

            <div className="mb-4">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Response</h4>
              <CodeBlock language="json" filename="200 OK" code={`{
  "status": "success",
  "data": {
    "userLocation": {
      "latitude": 6.9123,
      "longitude": 3.6481
    },
    "diagnosis": "Persistent nasal obstruction...",
    "urgency": "priority",
    "matchingMode": "diagnosis_matched",
    "diagnosisMatching": { "status": "completed" },
    "aiExtraction": {
      "specialties": ["Rhinology", "ENT"],
      "services": ["Nasal Endoscopy"],
      "reasoning": "The description indicates nasal obstruction and suspected polyps, pointing to Rhinology. ENT is the parent specialty. Nasal Endoscopy is the relevant procedure."
    },
    "externalSearch": {
      "source": "OpenStreetMap Nominatim",
      "attribution": "© OpenStreetMap contributors",
      "geographicScope": "Nigeria",
      "radiusKm": 25,
      "status": "available",
      "facilitiesFound": 12
    },
    "total": 2,
    "facilities": [
      {
        "id": "cmxxx...",
        "name": "Federal Medical Centre (FMC) Abeokuta",
        "slug": "fmc-abeokuta",
        "address": "Olabisi Onabanjo Way, Idi-Aba, Abeokuta",
        "city": "Abeokuta",
        "state": "Ogun",
        "country": "Nigeria",
        "source": "internal_registry",
        "verificationStatus": "registry_record",
        "accreditationStatus": "accredited",
        "latitude": 7.144071,
        "longitude": 3.38045,
        "accredited": true,
        "specialties": ["ENT", "Otology", "Rhinology", "Laryngology"],
        "services": [],
        "matchedSpecialties": ["Rhinology", "ENT"],
        "matchedServices": ["Nasal Endoscopy"],
        "distanceKm": 39.2,
        "travelEstimate": {
          "driving": "47 min",
          "walking": "7h 50m",
          "motorcycle": "31 min"
        }
      },
      {
        "id": "osm:way:123456",
        "name": "Example Community Hospital",
        "source": "openstreetmap",
        "sourceUrl": "https://www.openstreetmap.org/way/123456",
        "verificationStatus": "unverified",
        "accredited": null,
        "matchStatus": "specialty_unverified",
        "distanceKm": 8.4
      }
    ]
  }
}`} />
            </div>
          </EndpointSection>

          {/* ─── 3. GET /facilities/:id ─── */}
          <EndpointSection
            id="facility-detail"
            method="GET"
            path="/api/v1/facilities/:id"
            summary="Get facility details"
            description="Retrieve the full record for a single facility by its ID. Use this to show a detailed view after the user selects a hospital from search results."
          >
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Path parameter</h4>
              <div className="rounded-md border border-gray-200 overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Parameter</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-4 py-2.5 font-mono text-xs text-[#1a73e8]">id</td>
                      <td className="px-4 py-2.5 text-xs text-[#5f6368]">The facility&apos;s unique ID returned in search results.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Example request</h4>
              <CodeBlock language="bash" filename="GET /api/v1/facilities/:id" code={`GET /api/v1/facilities/cmwakxikw000hwet2c98ixxeu`} />
            </div>

            <div className="mb-4">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Response</h4>
              <CodeBlock language="json" filename="200 OK" code={`{
  "status": "success",
  "data": {
    "id": "cmwakxikw000hwet2c98ixxeu",
    "name": "Federal Medical Centre (FMC) Abeokuta",
    "slug": "fmc-abeokuta",
    "address": "Olabisi Onabanjo Way, Idi-Aba, Abeokuta",
    "city": "Abeokuta",
    "state": "Ogun",
    "country": "Nigeria",
    "latitude": 7.144071,
    "longitude": 3.38045,
    "phone": null,
    "email": null,
    "website": null,
    "accredited": true,
    "accreditationDate": null,
    "operatingHours": null,
    "notes": "Major tertiary hospital with confirmed ENT department",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "specialties": [
      {
        "id": "cmxxx...",
        "name": "ENT",
        "code": "ENT",
        "description": "Ear, Nose and Throat"
      },
      {
        "id": "cmxxx...",
        "name": "Rhinology",
        "code": "RHI",
        "description": "Nose and sinus disorders"
      }
    ],
    "services": []
  }
}`} />
              <p className="mt-3 text-xs text-[#5f6368]">
                Check <code>matchingMode</code> and <code>diagnosisMatching.status</code>: <code>diagnosis_matched</code> means AI matching ran; <code>nearby_fallback</code> means these are general nearest facilities within 50 km, not diagnosis-based recommendations. AI unavailability does not block the ordinary nearby search.
              </p>
            </div>
          </EndpointSection>

          {/* ─── 4. POST /analyze ─── */}
          <EndpointSection
            id="analyze"
            method="POST"
            path="/api/v1/analyze"
            summary="Full ENT symptom analysis"
            description="Submit patient symptoms for comprehensive ENT analysis. Uses dataset matching as primary method; falls back to Gemini AI when dataset confidence is low. Automatically detects complex cases and flags them for specialist review."
          >
            {/* AI fallback note */}
            <div className="mb-5 rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-xs text-[#1a73e8] leading-relaxed">
                <strong>AI fallback trigger:</strong> When <code>localMatches.length === 0</code> OR the top dataset score is below 30, the endpoint calls Gemini for a full analysis. If Gemini fails, the response continues with partial dataset data and sets <code>aiStatus.available = false</code>.
              </p>
            </div>

            {/* Request body */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Request body</h4>
              <div className="rounded-md border border-gray-200 overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Field</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Type</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Required</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      ["symptoms", "string", "Yes", "Free-text symptom description. e.g. \"ear pain, discharge, hearing loss for 3 days\"."],
                      ["affectedArea", "string", "No", "\"ear\" | \"nose\" | \"throat\" | \"head_neck\". Narrows dataset matching."],
                      ["duration", "string", "No", "How long symptoms have been present. e.g. \"3 days\", \"2 weeks\"."],
                      ["onsetPattern", "string", "No", "\"sudden\" | \"gradual\" | \"episodic\" | \"chronic\"."],
                      ["age", "number", "No", "Patient age in years. Used to adjust urgency and advice."],
                      ["additionalContext", "string", "No", "Any extra clinical detail. e.g. \"had a cold recently\", \"child aged 4\"."],
                      ["latitude", "float", "No*", "User latitude for nearby facility lookup."],
                      ["longitude", "float", "No*", "User longitude for nearby facility lookup."],
                      ["place", "string", "No*", "Place name alternative. Geocoded via Nominatim if no coords."],
                      ["includeNearby", "boolean", "No", "Whether to include nearby facilities. Default: true."],
                      ["radiusKm", "number", "No", "Search radius for nearby facilities. Default: 50."],
                      ["limit", "number", "No", "Max facilities to return. Default: 5."],
                    ].map(([field, type, req, desc]) => (
                      <tr key={field} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-[#1a73e8]">{field}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368] font-mono">{type}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368]">{req}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368]">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-[#5f6368] mt-2">* Provide <code className="font-mono bg-gray-100 px-1 rounded">latitude + longitude</code> or <code className="font-mono bg-gray-100 px-1 rounded">place</code> to get nearby facilities. If neither is provided, <code>nearbyFacilities</code> will be null.</p>
            </div>

            {/* analysis.method values */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">analysis.method values</h4>
              <div className="rounded-md border border-gray-200 overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Value</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Meaning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      ["dataset_match", "Good local match found (score ≥ 40); Groq specialties extracted successfully."],
                      ["ai_assisted", "Dataset match used but Groq added specialty enrichment."],
                      ["ai_full_analysis", "Dataset confidence too low — Gemini provided the full clinical analysis."],
                      ["fallback", "No dataset match and Gemini also unavailable; partial results returned."],
                    ].map(([val, meaning]) => (
                      <tr key={val} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-[#5f6368]">{val}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368]">{meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* aiStatus error codes */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">aiStatus error codes</h4>
              <p className="text-sm text-[#5f6368] mb-3">When <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">aiStatus.available = false</code>, check <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">aiStatus.code</code> for a machine-readable reason:</p>
              <div className="rounded-md border border-gray-200 overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Code</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">HTTP</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      ["AI_QUOTA_EXCEEDED", "429", "Gemini API daily quota has been exhausted. The request is rejected immediately — no partial results."],
                      ["AI_TIMEOUT", "200", "Gemini did not respond in time. Response continues with dataset data only."],
                      ["AI_UNAVAILABLE", "200", "Gemini service is unreachable. Response continues with dataset data only."],
                      ["AI_ERROR", "200", "Unexpected Gemini error. Response continues with dataset data only."],
                    ].map(([code, http, when]) => (
                      <tr key={code} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-[#5f6368]">{code}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-[#5f6368]">{http}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368]">{when}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Escalation field */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">escalation field</h4>
              <p className="text-sm text-[#5f6368] mb-3">Every response includes an <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">escalation</code> object. When a case is flagged as complex, a unique <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">caseId</code> is returned. Use it with the <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">POST /escalation/:id/consent</code> endpoint to submit the user&apos;s consent for specialist review.</p>
              <div className="rounded-md border border-gray-200 overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Field</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Type</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      ["isComplex", "boolean", "true when the case was flagged (high urgency, ambiguous differential, or low-confidence fallback)."],
                      ["caseId", "string?", "Unique case ID. Present only when isComplex = true and the save succeeded."],
                      ["message", "string?", "Human-readable note to show the user when isComplex = true."],
                    ].map(([field, type, desc]) => (
                      <tr key={field} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-[#1a73e8]">{field}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368] font-mono">{type}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368]">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Example request */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Example request</h4>
              <CodeBlock language="json" filename={`POST ${baseUrl}/analyze`} code={`{
  "symptoms": "ear pain, discharge from ear, hearing loss on the right side",
  "affectedArea": "ear",
  "duration": "5 days",
  "onsetPattern": "sudden",
  "age": 28,
  "latitude": 6.9123,
  "longitude": 3.6481,
  "radiusKm": 40,
  "limit": 5
}`} />
            </div>

            {/* Example response */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Response</h4>
              <CodeBlock language="json" filename="200 OK" code={`{
  "status": "success",
  "data": {
    "input": {
      "symptoms": "ear pain, discharge from ear, hearing loss on the right side",
      "affectedArea": "ear",
      "duration": "5 days",
      "age": 28
    },
    "analysis": {
      "method": "ai_assisted",
      "confidence": "high",
      "primaryCondition": {
        "id": "acute-otitis-media",
        "name": "Acute Otitis Media",
        "commonName": "Middle Ear Infection",
        "category": "ear",
        "confidence": 82,
        "matchedOn": ["ear pain", "hearing loss", "discharge"]
      },
      "differentials": [
        {
          "id": "otitis-externa",
          "name": "Otitis Externa",
          "commonName": "Swimmer's Ear",
          "category": "ear",
          "confidence": 54,
          "matchedOn": ["ear pain", "discharge"]
        }
      ],
      "aiInsights": {
        "specialties": ["ENT", "Otology"],
        "services": ["Otoscopy", "Audiometry"],
        "reasoning": "Ear pain with discharge and hearing loss suggests middle ear pathology. ENT and Otology are the relevant specialties."
      }
    },
    "clinical": {
      "urgencyScore": 6,
      "urgencyLevel": "Soon",
      "urgencyColor": "yellow",
      "referralThreshold": "within_week",
      "immediateAction": "Book an appointment with a doctor within the next few days.",
      "patientAdvice": "Keep the ear dry. Do not insert objects into the ear canal. Avoid swimming until reviewed.",
      "redFlags": ["Sudden complete hearing loss", "Facial weakness", "Severe headache with stiff neck"],
      "specialists": ["ENT", "Otology"],
      "investigations": ["Otoscopy", "Audiometry", "Tympanometry"],
      "possibleCauses": ["Bacterial infection", "Viral upper respiratory tract infection", "Eustachian tube dysfunction"],
      "complications": ["Hearing loss", "Perforation of eardrum", "Mastoiditis"]
    },
    "nearbyFacilities": [
      {
        "id": "cmxxx...",
        "name": "Olabisi Onabanjo University Teaching Hospital (OOUTH)",
        "city": "Sagamu",
        "state": "Ogun",
        "distanceKm": 7.05,
        "accredited": true,
        "specialties": ["ENT", "Otology"],
        "travelTimes": { "driving": "8 min", "walking": "1h 25m", "motorcycle": "6 min" }
      }
    ],
    "locationNote": null,
    "escalation": {
      "isComplex": false
    }
  }
}`} />
            </div>
          </EndpointSection>

          {/* ─── 5. POST /analyze-image ─── */}
          <EndpointSection
            id="analyze-image"
            method="POST"
            path="/api/v1/analyze-image"
            summary="Analyse an image of an affected area"
            description="Submit a base64-encoded image of an ear, nose, throat, or general head-neck area for AI-powered visual analysis. Gemini Vision interprets the image and returns clinical findings, possible conditions, and recommended next steps."
          >
            {/* Consent notice */}
            <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs text-amber-800 leading-relaxed font-medium mb-1">Image Storage Consent Notice</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Your uploaded images may be collected and retained for diagnostic improvement purposes. By submitting an image, you acknowledge this notice. The <code className="font-mono bg-amber-100 px-1 rounded">consentNotice</code> field in every response echoes this text so you can display it to users at the point of upload.
              </p>
            </div>

            {/* Base64 format */}
            <div className="mb-5 rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs text-[#5f6368] leading-relaxed">
                <strong className="text-[#202124]">Base64 format:</strong> Send the image as a raw base64 string or as a full data URL (e.g. <code className="font-mono bg-gray-100 px-1 rounded">data:image/jpeg;base64,...</code>). The data URL prefix is accepted and stripped before processing. Maximum decoded size: <strong>4 MB</strong>.
              </p>
            </div>

            {/* Request body */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Request body</h4>
              <div className="rounded-md border border-gray-200 overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Field</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Type</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Required</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      ["imageBase64", "string", "Yes", "Base64-encoded image. Data URL prefix accepted and stripped automatically."],
                      ["imageType", "string", "Yes", "\"ear\" | \"nose\" | \"throat\" | \"general\". Tells the AI what anatomical area to focus on."],
                      ["additionalContext", "string", "No", "Optional clinical notes to accompany the image. e.g. \"patient reports pain for 3 days\"."],
                    ].map(([field, type, req, desc]) => (
                      <tr key={field} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-[#1a73e8]">{field}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368] font-mono">{type}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368]">{req}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368]">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* imageType values */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">imageType values</h4>
              <div className="rounded-md border border-gray-200 overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Value</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">AI context hint</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      ["ear", "Focuses analysis on external ear canal, eardrum, and surrounding tissue."],
                      ["nose", "Focuses analysis on nasal passages, septum, and external nasal structures."],
                      ["throat", "Focuses analysis on pharynx, tonsils, and visible laryngeal structures."],
                      ["general", "No anatomical focus — broad head/neck area or unknown region."],
                    ].map(([val, hint]) => (
                      <tr key={val} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-[#5f6368]">{val}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368]">{hint}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Example request */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Example request</h4>
              <CodeBlock language="json" filename={`POST ${baseUrl}/analyze-image`} code={`{
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRgAB...",
  "imageType": "ear",
  "additionalContext": "Patient reports 3 days of ear pain and discharge"
}`} />
            </div>

            {/* Example response */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Response</h4>
              <CodeBlock language="json" filename="200 OK" code={`{
  "status": "success",
  "data": {
    "imageType": "ear",
    "analysis": {
      "findings": "The image shows redness and swelling of the external ear canal with visible discharge. The eardrum appears partially obscured.",
      "possibleConditions": ["Acute Otitis Externa", "Otitis Media with Perforation"],
      "urgencyScore": 6,
      "nextSteps": ["Clean discharge gently", "Avoid water entry", "Seek ENT consultation within 48 hours"],
      "specialistReviewNeeded": true
    },
    "disclaimer": "This is an AI-assisted visual screening only. It is not a clinical diagnosis. Always confirm findings with a qualified medical professional.",
    "consentNotice": "Your uploaded images may be collected for diagnostic improvement purposes.",
    "storedImageKey": "analysis/img_a1b2c3d4e5f6a7b8/original.jpg",
    "referenceId": "img_a1b2c3d4e5f6a7b8",
    "processedAt": "2025-07-01T10:30:00.000Z"
  }
}`} />
            </div>
          </EndpointSection>

          {/* ─── 6. POST /nearby-for-report ─── */}
          <EndpointSection
            id="nearby-for-report"
            method="POST"
            path="/api/v1/nearby-for-report"
            summary="Find hospitals based on an analysis report"
            description="Takes key outputs from an /analyze report and returns the best-matching nearby facilities. This is what the 'Find Nearby Hospital' button calls after an analysis is complete. No AI call is made — ranking is purely score-based using specialty match, service match, accreditation, and distance."
          >
            {/* Request body */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Request body</h4>
              <div className="rounded-md border border-gray-200 overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Field</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Type</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Required</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      ["primaryCondition", "string", "Yes", "Condition name from the analysis report. e.g. \"Acute Otitis Media\"."],
                      ["specialists", "string[]", "Yes", "Specialist types required. e.g. [\"ENT\", \"Paediatric ENT\"]. Pass an empty array if unknown."],
                      ["urgencyScore", "number", "Yes", "1–10 urgency score from the analysis. Drives the sort strategy."],
                      ["requiredServices", "string[]", "No", "Services that must be available. e.g. [\"Audiometry\", \"Tympanometry\"]. Default: []."],
                      ["latitude", "float", "No*", "User latitude."],
                      ["longitude", "float", "No*", "User longitude."],
                      ["place", "string", "No*", "Place name. Geocoded via Nominatim if no coords provided."],
                      ["radiusKm", "number", "No", "Search radius in kilometres. Default: 50."],
                      ["limit", "number", "No", "Maximum results to return. Default: 8."],
                      ["onlyAccredited", "boolean", "No", "If true, only accredited facilities are returned. Default: true."],
                    ].map(([field, type, req, desc]) => (
                      <tr key={field} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-[#1a73e8]">{field}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368] font-mono">{type}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368]">{req}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368]">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-[#5f6368] mt-2">* Provide <code className="font-mono bg-gray-100 px-1 rounded">latitude + longitude</code> or <code className="font-mono bg-gray-100 px-1 rounded">place</code>.</p>
            </div>

            {/* Sort strategy */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Sort strategy by urgencyScore</h4>
              <div className="rounded-md border border-gray-200 overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">urgencyScore</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Sort mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      ["9–10 (Emergency)", "Distance only — closest first."],
                      ["7–8 (Urgent)", "Distance weighted heavily, with specialty relevance as a tiebreaker."],
                      ["1–6 (Soon / Routine)", "Specialty + service relevance first, then distance."],
                    ].map(([score, sort]) => (
                      <tr key={score} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-[#5f6368]">{score}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368]">{sort}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Example request */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Example request</h4>
              <CodeBlock language="json" filename={`POST ${baseUrl}/nearby-for-report`} code={`{
  "primaryCondition": "Acute Otitis Media",
  "specialists": ["ENT", "Otology"],
  "urgencyScore": 6,
  "requiredServices": ["Audiometry"],
  "latitude": 6.9123,
  "longitude": 3.6481,
  "radiusKm": 40,
  "limit": 5,
  "onlyAccredited": true
}`} />
            </div>

            {/* Example response */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Response</h4>
              <CodeBlock language="json" filename="200 OK" code={`{
  "status": "success",
  "data": {
    "query": {
      "primaryCondition": "Acute Otitis Media",
      "specialists": ["ENT", "Otology"],
      "urgencyScore": 6,
      "requiredServices": ["Audiometry"],
      "userLocation": { "latitude": 6.9123, "longitude": 3.6481 },
      "radiusKm": 40,
      "sortNote": "Sorted by specialty relevance + distance (standard mode)."
    },
    "total": 2,
    "facilities": [
      {
        "id": "cmxxx...",
        "name": "Olabisi Onabanjo University Teaching Hospital (OOUTH)",
        "address": "Hospital Road, Sagamu",
        "city": "Sagamu",
        "state": "Ogun",
        "country": "Nigeria",
        "latitude": 6.849044,
        "longitude": 3.653023,
        "phone": null,
        "email": null,
        "website": null,
        "accredited": true,
        "specialties": ["ENT", "Otology"],
        "services": ["Audiometry"],
        "matchedSpecialties": ["ENT", "Otology"],
        "matchedServices": ["Audiometry"],
        "distanceKm": 7.05,
        "relevanceScore": 87,
        "travelTimes": { "driving": "8 min", "walking": "1h 25m", "motorcycle": "6 min" }
      }
    ]
  }
}`} />
            </div>
          </EndpointSection>

          {/* ─── 7. POST /escalation/:id/consent ─── */}
          <EndpointSection
            id="escalation-consent"
            method="POST"
            path="/api/v1/escalation/:id/consent"
            summary="Submit consent for specialist review"
            description="When /analyze flags a case as complex, it returns an escalation.caseId. Use this endpoint to record the user's decision: consent=true sends the case for specialist review; consent=false closes it."
          >
            {/* Consent flow */}
            <div className="mb-5 rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-xs text-[#1a73e8] leading-relaxed">
                <strong>Consent flow:</strong> After calling <code>/analyze</code>, check <code>escalation.isComplex</code>. If <code>true</code>, show the user the <code>escalation.message</code> and ask if they want a specialist review. Then call this endpoint with their decision. The <code>:id</code> path parameter is the <code>escalation.caseId</code> returned by <code>/analyze</code>.
              </p>
            </div>

            {/* Path parameter */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Path parameter</h4>
              <div className="rounded-md border border-gray-200 overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Parameter</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-4 py-2.5 font-mono text-xs text-[#1a73e8]">id</td>
                      <td className="px-4 py-2.5 text-xs text-[#5f6368]">The <code className="font-mono bg-gray-100 px-1 rounded">escalation.caseId</code> returned by <code className="font-mono bg-gray-100 px-1 rounded">/analyze</code>.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Request body */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Request body</h4>
              <div className="rounded-md border border-gray-200 overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Field</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Type</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Required</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      ["consent", "boolean", "Yes", "true — user agrees to specialist review; false — user declines and the case is closed."],
                      ["email", "string", "No", "User email address. Required when consent = true so the specialist team can follow up."],
                    ].map(([field, type, req, desc]) => (
                      <tr key={field} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-[#1a73e8]">{field}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368] font-mono">{type}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368]">{req}</td>
                        <td className="px-4 py-2.5 text-xs text-[#5f6368]">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Behavior */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Behavior</h4>
              <div className="rounded-md border border-gray-200 overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">consent value</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">What happens</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-[#5f6368]">true</td>
                      <td className="px-4 py-2.5 text-xs text-[#5f6368]">The case is marked as consented. If an email is provided it is saved to the case record so the specialist team can follow up.</td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-[#5f6368]">false</td>
                      <td className="px-4 py-2.5 text-xs text-[#5f6368]">The case is closed. No specialist review is initiated.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Example — consent given */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Example request (consent given)</h4>
              <CodeBlock language="json" filename={`POST ${origin}/api/v1/escalation/cmxxx.../consent`} code={`{
  "consent": true,
  "email": "patient@example.com"
}`} />
            </div>

            {/* Example — consent declined */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Example request (consent declined)</h4>
              <CodeBlock language="json" filename={`POST ${origin}/api/v1/escalation/cmxxx.../consent`} code={`{
  "consent": false
}`} />
            </div>

            {/* Example response */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Response</h4>
              <CodeBlock language="json" filename="200 OK — consent given" code={`{
  "status": "success",
  "data": {
    "caseId": "cmxxx...",
    "consent": true,
    "message": "Thank you. Your case has been queued for specialist review. You will be contacted at patient@example.com when an update is available."
  }
}`} />
            </div>
          </EndpointSection>

          {/* ─── Integration Guides ─── */}
          <section id="integration" className="mt-2 mb-12 pb-8 border-b border-gray-200">
            <h2 className="text-xl text-[#202124] mb-2">Integration Guide</h2>
            <p className="text-sm text-[#5f6368] mb-6 leading-relaxed">
              How to wire this service into your Patient PWA or Hospital Desktop app.
            </p>

            <div className="mb-8">
              <h3 className="text-base text-[#202124] mb-3">Patient PWA - show nearby hospitals</h3>
              <p className="text-sm text-[#5f6368] mb-4 leading-relaxed">
                When a patient opens the app, get their browser location and call <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">/api/v1/nearby</code>.
              </p>
              <CodeBlock language="typescript" filename="patientApp/api/findHospitals.ts" code={`async function findNearbyHospitals(lat: number, lng: number) {
  const res = await fetch("${baseUrl}/nearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.LOCATION_SERVICE_API_KEY ?? "",
    },
    body: JSON.stringify({
      latitude: lat,
      longitude: lng,
      radiusKm: 50,
      specialty: "ENT",
      onlyAccredited: true,
      limit: 10,
    }),
  });

  const data = await res.json();

  if (data.status !== "success") {
    throw new Error(data.message);
  }

  return data.data.facilities; // sorted by distance
}`} />
            </div>

            <div className="mb-8">
              <h3 className="text-base text-[#202124] mb-3">Patient PWA - match by diagnosis</h3>
              <p className="text-sm text-[#5f6368] mb-4 leading-relaxed">
                After the AI symptom analysis produces a diagnosis summary, pass it here to get recommended hospitals.
              </p>
              <CodeBlock language="typescript" filename="patientApp/api/matchHospitals.ts" code={`async function matchHospitalsByDiagnosis(
  lat: number,
  lng: number,
  diagnosisSummary: string,
  urgency: "routine" | "priority" | "emergency" = "routine"
) {
  const res = await fetch(
    "${baseUrl}/match-by-diagnosis",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.LOCATION_SERVICE_API_KEY ?? "",
      },
      body: JSON.stringify({
        latitude: lat,
        longitude: lng,
        diagnosis: diagnosisSummary,
        urgency,
        limit: 5,
      }),
    }
  );

  const data = await res.json();

  if (data.status !== "success") {
    throw new Error(data.message);
  }

  // data.data.aiExtraction tells you what specialties were detected
  // data.data.facilities is the ranked list
  return data.data;
}`} />
            </div>

            <div className="mb-8">
              <h3 className="text-base text-[#202124] mb-3">Hospital Desktop - look up a facility</h3>
              <CodeBlock language="typescript" filename="hospitalApp/api/getFacility.ts" code={`async function getFacilityById(id: string) {
  const res = await fetch(
    \`${baseUrl}/facilities/\${id}\`,
    {
      headers: {
        "X-API-Key": process.env.LOCATION_SERVICE_API_KEY ?? "",
      },
    }
  );

  const data = await res.json();

  if (data.status !== "success") {
    throw new Error(data.message);
  }

  return data.data;
}`} />
            </div>

            <div>
              <h3 className="text-base text-[#202124] mb-3">Using a place name instead of coordinates</h3>
              <p className="text-sm text-[#5f6368] mb-4 leading-relaxed">
                If the user types a location instead of sharing GPS, pass it as <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">place</code>.
                The service geocodes it via Nominatim (OpenStreetMap) automatically.
              </p>
              <CodeBlock language="typescript" filename="example" code={`fetch("${baseUrl}/nearby", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": process.env.LOCATION_SERVICE_API_KEY ?? "",
  },
  body: JSON.stringify({
    place: "Sagamu, Ogun State, Nigeria",
    radiusKm: 20,
    onlyAccredited: true,
  }),
})`} />
            </div>
          </section>

          {/* ─── Error Reference ─── */}
          <section id="errors" className="mb-12 pb-8 border-b border-gray-200">
            <h2 className="text-xl text-[#202124] mb-3">Error Reference</h2>
            <div className="rounded-md border border-gray-200 overflow-hidden text-sm">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">When it occurs</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#5f6368] uppercase tracking-wide">Example message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    ["400", "Missing required fields (no coords or place)", "Provide either latitude/longitude or a place name."],
                    ["422", "Place name could not be geocoded", "Could not geocode place: \"Unknown Town\""],
                    ["404", "Facility ID not found", "Facility not found"],
                    ["500", "Internal server error", "Internal server error"],
                  ].map(([status, when, msg]) => (
                    <tr key={status + when} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-[#5f6368]">{status}</td>
                      <td className="px-4 py-2.5 text-xs text-[#5f6368]">{when}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[#5f6368]">{msg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ─── Specialties ─── */}
          <section id="specialties" className="mb-12 pb-8 border-b border-gray-200">
            <h2 className="text-xl text-[#202124] mb-3">Supported Specialties</h2>
            <p className="text-sm text-[#5f6368] mb-5 leading-relaxed">
              Use these exact names in the <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">specialty</code> filter field.
              The AI matching endpoint also maps clinical text to these.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "ENT", "Otology", "Rhinology", "Laryngology",
                "Head and Neck Surgery", "Audiology", "Paediatric ENT",
                "General Surgery", "Paediatrics", "Obstetrics & Gynaecology",
                "Internal Medicine", "Orthopaedics", "Ophthalmology",
                "Radiology", "Psychiatry", "Cardiology", "Nephrology",
              ].map((s) => (
                <Badge key={s} label={s} />
              ))}
            </div>
          </section>

          {/* ─── Rate Limits ─── */}
          <section id="rate-limits" className="mb-12">
            <h2 className="text-xl text-[#202124] mb-3">Rate Limits & Notes</h2>
            <div className="space-y-3 text-sm text-[#5f6368] leading-relaxed">
              <p>
                <strong className="text-[#202124]">Nominatim geocoding</strong> - place name geocoding is rate-limited to 1 request/second by Nominatim&apos;s usage policy. For high-traffic usage, coordinates are preferred over place names.
              </p>
              <p>
                <strong className="text-[#202124]">OSRM travel times</strong> - the public OSRM server is used for travel time estimates on the top 5 results. The remaining results use Haversine-based estimates. For production traffic, consider self-hosting OSRM.
              </p>
              <p>
                <strong className="text-[#202124]">AI endpoint</strong> - the <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">/match-by-diagnosis</code> endpoint uses Groq for clinical-text interpretation only. If AI fails, the response switches to a clearly labeled nearby-facilities fallback; use <code>matchingMode</code> to distinguish it from diagnosis-matched results.
              </p>
              <p>
                <strong className="text-[#202124]">No duplicate logic</strong> - consuming apps must never maintain their own hospital lists. Always call this service. It is the single source of truth.
              </p>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
