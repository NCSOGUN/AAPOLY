# ENT-Care Hospital Desktop App

The hospital and specialist desktop workspace, built with Tauri 2, React 19,
TypeScript, Tailwind CSS and shadcn-style UI components. It is a native desktop
application; Vite is used only to serve the frontend during development.

## Run the desktop app

Install Node.js, npm, Rust and the native prerequisites for Tauri on your
platform, then run:

```sh
npm install
npm run tauri -- dev
```

On macOS Intel machines that use system-installed libsodium, run:

```sh
SODIUM_USE_PKG_CONFIG=1 npm run tauri -- dev
```

`npm run dev` starts only the browser frontend. Secure sign-in and encrypted
local records require the native Tauri app.

Create a production frontend bundle with `npm run build`; package the native
desktop app with `npm run tauri -- build`.

### Installer builds

- On macOS, create an unsigned disk image with
  `npm run tauri -- build --bundles dmg --no-sign`. The DMG is written under
  `src-tauri/target/release/bundle/dmg/`.
- Windows `.exe` installers are built by
  `.github/workflows/build-windows.yml`. Push a version tag (`v*`) or run the
  workflow manually in GitHub Actions, then download the `ent-care-windows-*`
  build artifact. The installer is an NSIS setup executable.
- These commands skip code signing. Before distributing installers to
  customers, configure the organisation's Apple Developer ID signing and
  notarisation credentials and Windows code-signing certificate. Unsigned
  packages may show operating-system security warnings and are not release
  ready.

## Installation and first launch

Provide staff with the installer built for their operating system by the
organisation's ENT-Care administrator. Staff should install only packages
distributed through an approved organisational channel and contact their
administrator if the operating system reports that a package cannot be
verified; do not advise staff to bypass platform security warnings.

On first launch, ENT-Care presents a welcome and setup guide, followed by an
operational Terms of Use screen. Users must review and accept the current terms
before continuing. The accepted terms version is recorded on the local device;
users are asked to review and accept again when the terms version changes.

After setup, staff sign in with their hospital account while online and verify
that the displayed facility is correct. The app can reopen the encrypted local
workspace for up to 24 hours after sign-in; online analysis, report lookup and
facility search require connectivity.

## Local API configuration

The API base URL defaults to `https://ent-server.hostl.cloud/api/v1`. To use a
different approved environment, copy `.env.example` to `.env` and set
`VITE_API_BASE_URL`.

The desktop app does not bundle a shared API key. Hospital credentials are
sent to the sign-in endpoint, and the returned user token is used for
subsequent requests. Never put a private API key in the app database or a
distributed build.

## Implemented workflows

- Hospital sign-in and session verification through the documented API.
- Offline unlock after a successful online sign-in, using the same email and
  password. The macOS Keychain securely holds the vault unlock secret for up to
  24 hours, so the workspace can reopen without asking for credentials each
  launch during that period. The token and patient-record encryption key are
  held in a Stronghold encrypted vault. Patient intake and diagnosis payloads
  are AES-GCM encrypted in SQLite; the database also stores record indexes.
- Three-step patient intake with required-field validation and ENT symptom and
  history capture, with ear/nose/throat illustrations for affected-area
  selection. Intake records are autosaved locally as they are entered and can
  be reopened from **Saved visits**.
- Optional online symptom and clinical-image analysis after intake. The app
  displays suggested findings with clinical disclaimers, saves the analysis as
  a report, links its tracking ID to the local visit, and keeps the diagnosis
  available for later viewing and printing. Image analysis requires explicit
  patient-consent confirmation.
- Nearby referral facility search using the documented
  `POST /nearby-for-report` endpoint. Referral documents can be saved as
  encrypted local drafts and printed.
- Patient report lookup by tracking ID and escalated-case review/respond
  through the documented service endpoints.
- A restrained, responsive desktop interface using light-grey borders and the
  supplied `assets/aap-logo-img.png` branding.

## Current integration limits

- Image attachments are held only for the current intake session and are not
  persisted in the encrypted visit record. Images are sent for analysis only
  after a clinician explicitly confirms patient consent.
- Patient details and diagnosis reports are AES-GCM encrypted in SQLite, with
  the encryption key protected in Stronghold. Legacy records still stored only
  in Stronghold remain readable.
- Referral drafts are local only. The integration guide assigns referral
  submission/sync to a separate backend but does not provide its API contract,
  so this app does not claim that a draft has been sent or received.
- Appointment booking is not implemented because no appointment endpoint or
  contract is documented for this app.
- The desktop client follows the integration guide's hospital-token flow:
  sign in without a shared key, then use the returned `hu_` token. However, the
  live API documentation currently says every endpoint requires a consumer API
  key that must remain server-side. The backend must reconcile these contracts
  and permit the documented hospital sign-in/token flow before installers can
  sign in.
- Live authentication and endpoint responses still require approved team
  credentials to verify end-to-end.
- Clinical analysis requires an internet connection. Results are decision
  support only and do not replace clinician judgement.

The integration guide in `desktop_app_team/README.md` is the source of truth
for API behavior, authentication and data ownership. Patient data must not be
sent to the ENT location service unless the relevant endpoint explicitly
supports it.
