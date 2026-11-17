export type EntUrgencyLevel = "Emergency" | "Urgent" | "Soon" | "Routine";

export interface EntCondition {
  id?: string;
  name?: string;
  commonName?: string;
  confidence?: number;
  explanation?: string;
}

export interface EntAnalysisResult {
  analysis?: {
    method?: string;
    confidence?: string | number;
    primaryCondition?: EntCondition;
    differentials?: EntCondition[];
    aiInsights?: {
      specialties?: string[];
      services?: string[];
      reasoning?: string;
    };
    aiStatus?: {
      available?: boolean;
      code?: string;
    };
  };
  clinical?: {
    urgencyLevel?: EntUrgencyLevel;
    urgencyScore?: number;
    urgencyColor?: string;
    referralThreshold?: string;
    immediateAction?: string;
    patientAdvice?: string;
    redFlags?: string[];
    specialists?: string[];
    investigations?: string[];
    possibleCauses?: string[];
    complications?: string[];
  };
  escalation?: {
    isComplex?: boolean;
    caseId?: string;
    message?: string;
    requiresConsent?: boolean;
  };
  [key: string]: unknown;
}

export interface EntApiEnvelope<T> {
  status?: string;
  code?: string;
  message?: string;
  data?: T;
}

export interface SavedEntReport {
  id?: string;
  trackingId?: string;
  createdAt?: string;
  patientName?: string;
  patientEmail?: string;
  symptoms?: string;
  affectedArea?: string;
  duration?: string;
  age?: number;
  analysisResult?: EntAnalysisResult;
  [key: string]: unknown;
}

export interface EntFacility {
  id?: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  distanceKm?: number;
  accredited?: boolean;
  specialties?: string[];
  matchedSpecialties?: string[];
  travelTimes?: {
    driving?: string;
    walking?: string;
    motorcycle?: string;
  };
  latitude?: number;
  longitude?: number;
  verified?: boolean;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getAnalysisResult(value: unknown): EntAnalysisResult | null {
  if (!isRecord(value)) return null;
  if (isRecord(value.data) && isRecord(value.data.analysis) && isRecord(value.data.clinical)) {
    return value.data as EntAnalysisResult;
  }
  if (isRecord(value.analysis) && isRecord(value.clinical)) {
    return value as EntAnalysisResult;
  }
  return null;
}

export function getSavedReport(value: unknown): SavedEntReport | null {
  if (!isRecord(value) || !isRecord(value.data)) return null;
  const data = value.data;
  if (typeof data.trackingId !== "string" && typeof data.id !== "string") return null;
  return data as SavedEntReport;
}

export function getFacilityList(value: unknown): EntFacility[] {
  if (!isRecord(value) || !isRecord(value.data) || !Array.isArray(value.data.facilities)) {
    return [];
  }

  const readString = (item: unknown) =>
    typeof item === "string" && item.trim() ? item : undefined;
  const readStringList = (item: unknown) =>
    Array.isArray(item)
      ? item.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
      : undefined;

  return value.data.facilities.flatMap((item) => {
    if (!isRecord(item)) return [];
    const name = readString(item.name);
    if (!name) return [];

    const facility: EntFacility = { name };
    const id = readString(item.id);
    const address = readString(item.address);
    const city = readString(item.city);
    const state = readString(item.state);
    if (id) facility.id = id;
    if (address) facility.address = address;
    if (city) facility.city = city;
    if (state) facility.state = state;
    if (
      typeof item.distanceKm === "number" &&
      Number.isFinite(item.distanceKm) &&
      item.distanceKm >= 0
    ) {
      facility.distanceKm = item.distanceKm;
    }
    if (typeof item.accredited === "boolean") facility.accredited = item.accredited;
    if (typeof item.verified === "boolean") facility.verified = item.verified;

    const latitude = item.latitude;
    const longitude = item.longitude;
    if (
      typeof latitude === "number" &&
      typeof longitude === "number" &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      facility.latitude = latitude;
      facility.longitude = longitude;
    }

    const specialties = readStringList(item.specialties);
    const matchedSpecialties = readStringList(item.matchedSpecialties);
    if (specialties?.length) facility.specialties = specialties;
    if (matchedSpecialties?.length) facility.matchedSpecialties = matchedSpecialties;

    if (isRecord(item.travelTimes)) {
      const driving = readString(item.travelTimes.driving);
      const walking = readString(item.travelTimes.walking);
      const motorcycle = readString(item.travelTimes.motorcycle);
      if (driving || walking || motorcycle) {
        facility.travelTimes = {
          ...(driving ? { driving } : {}),
          ...(walking ? { walking } : {}),
          ...(motorcycle ? { motorcycle } : {}),
        };
      }
    }

    return [facility];
  });
}
