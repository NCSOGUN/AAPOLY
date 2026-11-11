# Implementation Plan — ENT Service API Enhancements

## Key Decisions

1. **Gemini SDK already installed**: `@google/generative-ai@^0.21.0` is in `package.json` — no install needed. Use the SDK (`GoogleGenerativeAI`) not the REST API, matching the project's pattern of using official SDKs.
2. **Gemini helper lives in `src/lib/ai-matching.ts`**: The file exports Groq functions; the new `callGeminiFullAnalysis()` and `callGeminiImageAnalysis()` functions are added at the bottom. The existing Groq code is untouched.
3. **EscalatedCase goes in schema.prisma then `prisma db push`**: The project uses `prisma db push` for schema changes (`npm run db:push`), not `prisma migrate`.
4. **Admin route auth pattern**: All existing admin API routes call `const session = await auth()` from `@/lib/auth`, then return 401 if null. New admin routes follow this exact pattern.
5. **Complexity detection**: All five criteria are evaluated after Step 2 (AI analysis) and Step 3 (primary condition). The `escalation` field is always present in the response (`isComplex: false` when not complex).
6. **`analysis.method = "ai_full_analysis"`**: Added to the existing `AnalysisMethod` union type in `analyze/route.ts`. The `analysis.aiStatus` field is added only at the top level of `data`, not nested inside `analysis`.
7. **Admin CORS**: `next.config.ts` already covers `/api/v1/:path*`. Add a second entry for `/api/admin/:path*` with the same headers.
8. **Docs page**: The file is a large server component. Add new sections inline as `<EndpointSection>` blocks following the exact same JSX pattern already in use. Update `sidebar.tsx` sections array.

---

## Ordered Steps

- [ ] 1. Add Gemini helper functions to `src/lib/ai-matching.ts`
      Add two new exported async functions at the bottom of the file. Do NOT touch any existing Groq code.
      - `callGeminiFullAnalysis(symptoms: string): Promise<GeminiFullAnalysisResult>` — calls `gemini-1.5-flash-latest` with the prompt specified in the task. Returns `{ condition: string, urgencyScore: number, immediateAdvice: string, redFlags: string[], specialists: string[] }`. Throws typed errors with codes `AI_QUOTA_EXCEEDED`, `AI_TIMEOUT`, `AI_UNAVAILABLE`, `AI_ERROR`.
      - `callGeminiImageAnalysis(imageBase64: string, imageType: string, additionalContext?: string): Promise<GeminiImageAnalysisResult>` — calls the same model using `inlineData` part. Returns the parsed JSON matching the image analysis response shape.
      - Both use `new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)`. Map HTTP 429 → `AI_QUOTA_EXCEEDED`, network timeout → `AI_TIMEOUT`, auth/key errors (401/403) → `AI_UNAVAILABLE`, everything else → `AI_ERROR`.
      Files: `src/lib/ai-matching.ts`
      Verify: `npm run build` — TypeScript compiles with no new errors.

- [ ] 2. Add `EscalatedCase` model to Prisma schema and push
      Append the model block from the task spec verbatim to `prisma/schema.prisma`. Then run `npm run db:push` to apply to the database and regenerate the Prisma client.
      Files: `prisma/schema.prisma`
      Verify: `npm run db:push` succeeds; `npx prisma generate` produces updated client with `prisma.escalatedCase`.

- [ ] 3. Update the `/api/v1/analyze` route with Gemini fallback + escalation
      Modify `src/app/api/v1/analyze/route.ts`:
      - Extend `AnalysisMethod` type to include `"ai_full_analysis"`.
      - Add `aiStatus?: { available: boolean; code?: string; message?: string }` to the `AnalyzeResponse.data` shape.
      - Add `escalation` field to `AnalyzeResponse.data` (see shape below).
      - After `matchConditions()`, check: if `localMatches.length === 0` OR `localMatches[0].score < 30`, call `callGeminiFullAnalysis(clinicalText)`. On success, set `analysisMethod = "ai_full_analysis"` and merge AI output into `clinical` fields. On error, set `analysis.aiStatus` with the error code and message, set `analysisMethod = "fallback"`.
      - Complexity check (ANY triggers escalation):
        1. `urgencyScore >= 8`
        2. Top 3 differentials all within 15 score points of each other (and at least 3 exist)
        3. AI confidence is low AND dataset confidence is "low"
        4. `symptoms.trim().length > 300`
        5. `analysisMethod === "fallback"`
      - If complex: create `prisma.escalatedCase` record with all available fields, add `escalation: { isComplex: true, caseId, message: "Your case requires specialist attention. We'll keep your records for a specialist review — you may request to share it." }` to response.
      - If not complex: add `escalation: { isComplex: false }` to response.
      - Return appropriate HTTP status for AI errors: 429 for `AI_QUOTA_EXCEEDED`, 200 for all others (the error info is in `aiStatus`; the endpoint still returns partial results).
      Files: `src/app/api/v1/analyze/route.ts`
      Verify: `npm run build` — no TypeScript errors.

- [ ] 4. Create the image analysis endpoint
      Create `src/app/api/v1/analyze-image/route.ts`:
      - POST handler: call `checkApiKey(req)` first.
      - Parse body: `{ imageBase64: string, imageType: "ear"|"nose"|"throat"|"general", additionalContext?: string }`.
      - Validate base64: strip the data URL prefix (`data:image/...;base64,`), check the resulting string is valid base64 (regex: `/^[A-Za-z0-9+/]+=*$/`), reject with `{ status: "error", code: "INVALID_BASE64", message: "..." }` and 400 if invalid.
      - Size check: `Buffer.from(stripped, "base64").length > 4 * 1024 * 1024` → reject with `{ status: "error", code: "IMAGE_TOO_LARGE", message: "Image must be under 4MB." }` and 413.
      - Call `callGeminiImageAnalysis(imageBase64, imageType, additionalContext)`. On error return `{ status: "error", code: "IMAGE_ANALYSIS_FAILED", message: "..." }` and 500 (or 429 for quota).
      - On success return: `{ status: "success", data: { imageType, analysis: { findings, possibleConditions, urgencyScore, nextSteps, specialistReviewNeeded }, disclaimer, consentNotice: "Your uploaded image may be retained for clinical quality improvement. By submitting, you acknowledge this.", referenceId: "img_" + nanoid, processedAt } }`.
      - OPTIONS handler returning CORS headers.
      Files: `src/app/api/v1/analyze-image/route.ts`
      Verify: `npm run build` — no TypeScript errors.

- [ ] 5. Create escalation consent endpoint
      Create `src/app/api/v1/escalation/[id]/consent/route.ts`:
      - POST handler: call `checkApiKey(req)` first.
      - Parse body: `{ consent: boolean, email?: string }`.
      - Look up `prisma.escalatedCase.findUnique({ where: { id } })`. Return 404 if not found.
      - If `consent === true`: update `consentGiven = true`, save `patientEmail = email ?? null`, update `status = "pending"` (stays pending, now consented).
      - If `consent === false`: update `status = "closed"`.
      - Return `{ status: "success", data: { id, consentGiven, status } }`.
      - OPTIONS CORS handler.
      Files: `src/app/api/v1/escalation/[id]/consent/route.ts`
      Verify: `npm run build` — no TypeScript errors.

- [ ] 6. Create admin escalated-cases API routes
      Create two admin routes following the exact auth pattern from `src/app/api/admin/api-keys/route.ts` (call `auth()`, return 401 if null).

      **`src/app/api/admin/escalated-cases/route.ts`** — GET handler:
      - Accept optional `?status=pending|under_review|responded|closed` query param.
      - Query `prisma.escalatedCase.findMany({ where: status ? { status } : undefined, orderBy: { createdAt: "desc" } })`.
      - Return `{ status: "success", data: cases }`.

      **`src/app/api/admin/escalated-cases/[id]/route.ts`** — PATCH handler:
      - Parse body: `{ specialistNotes?: string, status?: string }`.
      - Update `prisma.escalatedCase.update({ where: { id }, data: { specialistNotes, status, updatedAt: new Date() } })`.
      - Return `{ status: "success", data: updated }`. Return 404 if record not found.

      Files:
      - `src/app/api/admin/escalated-cases/route.ts`
      - `src/app/api/admin/escalated-cases/[id]/route.ts`
      Verify: `npm run build` — no TypeScript errors.

- [ ] 7. Create the admin escalated-cases page (server + client components)
      Follow the pattern from `src/app/admin/api-keys/page.tsx` + `api-keys-client.tsx` exactly.

      **`src/app/admin/escalated-cases/page.tsx`** — server component:
      - `export const dynamic = "force-dynamic"`
      - Fetch all escalated cases from `prisma.escalatedCase.findMany({ orderBy: { createdAt: "desc" } })`.
      - Serialize dates to ISO strings before passing to client component.
      - Render `<EscalatedCasesClient cases={...} />`.

      **`src/app/admin/escalated-cases/escalated-cases-client.tsx`** — client component:
      - Status filter buttons: All / Pending / Under Review / Responded / Closed. Active filter applies `?status=` query to the list.
      - Table columns: Symptoms snippet (first 80 chars), Status badge, Consent, Created.
      - Status badges (Google flat, no shadows, no rounded-xl):
        - `pending` → yellow border + bg: `border-yellow-200 bg-yellow-50 text-yellow-700`
        - `under_review` → `border-blue-200 bg-blue-50 text-[#1a73e8]`
        - `responded` → `border-green-200 bg-green-50 text-green-700`
        - `closed` → `border-gray-200 bg-gray-100 text-gray-500`
      - Click row to expand: show full `analysisResult` JSON, `specialistNotes` textarea, Status dropdown, Save button (calls PATCH endpoint).
      - `border-gray-200`, no `shadow`, no `rounded-xl`, primary `#1a73e8`.

      Files:
      - `src/app/admin/escalated-cases/page.tsx`
      - `src/app/admin/escalated-cases/escalated-cases-client.tsx`
      Verify: `npm run build` — no TypeScript errors.

- [ ] 8. Add "Escalated Cases" to the admin sidebar
      In `src/components/admin/sidebar.tsx`, add `AlertCircle` to the lucide-react import, then add `{ label: "Escalated Cases", href: "/admin/escalated-cases", icon: AlertCircle }` to the `navItems` array after the "API Keys" entry.
      Files: `src/components/admin/sidebar.tsx`
      Verify: `npm run build` — no TypeScript errors.

- [ ] 9. Add CORS headers for admin routes in `next.config.ts`
      The existing config covers `/api/v1/:path*`. Append a second entry in the `headers()` array for `/api/admin/:path*` with the identical four CORS headers. No change to the v1 entry.
      Files: `next.config.ts`
      Verify: `npm run build` — no TypeScript errors.

- [ ] 10. Update `/docs` page and sidebar
       In `src/app/docs/page.tsx`, add four new `<EndpointSection>` blocks after the existing match-by-diagnosis section, in this order:
       1. **POST /api/v1/analyze** — request fields table (symptoms, affectedArea, duration, onsetPattern, age, additionalContext, latitude, longitude, place, includeNearby, radiusKm, limit), example request/response including `escalation` field, `analysis.aiStatus` explanation.
       2. **POST /api/v1/analyze-image** — base64 format note, imageType values, 4MB limit, consent notice text, example request/response.
       3. **POST /api/v1/nearby-for-report** — docs for the find-hospital-after-analysis endpoint (exists at `src/app/api/v1/nearby-for-report/`).
       4. **POST /api/v1/escalation/:id/consent** — consent flow explanation, body fields, response shape.

       In `src/components/docs/sidebar.tsx`, add four child entries under the `endpoints` section:
       - `{ id: "analyze", label: "POST /analyze" }`
       - `{ id: "analyze-image", label: "POST /analyze-image" }`
       - `{ id: "nearby-for-report", label: "POST /nearby-for-report" }`
       - `{ id: "escalation-consent", label: "POST /escalation/:id/consent" }`

       Maintain the `headers()` dynamic base URL pattern throughout — reuse `baseUrl` for all code examples.
       Files:
       - `src/app/docs/page.tsx`
       - `src/components/docs/sidebar.tsx`
       Verify: `npm run build` — no TypeScript errors.

- [ ] 11. Final build verification
       Run `npm run build` from `/Users/apple/Documents/ent-location-sys`. All pages should compile. Fix any TypeScript or import errors discovered.
       Files: (none — verification only)
       Verify: `npm run build` exits 0.
