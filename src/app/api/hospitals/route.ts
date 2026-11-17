import { z } from "zod";
import { forwardEntRequest, invalidRequest, readJsonBody } from "@/lib/ent-service";

const nearbySchema = z.object({
  mode: z.literal("nearby"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  place: z.string().trim().min(1).max(250).optional(),
  radiusKm: z.number().min(1).max(500).optional(),
  specialty: z.string().trim().max(100).optional(),
  onlyAccredited: z.boolean().optional(),
  limit: z.number().int().min(1).max(20).optional(),
}).refine(
  (value) =>
    Boolean(value.place) ||
    (typeof value.latitude === "number" && typeof value.longitude === "number"),
  "Provide a place name or both location coordinates.",
).refine(
  (value) =>
    (typeof value.latitude === "number") === (typeof value.longitude === "number"),
  "Latitude and longitude must be supplied together.",
);

const reportSchema = z.object({
  mode: z.literal("report"),
  primaryCondition: z.string().trim().min(1).max(250),
  specialists: z.array(z.string().trim().min(1).max(100)).max(20),
  urgencyScore: z.number().min(1).max(10),
  requiredServices: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  place: z.string().trim().min(1).max(250).optional(),
  radiusKm: z.number().min(1).max(500).optional(),
  limit: z.number().int().min(1).max(20).optional(),
  onlyAccredited: z.boolean().optional(),
}).refine(
  (value) =>
    Boolean(value.place) ||
    (typeof value.latitude === "number" && typeof value.longitude === "number"),
  "Provide a place name or both location coordinates.",
).refine(
  (value) =>
    (typeof value.latitude === "number") === (typeof value.longitude === "number"),
  "Latitude and longitude must be supplied together.",
);

const hospitalsSchema = z.union([nearbySchema, reportSchema]);

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (body.error) return invalidRequest(body.error);

  const parsed = hospitalsSchema.safeParse(body.data);
  if (!parsed.success) {
    return invalidRequest(parsed.error.issues[0]?.message ?? "Invalid hospital search details.");
  }

  const { mode, ...payload } = parsed.data;
  return forwardEntRequest(mode === "report" ? "/nearby-for-report" : "/nearby", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
