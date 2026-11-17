import { z } from "zod";
import { forwardEntRequest, invalidRequest, readJsonBody } from "@/lib/ent-service";

const escalationSchema = z.object({
  caseId: z.string().trim().min(1).max(200),
  consent: z.boolean(),
  email: z.string().email().optional(),
}).refine(
  (value) => !value.consent || Boolean(value.email),
  "An email is required to consent to specialist follow-up.",
);

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (body.error) return invalidRequest(body.error);

  const parsed = escalationSchema.safeParse(body.data);
  if (!parsed.success) {
    return invalidRequest(parsed.error.issues[0]?.message ?? "Invalid consent request.");
  }

  const { caseId, ...payload } = parsed.data;
  return forwardEntRequest(`/escalation/${encodeURIComponent(caseId)}/consent`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
