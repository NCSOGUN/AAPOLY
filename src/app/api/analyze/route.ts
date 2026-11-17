import { z } from "zod";
import { forwardEntRequest, invalidRequest, readJsonBody } from "@/lib/ent-service";

const analyzeSchema = z.object({
  symptoms: z.string().trim().min(1, "Describe what you are feeling.").max(5000),
  affectedArea: z.enum(["ear", "nose", "throat"]).optional(),
  duration: z.string().trim().max(100).optional(),
  age: z.number().int().min(0).max(120).optional(),
  additionalContext: z.string().trim().max(3000).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  place: z.string().trim().max(250).optional(),
}).refine(
  ({ latitude, longitude }) =>
    (latitude === undefined && longitude === undefined) ||
    (latitude !== undefined && longitude !== undefined),
  { message: "Share both location coordinates or neither." },
);

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (body.error) return invalidRequest(body.error);

  const parsed = analyzeSchema.safeParse(body.data);
  if (!parsed.success) {
    return invalidRequest(parsed.error.issues[0]?.message ?? "Invalid assessment details.");
  }

  return forwardEntRequest("/analyze", {
    method: "POST",
    body: JSON.stringify({ ...parsed.data, includeNearby: false, limit: 5 }),
  });
}
