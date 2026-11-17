import { z } from "zod";
import { forwardEntRequest, invalidRequest, readJsonBody } from "@/lib/ent-service";

const imageSchema = z.object({
  imageBase64: z.string().min(1).max(5_600_000),
  imageType: z.enum(["ear", "nose", "throat", "general"]),
  additionalContext: z.string().trim().max(3000).optional(),
  consent: z.literal(true),
});

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (body.error) return invalidRequest(body.error);

  const parsed = imageSchema.safeParse(body.data);
  if (!parsed.success) {
    return invalidRequest(parsed.error.issues[0]?.message ?? "Invalid image analysis request.");
  }

  const { consent: _consent, ...payload } = parsed.data;
  return forwardEntRequest("/analyze-image", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
