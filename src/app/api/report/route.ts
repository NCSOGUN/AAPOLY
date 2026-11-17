import { z } from "zod";
import { forwardEntRequest, invalidRequest, readJsonBody } from "@/lib/ent-service";

const reportSchema = z.object({
  symptoms: z.string().trim().min(1).max(5000),
  affectedArea: z.enum(["ear", "nose", "throat"]).optional(),
  duration: z.string().trim().max(100).optional(),
  age: z.number().int().min(0).max(120).optional(),
  analysisResult: z.record(z.unknown()),
  primaryConditionId: z.string().optional(),
  primaryConditionName: z.string().optional(),
  urgencyScore: z.number().min(1).max(10).optional(),
  urgencyLevel: z.enum(["Emergency", "Urgent", "Soon", "Routine"]).optional(),
  referralThreshold: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  patientProfileId: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (body.error) return invalidRequest(body.error);

  const parsed = reportSchema.safeParse(body.data);
  if (!parsed.success) {
    return invalidRequest(parsed.error.issues[0]?.message ?? "Invalid report details.");
  }

  return forwardEntRequest("/reports", {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });
}
