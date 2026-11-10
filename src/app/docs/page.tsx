import type { Metadata } from "next";
import { DocsSidebar } from "@/components/docs/sidebar";
import { EndpointSection } from "@/components/docs/endpoint-section";
import { CodeBlock } from "@/components/docs/code-block";
import { Badge } from "@/components/docs/badge";

export const metadata: Metadata = {
  title: "API Documentation — ENT-Care Location Intelligence Service",
  description:
    "Complete API reference for integrating with the ENT-Care Location Intelligence Service.",
};

export default function DocsPage() {
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
              Other systems — Patient PWA, Hospital Desktop — call this API
              instead of maintaining their own hospital lists or location code.
            </p>

            <div className="mt-6 rounded-md border border-gray-200 bg-gray-50 px-5 py-4">
              <p className="text-xs text-[#5f6368] mb-2 font-medium uppercase tracking-wide">Base URL</p>
              <code className="text-sm text-[#202124] font-mono">
                https://your-deployment.vercel.app/api/v1
              </code>
            </div>
          </div>

          {/* ─── Authentication ─── */}
          <section id="authentication" className="mb-12 pb-8 border-b border-gray-200">
            <h2 className="text-xl text-[#202124] mb-3">Authentication</h2>
            <p className="text-sm text-[#5f6368] leading-relaxed mb-4">
              The public API endpoints (<code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">/api/v1/*</code>) are
              unauthenticated — any system can call them directly. The admin
              interface (<code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">/admin/*</code>) requires a session login.
            </p>
            <p className="text-sm text-[#5f6368] leading-relaxed">
              For production deployments it is recommended to add an{" "}
              <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">X-API-Key</code>{" "}
              header check at the middleware level to restrict access to known
              internal systems only.
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
            <p className="text-sm text-[#5f6368]">Three public endpoints cover all integration needs.</p>
          </section>

          {/* ─── 1. POST /nearby ─── */}
          <EndpointSection
            id="nearby"
            method="POST"
            path="/api/v1/nearby"
            summary="Find nearby hospitals"
            description="Given a user's coordinates (or a place name), returns accredited hospitals within the requested radius sorted by distance. This is the core endpoint — call it whenever you need to show a list of nearby facilities."
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
                      ["place", "string", "Yes*", "Place name alternative — town, LGA, state. e.g. \"Abeokuta, Ogun State\". Geocoded via Nominatim."],
                      ["radiusKm", "number", "No", "Search radius in kilometres. Default: 50."],
                      ["specialty", "string", "No", "Filter by specialty name. e.g. \"ENT\", \"Rhinology\"."],
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
            </div>

            {/* Example request */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-[#202124] mb-3">Example request</h4>
              <CodeBlock language="json" filename="POST /api/v1/nearby" code={`{
  "latitude": 6.9123,
  "longitude": 3.6481,
  "radiusKm": 40,
  "specialty": "ENT",
  "onlyAccredited": true,
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
      "longitude": 3.6481
    },
    "radiusKm": 40,
    "total": 2,
    "facilities": [
      {
        "id": "cmxxx...",
        "name": "Olabisi Onabanjo University Teaching Hospital (OOUTH)",
        "slug": "oouth-sagamu",
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
        "specialties": ["ENT", "Otology", "Rhinology", "Laryngology"],
        "services": [],
        "distanceKm": 7.05,
        "travelTimes": {
          "driving": "8 min",
          "walking": "1h 25m",
          "motorcycle": "6 min"
        }
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
            summary="AI-powered diagnosis matching"
            description="Send a free-text clinical diagnosis or symptom description. The AI layer (Gemini) extracts relevant medical specialties and required services from the text, then queries the hospital registry for the best matching accredited facilities near the user's location."
          >
            <div className="mb-5 rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-xs text-[#1a73e8] leading-relaxed">
                <strong>How it works:</strong> The diagnosis text is sent to Gemini, which identifies relevant specialties (e.g. &quot;Rhinology&quot;, &quot;ENT&quot;) and procedures (e.g. &quot;Nasal Endoscopy&quot;) from the clinical description. The service then matches these against the facility registry and ranks by relevance + distance.
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
                      ["urgency", "string", "No", "\"routine\" | \"priority\" | \"emergency\". Affects ranking — emergency sorts purely by distance. Default: \"routine\"."],
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
                      <td className="px-4 py-2.5 text-xs text-[#5f6368]">Ranked by distance only — closest hospital first regardless of specialty match score</td>
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
    "aiExtraction": {
      "specialties": ["Rhinology", "ENT"],
      "services": ["Nasal Endoscopy"],
      "reasoning": "The description indicates nasal obstruction and suspected polyps, pointing to Rhinology. ENT is the parent specialty. Nasal Endoscopy is the relevant procedure."
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
        "latitude": 7.144071,
        "longitude": 3.38045,
        "accredited": true,
        "specialties": ["ENT", "Otology", "Rhinology", "Laryngology"],
        "services": [],
        "matchedSpecialties": ["Rhinology", "ENT"],
        "distanceKm": 39.2,
        "travelEstimate": {
          "driving": "47 min",
          "walking": "7h 50m",
          "motorcycle": "31 min"
        }
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
            </div>
          </EndpointSection>

          {/* ─── Integration Guides ─── */}
          <section id="integration" className="mt-2 mb-12 pb-8 border-b border-gray-200">
            <h2 className="text-xl text-[#202124] mb-2">Integration Guide</h2>
            <p className="text-sm text-[#5f6368] mb-6 leading-relaxed">
              How to wire this service into your Patient PWA or Hospital Desktop app.
            </p>

            <div className="mb-8">
              <h3 className="text-base text-[#202124] mb-3">Patient PWA — show nearby hospitals</h3>
              <p className="text-sm text-[#5f6368] mb-4 leading-relaxed">
                When a patient opens the app, get their browser location and call <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">/api/v1/nearby</code>.
              </p>
              <CodeBlock language="typescript" filename="patientApp/api/findHospitals.ts" code={`async function findNearbyHospitals(lat: number, lng: number) {
  const res = await fetch("https://your-service.vercel.app/api/v1/nearby", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
              <h3 className="text-base text-[#202124] mb-3">Patient PWA — match by diagnosis</h3>
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
    "https://your-service.vercel.app/api/v1/match-by-diagnosis",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
              <h3 className="text-base text-[#202124] mb-3">Hospital Desktop — look up a facility</h3>
              <CodeBlock language="typescript" filename="hospitalApp/api/getFacility.ts" code={`async function getFacilityById(id: string) {
  const res = await fetch(
    \`https://your-service.vercel.app/api/v1/facilities/\${id}\`
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
              <CodeBlock language="typescript" filename="example" code={`fetch("/api/v1/nearby", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
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
                <strong className="text-[#202124]">Nominatim geocoding</strong> — place name geocoding is rate-limited to 1 request/second by Nominatim&apos;s usage policy. For high-traffic usage, coordinates are preferred over place names.
              </p>
              <p>
                <strong className="text-[#202124]">OSRM travel times</strong> — the public OSRM server is used for travel time estimates on the top 5 results. The remaining results use Haversine-based estimates. For production traffic, consider self-hosting OSRM.
              </p>
              <p>
                <strong className="text-[#202124]">AI endpoint</strong> — the <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">/match-by-diagnosis</code> endpoint calls Gemini. If the AI call fails or times out, it falls back to ENT as the default specialty and still returns distance-ranked results.
              </p>
              <p>
                <strong className="text-[#202124]">No duplicate logic</strong> — consuming apps must never maintain their own hospital lists. Always call this service. It is the single source of truth.
              </p>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
