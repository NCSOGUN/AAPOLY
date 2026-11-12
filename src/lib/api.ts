  import { isTauri } from "@tauri-apps/api/core";
  import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ?? "https://ent-server.hostl.cloud/api/v1";
  const DEVELOPMENT_API_KEY = import.meta.env.VITE_ENT_API_KEY;

export type HospitalFacility = {
  id: string;
  name: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  accredited?: boolean;
  specialties?: string[];
};

export type HospitalUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  specialization?: string;
  facilityId: string;
  facility: HospitalFacility;
};

export type HospitalSession = {
  token: string;
  user: HospitalUser;
  tokenIssuedAt?: string;
};

export type NearbyFacilitiesQuery = {
  primaryCondition: string;
  specialists: string[];
  urgencyScore: number;
  requiredServices: string[];
  latitude: number;
  longitude: number;
  radiusKm: number;
  limit: number;
};

export type NearbyFacility = {
  id?: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  distanceKm?: number;
  distance?: number | string;
  travelTimes?: Record<string, unknown> | string;
  specialties?: string[];
  accredited?: boolean;
};

export type DiagnosisRequest = {
  symptoms: string;
  affectedArea?: "ear" | "nose" | "throat" | "head_neck";
  duration?: string;
  onsetPattern?: "sudden" | "gradual" | "episodic" | "chronic";
  age?: number;
  additionalContext?: string;
  latitude?: number;
  longitude?: number;
  includeNearby: false;
  limit: number;
};

export type DiagnosisReportRequest = DiagnosisRequest & {
  analysisResult: Record<string, unknown>;
  primaryConditionId?: string;
  primaryConditionName?: string;
  urgencyScore?: number;
  urgencyLevel?: string;
  referralThreshold?: string;
  patientProfileId: null;
};

type ApiEnvelope<T> = {
  status: "success";
  data: T;
};

type ApiErrorPayload = {
  status?: "error";
  code?: string;
  message?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNearbyFacility(value: unknown): value is NearbyFacility {
  const travelTimes = isRecord(value) ? value.travelTimes : undefined;
  const validTravelTimes =
    travelTimes === undefined ||
    isRecord(travelTimes) ||
    (typeof travelTimes === "string" &&
      (() => {
        try {
          return isRecord(JSON.parse(travelTimes) as unknown);
        } catch {
          return false;
        }
      })());
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    (value.id === undefined || typeof value.id === "string") &&
    (value.address === undefined || typeof value.address === "string") &&
    (value.city === undefined || typeof value.city === "string") &&
    (value.state === undefined || typeof value.state === "string") &&
    (value.distanceKm === undefined ||
      (typeof value.distanceKm === "number" && Number.isFinite(value.distanceKm))) &&
    (value.distance === undefined ||
      (typeof value.distance === "number" && Number.isFinite(value.distance)) ||
      typeof value.distance === "string") &&
    validTravelTimes &&
    (value.specialties === undefined ||
      (Array.isArray(value.specialties) &&
        value.specialties.every((specialty) => typeof specialty === "string"))) &&
    (value.accredited === undefined || typeof value.accredited === "boolean")
  );
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiConnectionError";
  }
}

function notFoundMessage(path: string, method: string) {
  if (path.startsWith("/admin/escalated-cases") && method === "GET") {
    return "The escalated-cases service is not available in this environment. Contact your administrator if you need this feature enabled.";
  }
  if (path.startsWith("/reports/") && method === "GET") {
    return "No report was found for that tracking ID. Check the ID and try again.";
  }
  return "The requested record or service route could not be found. Check the details or contact your administrator.";
}

function apiFetch(url: string, init: RequestInit): Promise<Response> {
  return isTauri() ? tauriFetch(url, init) : fetch(url, init);
}

function apiKey(): string {
  if (!DEVELOPMENT_API_KEY?.trim()) {
    throw new Error(
      "The development API key is not configured. Copy .env.example to .env and set VITE_ENT_API_KEY.",
    );
  }
  return DEVELOPMENT_API_KEY.trim();
}

async function request<T>(
  path: string,
  token?: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-API-Key", token ?? apiKey());
  if (init.body) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await apiFetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiConnectionError(
      "Could not reach the ENT-Care service. Check the connection and retry.",
    );
  }

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = isRecord(body) ? (body as ApiErrorPayload) : undefined;
    const method = (init.method ?? "GET").toUpperCase();
    const message =
      response.status === 404
        ? notFoundMessage(path, method)
        : error?.code === "INVALID_CREDENTIALS"
        ? "The email or password is incorrect."
        : error?.code === "ACCOUNT_DISABLED"
          ? "This hospital account is disabled. Contact the ENT-Care administrator."
          : error?.message ?? `The service returned an error (${response.status}).`;
    throw new ApiError(message, response.status, error?.code);
  }

  if (!body || typeof body !== "object" || !("data" in body)) {
    throw new Error("The ENT-Care service returned an invalid response.");
  }
  return (body as ApiEnvelope<T>).data;
}

export async function hospitalLogin(
  email: string,
  password: string,
): Promise<HospitalSession> {
  const result = await request<HospitalSession>("/hospital-auth", undefined, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (
    !result.token?.startsWith("hu_") ||
    !result.user?.id ||
    !result.user.facility?.id
  ) {
    throw new Error("The sign-in response is missing required account details.");
  }
  return result;
}

export async function verifyHospitalSession(token: string): Promise<HospitalUser> {
  const headers = new Headers({
    "X-API-Key": apiKey(),
    "X-Hospital-Token": token,
  });
  let response: Response;
  try {
    response = await apiFetch(`${API_BASE_URL}/hospital-auth/verify`, { headers });
  } catch {
    throw new ApiConnectionError(
      "Could not reach the ENT-Care service. Check the connection and retry.",
    );
  }

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = body as ApiErrorPayload | undefined;
    throw new ApiError(
      error?.message ?? "The saved hospital session is no longer valid.",
      response.status,
      error?.code,
    );
  }
  if (!body || typeof body !== "object" || !("data" in body)) {
    throw new Error("The ENT-Care service returned an invalid verification response.");
  }
  return (body as ApiEnvelope<HospitalUser>).data;
}

export async function getPatientReport(
  token: string,
  trackingId: string,
): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(
    `/reports/${encodeURIComponent(trackingId.trim())}`,
    token,
  );
}

export async function analyzePatient(
  token: string,
  diagnosis: DiagnosisRequest,
): Promise<Record<string, unknown>> {
  const result: unknown = await request("/analyze", token, {
    method: "POST",
    body: JSON.stringify(diagnosis),
  });
  if (!isRecord(result) || !isRecord(result.analysis) || !isRecord(result.clinical)) {
    throw new Error("The ENT-Care service returned an invalid clinical analysis response.");
  }
  return result;
}

export async function analyzeClinicalImage(
  token: string,
  imageBase64: string,
  imageType: "ear" | "nose" | "throat" | "general",
  additionalContext: string,
): Promise<Record<string, unknown>> {
  const result: unknown = await request("/analyze-image", token, {
    method: "POST",
    body: JSON.stringify({ imageBase64, imageType, additionalContext }),
  });
  if (!isRecord(result) || !isRecord(result.analysis)) {
    throw new Error("The ENT-Care service returned an invalid image analysis response.");
  }
  return result;
}

export async function saveDiagnosisReport(
  token: string,
  report: DiagnosisReportRequest,
): Promise<{ trackingId: string; createdAt?: string; message?: string }> {
  const result: unknown = await request("/reports", token, {
    method: "POST",
    body: JSON.stringify(report),
  });
  if (!isRecord(result) || typeof result.trackingId !== "string" || !result.trackingId) {
    throw new Error("The ENT-Care service saved an invalid report response.");
  }
  return {
    trackingId: result.trackingId,
    ...(typeof result.createdAt === "string" ? { createdAt: result.createdAt } : {}),
    ...(typeof result.message === "string" ? { message: result.message } : {}),
  };
}

export async function consentToEscalation(
  token: string,
  caseId: string,
  email?: string,
): Promise<Record<string, unknown>> {
  const result: unknown = await request(
    `/escalation/${encodeURIComponent(caseId)}/consent`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        consent: true,
        ...(email?.trim() ? { email: email.trim() } : {}),
      }),
    },
  );
  if (!isRecord(result)) {
    throw new Error("The ENT-Care service returned an invalid escalation response.");
  }
  return result;
}

export async function findNearbyReferralFacilities(
  token: string,
  query: NearbyFacilitiesQuery,
): Promise<{ facilities: NearbyFacility[]; query?: Record<string, unknown> }> {
  const result: unknown = await request("/nearby-for-report", token, {
    method: "POST",
    body: JSON.stringify(query),
  });
  if (!isRecord(result) || !Array.isArray(result.facilities)) {
    throw new Error("The ENT-Care service returned an invalid facility search response.");
  }
  if (!result.facilities.every(isNearbyFacility)) {
    throw new Error("The ENT-Care service returned an invalid facility record.");
  }
  return {
    facilities: result.facilities,
    ...(isRecord(result.query) ? { query: result.query } : {}),
  };
}

export async function getFacility(
  token: string,
  facilityId: string,
): Promise<Record<string, unknown>> {
  return request(`/facilities/${encodeURIComponent(facilityId)}`, token);
}

export async function getEscalatedCases(
  token: string,
  status = "pending",
): Promise<Record<string, unknown>[]> {
  const result = await request<unknown>(
    `/admin/escalated-cases?status=${encodeURIComponent(status)}`,
    token,
  );
  if (Array.isArray(result) && result.every(isRecord)) return result;
  if (
    isRecord(result) &&
    "cases" in result &&
    Array.isArray(result.cases)
  ) {
    if (result.cases.every(isRecord)) return result.cases;
  }
  throw new Error("The ENT-Care service returned an invalid escalated-cases response.");
}

export async function updateEscalatedCase(
  token: string,
  caseId: string,
  specialistNotes: string,
): Promise<Record<string, unknown>> {
  return request(`/admin/escalated-cases/${encodeURIComponent(caseId)}`, token, {
    method: "PATCH",
    body: JSON.stringify({ specialistNotes, status: "responded" }),
  });
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
