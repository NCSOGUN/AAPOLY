import { z } from "zod";
import { forwardEntRequest, invalidRequest } from "@/lib/ent-service";
import { normalizeNigerianPhone } from "@/lib/nigerian-phone";

const reportIdSchema = z.string().regex(
  /^(?:ENT-\d{4}-[A-Z0-9]{6,12}|\+234\d{10}-[A-Z0-9]{6})$/i,
);

export async function GET(
  _request: Request,
  { params }: { params: { trackingId: string } },
) {
  const phone = normalizeNigerianPhone(params.trackingId);
  const parsedId = reportIdSchema.safeParse(params.trackingId);
  let lookupId: string;
  if (phone) {
    lookupId = phone;
  } else if (parsedId.success) {
    lookupId = parsedId.data;
  } else {
    return invalidRequest(
      "Enter a valid Nigerian mobile number or report ID, for example 09154996570 or ENT-2026-A3F9C2D1.",
    );
  }

  return forwardEntRequest(`/reports/${encodeURIComponent(lookupId)}`, {
    method: "GET",
  });
}
