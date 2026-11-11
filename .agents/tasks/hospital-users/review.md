# Review — Hospital / Doctor Account Management

Reviewed the committed diff (commit `e30813a`) against the approved plan and the
recorded verification evidence. Build/schema evidence was read from
`verification.md` (not re-run): `npx prisma db push` PASS (exit 0, client
regenerated) and `npm run build` PASS (exit 0, zero TS errors, all 6 new routes
registered).

## Evidence per requirement

- **Schema** (`prisma/schema.prisma`): `HospitalUser` model matches the plan
  field-for-field (`id`, `name`, `email @unique`, `passwordHash`, `role @default("doctor")`,
  `specialization?`, `phone?`, `licenseNumber?`, `facilityId?`, `facility Facility? @relation`,
  `accessToken @unique`, `tokenIssuedAt`, `active @default(true)`, `lastLoginAt?`, `createdAt`,
  `updatedAt`). `Facility` has the `users HospitalUser[]` reverse relation, placed after
  `services FacilityService[]`. Correct.
- **Token generation/storage** (admin POST + reset-token): both use
  `"hu_" + crypto.randomBytes(32).toString("hex")` (67 chars), stored plaintext in `accessToken`.
  The full `token` is returned only in the POST-create (201) and reset-token responses; every
  list/get response returns `tokenPrefix = accessToken.slice(0, 8) + "…"` and never the raw token.
  Correct.
- **Passwords** (admin POST): `await bcrypt.hash(password, 10)` (10 rounds). `passwordHash` is
  absent from every `select`/response map in admin GET, GET/:id, PATCH and the login/verify
  responses. Never returned. Correct.
- **Admin auth guard**: all five admin handlers (list GET, POST, item GET/PATCH/DELETE,
  reset-token POST) open with `const session = await auth(); if (!session) return ... 401`,
  matching the existing convention. List/item responses omit `passwordHash`/`accessToken`,
  surfacing `tokenPrefix` only. Correct.
- **Login** (`/api/v1/hospital-auth`): no `checkApiKey` import or call. Validates email/password
  are strings → 400 "email and password are required." Credentials verified before active state
  (wrong password → 401 `INVALID_CREDENTIALS` regardless of disabled state; correct password +
  disabled → 403 `ACCOUNT_DISABLED`), with a dummy bcrypt compare when the user is absent to avoid
  a user-enumeration timing signal. Success shape matches the plan (`token`, `user{...}`,
  `tokenIssuedAt` ISO, `instructions`). `OPTIONS()` returns 200 with the documented CORS headers.
  Correct.
- **Verify** (`/api/v1/hospital-auth/verify`): reads `x-hospital-token` OR `Authorization: Bearer`
  (`/^Bearer\s+(.+)$/i`); missing → 401 `INVALID_CREDENTIALS`. Looks up
  `findUnique({ where: { accessToken, active: true } })`; null → same 401. Returns the user shape
  without echoing the token. Correct.
- **checkApiKey** (`src/lib/api-auth.ts`): a `providedKey.startsWith("hu_")` branch is inserted
  before the existing ApiKey logic. It does `findUnique({ where: { accessToken, active: true },
  select: { id } })`, returns `unauthorized()` on null, updates `lastLoginAt` (not `lastUsedAt`) on
  success, and returns `null` (valid). The existing `ent_` bcrypt path below is untouched. Correct.
- **Admin GUI** (`page.tsx` + `hospital-users-client.tsx`): `force-dynamic` server page fetches
  users + facilities, maps all `DateTime` fields to ISO strings (avoiding non-serializable Date
  objects in the client payload), omits `accessToken` → `tokenPrefix`. Client reuses the api-keys
  `CopyButton`/`timeAgo` verbatim and the green-border token-reveal banner (label swapped to "Your
  new hospital user token"), flat `border border-gray-200` table, `#1a73e8`/`hover:bg-[#1557b0]`
  buttons, no shadows, native `<select>` for role/facility. Create/edit/toggle/reset-token/delete
  wired to the admin routes. Correct.
- **Sidebar** (`src/components/admin/sidebar.tsx`): `UserRound` imported and
  `{ label: "Hospital Users", href: "/admin/hospital-users", icon: UserRound }` inserted after
  "API Keys", before "Escalated Cases". `width: 224px` unchanged. Correct.
- **CORS** (`next.config.ts`): a `/api/v1/hospital-auth/:path*` block is added with
  `X-Hospital-Token` in `Access-Control-Allow-Headers`. Correct.

## One judgment call considered and resolved (not a blocker)

A narrow spot-check showed every existing `src/app/api/v1/*` route defines its own
`export async function OPTIONS`; the new `verify` route is the only v1 route without one. A
browser-context cross-origin caller sending `X-Hospital-Token` would trigger a CORS preflight,
and without an OPTIONS handler Next returns 405, which would block the GET. This was considered
as a possible reachable correctness failure and rejected:

- The approved plan explicitly specifies an `OPTIONS` handler for the **login** endpoint
  (item 5) and deliberately omits it for **verify** (item 6). The review focus list likewise
  requires OPTIONS only for login. The omission is an approved scope decision, not a code defect.
- The only intended consumer is the desktop app, which is unbuilt future work; whether it issues
  browser-context cross-origin requests (and thus triggers a preflight) is unknown. Per the
  review rules ("Do not file speculative future problems"; "Honor approved behavior and
  trade-offs"), a preflight failure that depends on an unbuilt client's architecture is speculative,
  not a present reachable failure. No current caller hits `verify`.

This is noted for the record, not filed as a blocker.

## Verification evidence

`npx prisma db push` PASS (exit 0, client regenerated so `prisma.hospitalUser` typed) and
`npm run build` PASS (exit 0, zero TypeScript errors) per `verification.md`. Both required gates
are recorded as passing. The `findUnique({ where: { accessToken, active: true } })` extended-unique
filter type-checks against the regenerated client (build had zero TS errors), so that Prisma 5.22
usage is confirmed valid.

## Verdict

No blocking findings. The change meets every approved requirement and introduces no reachable
correctness, security, or data failure.
