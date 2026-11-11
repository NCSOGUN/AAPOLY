# Implementation Plan — Hospital / Doctor Account Management

Goal: add hospital-user (doctor/specialist/nurse/admin) accounts to the ENT Location Intelligence Service. Admins create accounts and issue long-lived `hu_` tokens in the admin GUI; the desktop app logs in once (online) at `POST /api/v1/hospital-auth`, then uses the token as `X-API-Key` / `Authorization: Bearer` on all `/api/v1/*` endpoints via a secondary path in `checkApiKey`.

## Project context (discovered during exploration)

- **Stack**: Next.js 15 (App Router) + Prisma 5.22 + Neon Postgres + NextAuth (Credentials, JWT session). React 19. Tailwind. `bcryptjs` for hashing.
- **Build gate**: `npm run build` = `next build`. There is **no test script** in `package.json`, so the verification gate is the production build (zero TypeScript errors). `npm run lint` exists but is not the gate.
- **Schema apply**: `npx prisma db push` applies the schema AND regenerates `@prisma/client` (so `prisma.hospitalUser` becomes available). Must succeed before any backend code that references it compiles.
- **Admin route guard convention**: `const session = await auth(); if (!session) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });` — copied verbatim from `src/app/api/admin/api-keys/route.ts`. `src/middleware.ts` only guards `/admin/:path*` pages, not `/api/admin/*`, so each admin route guards itself with `auth()`.
- **Next.js 15 async params**: route handlers use `type Ctx = { params: Promise<{ id: string }> }` and `const { id } = await params;` (see `src/app/api/admin/api-keys/[id]/route.ts`).
- **Response shape convention**: success `{ status: "success", data }` (create returns HTTP 201); error `{ status: "error", message }`. Prisma `P2025` (record not found) → 404; `P2002` (unique violation) → 409 conflict. Match this exactly.
- **Token formats**:
  - API keys (existing): `"ent_" + crypto.randomBytes(24).toString("hex")` = 52 chars, stored as **bcrypt hash** (`keyHash`), with a non-secret `keyPrefix` for narrowing. Returned once as `rawKey`.
  - Hospital tokens (new): `"hu_" + crypto.randomBytes(32).toString("hex")` = **67 chars total**, stored **plaintext** in `accessToken` (it is a bearer token the admin controls, not a password). Returned once as `token`.
- **Password hashing**: `await bcrypt.hash(plain, 10)` (10 rounds). Compare with `await bcrypt.compare(plain, user.passwordHash)`.
- **checkApiKey** (`src/lib/api-auth.ts`) signature: `checkApiKey(req): Promise<NextResponse | null>` — `null` means valid/allow. It reads `x-api-key` header or `Authorization: Bearer`, narrows candidates by prefix, runs `bcrypt.compare` against the `ApiKey` table, updates `lastUsedAt`. Note: `ApiKey` uses `lastUsedAt`; `HospitalUser` uses `lastLoginAt`.
- **Prisma 5.22** supports extended `findUnique`, so `findUnique({ where: { accessToken, active: true } })` is valid (the `active` filter returns null if it does not match).
- **Admin page pattern**: server component with `export const dynamic = "force-dynamic"`, fetches data, maps `DateTime` → ISO strings, passes a plain-object array to a client component (`src/app/admin/api-keys/page.tsx` + `api-keys-client.tsx`).
- **Token-reveal banner + flat table UI**: reuse the exact pattern from `src/app/admin/api-keys/api-keys-client.tsx` — green-border banner with `Key` icon, eye toggle (`showNewKey`), `CopyButton` component, `timeAgo()` helper, flat `border border-gray-200` table, `#1a73e8` primary buttons with `hover:bg-[#1557b0]`, no shadows.
- **Sidebar** (`src/components/admin/sidebar.tsx`): `navItems` array of `{ label, href, icon }`; fixed `<aside style={{ width: "224px" }}>`; lucide-react named imports. Add `UserRound`.
- **Form dropdown decision**: a radix `Select` exists (`src/components/ui/select.tsx`) but its content uses `shadow-md`, which conflicts with the brief's "no shadows, Google-style flat" requirement. Use **native `<select>` elements** styled with the same classes as `Input` (`flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-[#202124]`) for the role and facility dropdowns. Rationale: zero shadow, matches the flat aesthetic, and is simpler than wiring radix Select for two small dropdowns.

## Conventions all new code must follow

- Admin API routes: import `{ NextRequest, NextResponse } from "next/server"`, `{ auth } from "@/lib/auth"`, `{ prisma } from "@/lib/prisma"`, `bcrypt from "bcryptjs"`, `crypto from "crypto"`.
- Public v1 routes: import `{ NextRequest, NextResponse } from "next/server"`, `{ prisma } from "@/lib/prisma"`, `bcrypt from "bcryptjs"`.
- Never return `passwordHash` or the raw `accessToken` in any admin GET/list response. For display, return `tokenPrefix = accessToken.slice(0, 8) + "…"`.
- All admin routes call `auth()` first; on no session return 401 exactly as the existing routes do.
- All JSON parsing uses try/catch returning 400 on failure (see api-keys route).

---

- [ ] 1. Add the `HospitalUser` model and the `users` reverse relation on `Facility` to the Prisma schema, then push the schema to the DB so the client regenerates.
      What: Edit `prisma/schema.prisma`. On the existing `Facility` model add a reverse relation line `users HospitalUser[]` (place it after the `services FacilityService[]` line). Add a new `HospitalUser` model at the end of the file with exactly these fields:
      ```
      model HospitalUser {
        id              String    @id @default(cuid())
        name            String
        email           String    @unique
        passwordHash    String    // bcrypt hashed
        role            String    @default("doctor") // doctor | specialist | nurse | admin
        specialization  String?   // e.g. "Otologist", "Rhinologist"
        phone           String?
        licenseNumber   String?   // professional license/registration number
        facilityId      String?
        facility        Facility? @relation(fields: [facilityId], references: [id])
        accessToken     String    @unique
        tokenIssuedAt   DateTime  @default(now())
        active          Boolean   @default(true)
        lastLoginAt     DateTime?
        createdAt       DateTime  @default(now())
        updatedAt       DateTime  @updatedAt
      }
      ```
      The relation is optional (`facilityId String?`), so Prisma's default referential action is `SetNull` (deleting a Facility nulls the user's `facilityId`) — acceptable and matches the brief, which does not specify `onDelete`.
      Files: edit `prisma/schema.prisma` (one new model + one line on `Facility`).
      Verify: run `npx prisma db push`. Expect it to print that the database is now in sync and exit code 0. This both applies the table and regenerates `@prisma/client` so `prisma.hospitalUser` exists. Do NOT proceed to item 2 until this succeeds — later items reference `prisma.hospitalUser` and the build will fail if the client was not regenerated.

- [ ] 2. Create the admin collection route `GET` (list) + `POST` (create) for hospital users, guarded by `auth()`.
      What: Create `src/app/api/admin/hospital-users/route.ts`. Mirror `src/app/api/admin/api-keys/route.ts` for auth guard, JSON parse, and response shapes.
      - `GET()`: `auth()` guard; `prisma.hospitalUser.findMany({ orderBy: { createdAt: "desc" }, include: { facility: { select: { id: true, name: true } } }, select: { id, name, email, role, specialization, phone, licenseNumber, facilityId, accessToken, tokenIssuedAt, active, lastLoginAt, createdAt } })`. (You cannot mix `select` and `include` freely — use `select` and include `facility` inside it: `select: { ..., facility: { select: { id: true, name: true } } }`.) Map each row to omit `accessToken` and add `tokenPrefix = accessToken.slice(0, 8) + "…"`. Return `{ status: "success", data }`. Wrap in try/catch → 500.
      - `POST(req)`: `auth()` guard; parse body `{ name, email, password, role?, specialization?, phone?, licenseNumber?, facilityId? }`. Validate `name` (non-empty string ≤ 100), `email` (non-empty string), `password` (string, min 6 chars), `role` (string; default `"doctor"`; if provided must be one of `doctor|specialist|nurse|admin`, else 400). `specialization/phone/licenseNumber` optional strings. `facilityId` optional string; if provided, verify it exists via `prisma.facility.findUnique({ where: { id: facilityId } })` → 400 with "facilityId does not match an existing facility." if null. Hash password: `await bcrypt.hash(password, 10)`. Generate token: `"hu_" + crypto.randomBytes(32).toString("hex")` (67 chars). Create with `prisma.hospitalUser.create({ data: { name, email, passwordHash, role: role ?? "doctor", specialization, phone, licenseNumber, facilityId, accessToken: token }, select: { id, name, email, role, specialization, phone, licenseNumber, facilityId, active, tokenIssuedAt, createdAt } })`. Catch `P2002` (unique email) → 409 `{ status: "error", message: "A user with this email already exists." }`. Return 201 `{ status: "success", data: { ...created, tokenPrefix: token.slice(0,8) + "…", token } }` — the full `token` is returned ONCE.
      Files: new `src/app/api/admin/hospital-users/route.ts`.
      Verify: `npm run build` passes (route compiles). Functional check after the GUI exists; here just confirm the build has no TS errors for this file.

- [ ] 3. Create the admin item route `GET` + `PATCH` + `DELETE` for a single hospital user, guarded by `auth()`.
      What: Create `src/app/api/admin/hospital-users/[id]/route.ts`. Use `type Ctx = { params: Promise<{ id: string }> }` and `const { id } = await params;` (Next.js 15 async params). Mirror `src/app/api/admin/api-keys/[id]/route.ts` for the 404 pattern (`error.code === "P2025"` → 404).
      - `GET(_req, { params })`: `auth()` guard; `findUnique({ where: { id }, include: { facility: { select: { id, name } } } })` — actually use `select` to also omit `passwordHash`/`accessToken`. Return the record with `accessToken` replaced by `tokenPrefix`. If null → 404 "Hospital user not found."
      - `PATCH(req, { params })`: `auth()` guard; parse body for any subset of `{ name?, role?, specialization?, phone?, licenseNumber?, facilityId?, active? }` (do NOT allow password/email/accessToken here). Validate types; if `role` provided must be one of the four. If `facilityId` provided (and not null/empty), verify it exists → 400 otherwise; allow `facilityId: null` to unlink. `prisma.hospitalUser.update({ where: { id }, data: cleanedFields })`. Return updated record (same omit/prefix shape as GET). `P2025` → 404.
      - `DELETE(_req, { params })`: `auth()` guard; hard delete via `prisma.hospitalUser.delete({ where: { id } })`. Return `{ status: "success", data: { id } }`. `P2025` → 404.
      Files: new `src/app/api/admin/hospital-users/[id]/route.ts`.
      Verify: `npm run build` passes with no TS errors.

- [ ] 4. Create the admin reset-token route `POST`, guarded by `auth()`.
      What: Create `src/app/api/admin/hospital-users/[id]/reset-token/route.ts`. `auth()` guard; async params. Generate a new token `"hu_" + crypto.randomBytes(32).toString("hex")`. `prisma.hospitalUser.update({ where: { id }, data: { accessToken: newToken, tokenIssuedAt: new Date() } })`. `P2025` → 404. Return `{ status: "success", data: { id, token: newToken } }` — the new token is returned ONCE (for the reveal banner in the GUI).
      Files: new `src/app/api/admin/hospital-users/[id]/reset-token/route.ts`.
      Verify: `npm run build` passes with no TS errors.

- [ ] 5. Create the public login endpoint `POST /api/v1/hospital-auth` (NO `checkApiKey` guard) plus an `OPTIONS` CORS handler.
      What: Create `src/app/api/v1/hospital-auth/route.ts`. This is the desktop app's first-time online login. Do NOT call `checkApiKey`.
      - `POST(req)`: parse body `{ email: string, password: string }`. Validate both are strings (else 400 "email and password are required.").
      - Look up `prisma.hospitalUser.findUnique({ where: { email }, include: { facility: { select: { id, name, city, state, latitude, longitude, accredited, specialties: { include: { specialty: { select: { name: true } } } } } } } })`. If not found → 401 `{ status: "error", code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." }`.
      - `await bcrypt.compare(password, user.passwordHash)`. If false → same 401 INVALID_CREDENTIALS response. (Order decision: verify credentials first, then active status, so a wrong password never reveals whether an account is disabled.)
      - If `!user.active` → 403 `{ status: "error", code: "ACCOUNT_DISABLED", message: "This account has been disabled. Contact your administrator." }`.
      - Otherwise: `await prisma.hospitalUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })` (ignore update errors). Build the success response:
        ```
        {
          status: "success",
          data: {
            token: user.accessToken,
            user: {
              id, name, email, role, specialization, facilityId,
              facility: user.facility ? {
                id, name, city, state, latitude, longitude, accredited,
                specialties: user.facility.specialties.map(s => s.specialty.name)
              } : null
            },
            tokenIssuedAt: user.tokenIssuedAt.toISOString(),
            instructions: "Store this token securely. Use it as X-API-Key header or Authorization: Bearer on all subsequent API calls."
          }
        }
        ```
      - Wrap the whole thing in try/catch → 500 `{ status: "error", message: "Internal server error" }`.
      - `OPTIONS()`: return `new NextResponse(null, { status: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key" } })` (same pattern as `src/app/api/v1/analyze/route.ts`).
      Files: new `src/app/api/v1/hospital-auth/route.ts`.
      Verify: `npm run build` passes with no TS errors.

- [ ] 6. Create the public verify endpoint `GET /api/v1/hospital-auth/verify` (token re-check after the desktop app wakes from offline).
      What: Create `src/app/api/v1/hospital-auth/verify/route.ts`. Read the token from `req.headers.get("x-hospital-token")` OR `Authorization: Bearer <token>` (`/^Bearer\s+(.+)$/i`). If missing → 401 `{ status: "error", code: "INVALID_CREDENTIALS", message: "Token is missing or invalid." }`.
      - `prisma.hospitalUser.findUnique({ where: { accessToken: token, active: true }, include: { facility: { select: { id, name, city, state, latitude, longitude, accredited, specialties: { include: { specialty: { select: { name: true } } } } } } } })` — direct string match on `accessToken` + `active: true` (Prisma 5.22 extended findUnique). If null → 401 (same body as missing).
      - Return `{ status: "success", data: { user: { id, name, email, role, specialization, facilityId, facility: facility ? { id, name, city, state, latitude, longitude, accredited, specialties: facility.specialties.map(s => s.specialty.name) } : null } } }`. (Do not return the token here — the caller already has it.) Wrap in try/catch → 500.
      Files: new `src/app/api/v1/hospital-auth/verify/route.ts`.
      Verify: `npm run build` passes with no TS errors.

- [ ] 7. Update `checkApiKey` in `src/lib/api-auth.ts` to recognize `hu_` hospital-user tokens as a secondary auth path.
      What: After `const providedKey = …` and `if (!providedKey) return unauthorized();`, insert a hospital-token branch BEFORE the existing ApiKey-prefix logic:
      ```
      if (providedKey.startsWith("hu_")) {
        let hospitalUser;
        try {
          hospitalUser = await prisma.hospitalUser.findUnique({
            where: { accessToken: providedKey, active: true },
            select: { id: true },
          });
        } catch (error) {
          console.error("[API key authentication] hospital token lookup failed:", error);
          return keyStoreUnavailable();
        }
        if (!hospitalUser) return unauthorized();
        try {
          await prisma.hospitalUser.update({
            where: { id: hospitalUser.id },
            data: { lastLoginAt: new Date() },
          });
        } catch (error) {
          console.error("[API key authentication] hospital lastLogin update failed:", error);
        }
        return null; // valid
      }
      ```
      Keep all existing ApiKey logic untouched below it. Note the field is `lastLoginAt` (not `lastUsedAt`). Decision: branch on the `hu_` prefix first so hospital tokens never enter the bcrypt ApiKey path.
      Files: edit `src/lib/api-auth.ts`.
      Verify: `npm run build` passes with no TS errors. Existing `/api/v1/*` routes still compile and behave unchanged for `ent_` keys.

- [ ] 8. Build the admin GUI: a `force-dynamic` server page that fetches users + facilities, and a client component that reuses the api-keys token-reveal banner and flat table UI.
      What:
      - Create `src/app/admin/hospital-users/page.tsx`: `export const dynamic = "force-dynamic"`; fetch `prisma.hospitalUser.findMany({ orderBy: { createdAt: "desc" }, select: { id, name, email, role, specialization, phone, licenseNumber, facilityId, accessToken, tokenIssuedAt, active, lastLoginAt, createdAt, facility: { select: { id: true, name: true } } } })` and `prisma.facility.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })`. Map users to omit `accessToken` and add `tokenPrefix = accessToken.slice(0,8) + "…"`, and map all Date fields to ISO strings. Render the page header (mirror `src/app/admin/api-keys/page.tsx`: `<h1 className="text-2xl text-[#202124]">Hospital Users</h1>` + a description) and `<HospitalUsersClient users={...} facilities={...} />` inside `<div className="p-8 max-w-5xl">`.
      - Create `src/app/admin/hospital-users/hospital-users-client.tsx` (`"use client"`). Copy the helpers `CopyButton` and `timeAgo` verbatim from `src/app/admin/api-keys/api-keys-client.tsx`. State: `users`, `showForm`, `form` (name, email, password, role="doctor", specialization, phone, licenseNumber, facilityId=""), `loading`, `newToken` (string|null) + `showNewToken`, `editingId`, `editForm`, `resettingId`, `togglingId`, `deletingId`, `error`.
        - **Create form** (inline, shown by "New user" button): fields name, email, temporary password, role (native `<select>` with options doctor/specialist/nurse/admin), specialization, phone, license number, facility (native `<select>` from `facilities` prop with a leading empty "No facility" option). POST to `/api/admin/hospital-users`. On success: set `newToken` to `data.token`, show the token-reveal banner (green border, `Key` icon, eye toggle, `CopyButton`, "Copy this token now. It will not be shown again." — reuse the api-keys banner markup exactly), prepend the new user to `users`, reset the form.
        - **Token-reveal banner**: reuse the api-keys green banner block; swap the label text to "Your new hospital user token".
        - **Table** columns: Name, Email, Role, Specialization, Facility (facility.name or "—"), Last login (`timeAgo(lastLoginAt)`), Status (active→green "Active" badge like api-keys' ShieldCheck; inactive→gray "Disabled" badge), Actions. Header row style matches api-keys (`bg-gray-50`, uppercase tracking).
        - **Actions per row**: Edit (toggle `editingId` → show inline edit form with name, role, specialization, phone, license number, facility; PATCH `/api/admin/hospital-users/[id]`; update row), Disable/Enable toggle (PATCH `{ active: !active }`), Reset Token (POST `/api/admin/hospital-users/[id]/reset-token` → set `newToken` to the returned `data.token` and show the reveal banner), Delete (confirm dialog, DELETE). Mirror the api-keys button styling: border `border-gray-200 bg-white px-2.5 py-1 text-xs`, delete turns red on hover.
        - Styling rules (Google flat, no shadows): `border border-gray-200 bg-white` containers, `#1a73e8` primary buttons with `hover:bg-[#1557b0]`, `text-[#202124]` headings, `text-[#5f6368]` secondary. Use the existing `Input` and `Label` from `@/components/ui/input` and `@/components/ui/label`.
      Files: new `src/app/admin/hospital-users/page.tsx`; new `src/app/admin/hospital-users/hospital-users-client.tsx`.
      Verify: `npm run build` passes with no TS errors. (Manual smoke test: sign in to `/admin`, open `/admin/hospital-users`, create a user, confirm the token banner appears and the row is added.)

- [ ] 9. Add the "Hospital Users" nav item to the admin sidebar.
      What: In `src/components/admin/sidebar.tsx`, add `UserRound` to the `lucide-react` import list, and add `{ label: "Hospital Users", href: "/admin/hospital-users", icon: UserRound }` to `navItems` immediately AFTER the "API Keys" entry (before "Escalated Cases"). Do not change the `style={{ width: "224px" }}` fixed positioning or any other item.
      Files: edit `src/components/admin/sidebar.tsx`.
      Verify: `npm run build` passes with no TS errors. (`UserRound` is exported by `lucide-react@0.460.0`.)

- [ ] 10. Add the hospital-auth path to the CORS headers in `next.config.ts`.
       What: Add a new block to the `headers()` array in `next.config.ts`:
       ```
       {
         source: "/api/v1/hospital-auth/:path*",
         headers: [
           { key: "Access-Control-Allow-Origin", value: "*" },
           { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
           { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Hospital-Token, X-API-Key" },
           { key: "Access-Control-Max-Age", value: "86400" },
         ],
       },
       ```
       Note `X-Hospital-Token` is added to allowed headers (used by the verify endpoint). Place it before or after the existing `/api/v1/:path*` block; both are evaluated by Next.
       Files: edit `next.config.ts`.
       Verify: `npm run build` passes with no TS errors.

- [ ] 11. Final verification — apply the schema and run the production build.
       What: Run `npx prisma db push` (must report in-sync, exit 0) then `npm run build` (must complete with zero TypeScript errors). Record the exact commands and their results in the final report.
       Files: no file changes; verification only.
       Verify: `npx prisma db push` exits 0; `npm run build` exits 0 with no TS errors. If the build fails, fix the reported errors before committing.

- [ ] 12. Commit all changes.
       What: Stage the new and modified files (the 5 new routes, the 2 new GUI files, `prisma/schema.prisma`, `src/lib/api-auth.ts`, `src/components/admin/sidebar.tsx`, `next.config.ts`) and commit with message `feat: hospital user accounts — admin CRUD, desktop app auth endpoint, token-based access`. Do not push.
       Files: git only.
       Verify: `git status` shows a clean working tree after the commit and `git log -1 --pretty=%s` prints the commit message.
