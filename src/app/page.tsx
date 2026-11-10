export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Location Intelligence Service
        </h1>
        <p className="text-muted-foreground text-lg mb-8">
          ENT-Care AI — single source of truth for hospital registry, specialty
          matching, and intelligent facility recommendations.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-left">
          <div className="rounded-lg border p-4">
            <h2 className="font-semibold mb-1">Public API</h2>
            <p className="text-sm text-muted-foreground">
              <code>/api/v1/nearby</code> — Find accredited facilities by
              coordinates or place name.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h2 className="font-semibold mb-1">AI Matching</h2>
            <p className="text-sm text-muted-foreground">
              <code>/api/v1/match-by-diagnosis</code> — Map clinical context to
              the best-fit hospitals.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h2 className="font-semibold mb-1">Admin GUI</h2>
            <p className="text-sm text-muted-foreground">
              <code>/admin</code> — Manage hospitals, accreditation, specialties,
              and services.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h2 className="font-semibold mb-1">Facility Details</h2>
            <p className="text-sm text-muted-foreground">
              <code>/api/v1/facilities/:id</code> — Retrieve full details for a
              single facility.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
