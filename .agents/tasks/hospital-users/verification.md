# Verification — Hospital / Doctor Account Management

Verification was run locally on macOS (darwin). Both gates must pass before commit.

## 1. Prisma schema apply

**Command:**
```
npx prisma db push
```

**Result: PASS (exit code 0)**

Output (excerpt):
```
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "neondb", schema "public" at "...neon.tech"
🚀  Your database is now in sync with your Prisma schema. Done in 8.54s
Running generate... - Prisma Client
✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in 481ms
```

This both created the `HospitalUser` table (with the `users` reverse relation on
`Facility`) and regenerated `@prisma/client`, so `prisma.hospitalUser` became
available before any backend code referencing it was compiled.

## 2. Production build

**Command:**
```
npm run build
```
(`package.json` has no `test` script, so the production build is the gate.)

**Result: PASS (exit code 0, zero TypeScript errors)**

Key output:
```
> next build
▲ Next.js 15.3.9
✓ Compiled successfully in 51s
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages (20/20)
✓ Collecting build traces
✓ Finalizing page optimization
```

Newly registered routes (all compiled, no errors):
```
ƒ /admin/hospital-users                            5.07 kB   117 kB
ƒ /api/admin/hospital-users                         212 B    102 kB
ƒ /api/admin/hospital-users/[id]                   212 B    102 kB
ƒ /api/admin/hospital-users/[id]/reset-token       212 B    102 kB
ƒ /api/v1/hospital-auth                             212 B    102 kB
ƒ /api/v1/hospital-auth/verify                      212 B    102 kB
```

No errors were encountered during the build, so no fixes were required. The
first `npm run build` run after the schema push succeeded.

## Notes

- `npx prisma db push` was run BEFORE any code referencing `prisma.hospitalUser`
  was written, per the critical ordering requirement. The Prisma client
  regenerated successfully, so all five backend routes and the admin page
  type-checked against the new model.
- `checkApiKey` in `src/lib/api-auth.ts` was extended (not replaced): a `hu_`
  prefix branch was inserted before the existing bcrypt `ApiKey` logic, which
  is untouched. Existing `ent_` keys still follow the original path.
- The admin GUI reuses the token-reveal banner, `CopyButton`, and `timeAgo`
  helpers from `src/app/admin/api-keys/api-keys-client.tsx`, with the label
  swapped to "Your new hospital user token".
- No `.env` files or secrets were staged.
