import crypto from "crypto";

/**
 * Generate a human-readable tracking ID for diagnosis reports.
 * Format: ENT-YYYY-XXXXXXXX (e.g. ENT-2026-A3F9C2D1)
 * Short enough to share verbally or via SMS.
 */
export function generateTrackingId(): string {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `ENT-${year}-${random}`;
}
