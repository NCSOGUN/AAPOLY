import { z } from "zod";
import { forwardEntRequest, invalidRequest } from "@/lib/ent-service";

const trackingIdSchema = z.string().regex(/^ENT-\d{4}-[A-Z0-9]{6,12}$/i);

export async function GET(
  _request: Request,
  { params }: { params: { trackingId: string } },
) {
  const parsed = trackingIdSchema.safeParse(params.trackingId);
  if (!parsed.success) {
    return invalidRequest("Enter a valid report ID, for example ENT-2026-A3F9C2D1.");
  }

  return forwardEntRequest(`/reports/${encodeURIComponent(parsed.data)}`, {
    method: "GET",
  });
}
