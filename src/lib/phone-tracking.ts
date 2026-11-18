/**
 * Phone-based tracking ID system — inspired by OPay
 *
 * A patient's phone number IS their tracking ID.
 * They don't need to remember a code — just their own number.
 * All their reports are retrieved by phone number.
 *
 * Validation follows NCC (Nigerian Communications Commission) standards:
 * - 11-digit national format:      0803XXXXXXX
 * - 13-digit international format: +234803XXXXXXX or 234803XXXXXXX
 * - Includes all 2024 NCC-approved prefixes across MTN, Airtel, Glo, 9mobile, MVNOs
 */

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Valid Nigerian mobile prefixes (4-digit, after leading 0 or +234).
 * Source: NCC Nigeria 2024 — includes new prefixes (0904, 0911-0916, 0707).
 *
 * MTN:    0703, 0706, 0803, 0806, 0810, 0813, 0814, 0816, 0903, 0906, 0913, 0916
 * Airtel: 0701, 0708, 0802, 0808, 0812, 0901, 0902, 0904, 0907, 0911, 0912
 * Glo:    0705, 0805, 0807, 0811, 0815, 0905, 0915
 * 9mobile:0809, 0817, 0818, 0908, 0909
 * Others: 0702, 0707, 0804
 *
 * Regex structure: ^(?:\+?234|0)(PREFIXES)\d{7}$
 * PREFIXES match the 3 digits after the leading 0 (e.g. "803" for 0803).
 */
const NG_PHONE_REGEX =
  /^(?:\+?234|0)(70[1-9]|80[2-9]|81[0-9]|90[1-9]|91[1-6])\d{7}$/;

/**
 * Validate a Nigerian mobile number.
 * Accepts: 09154996570, 08053308736, +2349154996570, 2349154996570
 * Rejects: toll-free (0800), landlines, too short, invalid prefix
 */
export function isValidNigerianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-().+]/g, "");
  // Re-add + for regex if needed
  const normalized =
    cleaned.startsWith("234") ? `+${cleaned}` :
    cleaned.startsWith("0")   ? cleaned :
    cleaned;
  return NG_PHONE_REGEX.test(normalized.startsWith("+") ? normalized : `+${normalized.replace(/^\+/, "")}`);
}

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * Normalize any valid Nigerian phone number to E.164 international format.
 * 09154996570   → +2349154996570
 * 08053308736   → +2348053308736
 * 2348053308736 → +2348053308736
 *
 * Returns null if the number is invalid.
 */
export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, "");

  if (!isValidNigerianPhone(cleaned)) return null;

  if (cleaned.startsWith("0")) {
    return "+234" + cleaned.slice(1);
  }
  if (cleaned.startsWith("234")) {
    return "+" + cleaned;
  }
  if (cleaned.startsWith("+234")) {
    return cleaned;
  }

  return null;
}

/**
 * Display-format: +2349154996570 → 0915 499 6570
 * Used in SMS messages and UI display.
 */
export function formatPhoneDisplay(e164: string): string {
  // +234XXXXXXXXXX → 0XXXXXXXXXX
  const local = e164.replace(/^\+234/, "0");
  // 09154996570 → 0915 499 6570
  return local.replace(/^(\d{4})(\d{3})(\d{4})$/, "$1 $2 $3");
}

// ─── SMS Simulation ───────────────────────────────────────────────────────────

/**
 * Compose the demo SMS message that would be sent when a report is saved.
 *
 * SMS gateway (Termii / Twilio) is not yet configured.
 * This produces a realistic static simulation for testing and demo.
 * The static code "DEMO-ENT-2026" is what the system uses to recognize
 * simulated deliveries vs real ones.
 *
 * In production, replace this with a real Termii/Paystack SMS API call.
 */
export function composeSmsMessage(params: {
  phone: string;              // normalized E.164: +2349154996570
  primaryCondition: string;   // "Middle Ear Infection"
  urgencyLevel: string;       // "Soon" | "Urgent" | "Emergency" | "Routine"
  createdAt: Date;
}): SimulatedSms {
  const { phone, primaryCondition, urgencyLevel, createdAt } = params;

  const displayPhone = formatPhoneDisplay(phone);

  const date = createdAt.toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  });

  const urgencyLine =
    urgencyLevel === "Emergency"
      ? "URGENT: Please seek emergency care immediately. Call 112."
      : urgencyLevel === "Urgent"
      ? "Please see a doctor today or tomorrow."
      : urgencyLevel === "Soon"
      ? "Please book a doctor appointment this week."
      : "Book an ENT appointment at your convenience.";

  // This is exactly the SMS a patient would receive in production
  const message =
    `ENT-Care: Your report is ready.\n` +
    `Date: ${date}\n` +
    `Finding: ${primaryCondition}\n` +
    `Advice: ${urgencyLine}\n\n` +
    `Use your number ${displayPhone} to retrieve your report anytime:\n` +
    `ent-server.hostl.cloud/report\n\n` +
    `ENT-Care AI | AAPOLY`;

  return {
    to: phone,
    displayTo: displayPhone,
    message,
    simulationCode: "DEMO-ENT-2026",
    isSimulated: true,
    note: "SMS gateway (Termii/Twilio) not yet configured. This is what will be sent in production. Use your phone number as the report ID.",
    wouldSendAt: createdAt.toISOString(),
  };
}

export interface SimulatedSms {
  to: string;           // E.164 format: +2349154996570
  displayTo: string;    // Human format: 0915 499 6570
  message: string;      // Full SMS text
  simulationCode: string;
  isSimulated: true;
  note: string;
  wouldSendAt: string;
}

// ─── Network Lookup (for display / info only) ─────────────────────────────────

const PREFIX_NETWORK: Record<string, string> = {
  "703": "MTN", "706": "MTN", "803": "MTN", "806": "MTN",
  "810": "MTN", "813": "MTN", "814": "MTN", "816": "MTN",
  "903": "MTN", "906": "MTN", "913": "MTN", "916": "MTN",
  "701": "Airtel", "708": "Airtel", "802": "Airtel", "808": "Airtel",
  "812": "Airtel", "901": "Airtel", "902": "Airtel", "904": "Airtel",
  "907": "Airtel", "911": "Airtel", "912": "Airtel",
  "705": "Glo", "805": "Glo", "807": "Glo", "811": "Glo",
  "815": "Glo", "905": "Glo", "915": "Glo",
  "809": "9mobile", "817": "9mobile", "818": "9mobile",
  "908": "9mobile", "909": "9mobile",
  "702": "Smile", "707": "ZoomMobile", "804": "Ntel",
};

/**
 * Returns the original network for a phone number prefix.
 * Note: Due to Mobile Number Portability (MNP), this may not reflect
 * the user's current network.
 */
export function getNetworkByPhone(e164: string): string {
  const local = e164.replace(/^\+234/, "0");
  const prefix = local.slice(1, 4); // "0915..." → "915"
  return PREFIX_NETWORK[prefix] ?? "Unknown";
}
