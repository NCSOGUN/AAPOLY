import { invoke, isTauri } from "@tauri-apps/api/core";
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import Database from "@tauri-apps/plugin-sql";
import { Stronghold, type Client } from "@tauri-apps/plugin-stronghold";
import type { HospitalSession, HospitalUser } from "@/lib/api";

const DATABASE_PATH = "sqlite:ent-care.db";
const CLIENT_NAME = "hospital-auth";
const TOKEN_KEY = "hospital-token";
const RECORD_ENCRYPTION_KEY = "patient-data-encryption-key";
const DAILY_SESSION_MS = 24 * 60 * 60 * 1000;

type SessionRow = {
  email: string;
  user_json: string;
  token_issued_at: string | null;
  vault_path: string;
  last_login_at: string | null;
};

type VisitRow = {
  visit_id: string;
  created_at: string;
  tracking_id: string | null;
  has_diagnosis: number;
  data_ciphertext: string | null;
};

type ReferralRow = {
  referral_id: string;
  created_at: string;
  status: string;
};

type StoredRecord = {
  id: string;
  createdAt: string;
  data: Record<string, unknown>;
  hasDiagnosis?: boolean;
};

type StoredVisits = {
  records: StoredRecord[];
  unavailableCount: number;
};

class UnreadableLocalRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnreadableLocalRecordError";
  }
}

export type SecureSessionVault = {
  savePatientVisit(
    data: Record<string, unknown>,
    visitId?: string,
  ): Promise<{ id: string; createdAt: string }>;
  linkPatientVisitReport(visitId: string, trackingId: string): Promise<void>;
  savePatientDiagnosis(visitId: string, report: Record<string, unknown>): Promise<void>;
  getPatientDiagnosis(visitId: string): Promise<Record<string, unknown> | null>;
  listPatientVisits(): Promise<StoredVisits>;
  saveReferralDraft(data: Record<string, unknown>): Promise<{ id: string; createdAt: string }>;
  listReferralDrafts(): Promise<(StoredRecord & { status: string })[]>;
  lock(): Promise<void>;
};

export type StoredHospitalSession = HospitalSession & {
  vault: SecureSessionVault;
  dailyLoginAt: string;
};

let databasePromise: Promise<Database> | undefined;

function requireDesktopRuntime() {
  if (!isTauri()) {
    throw new Error("Secure hospital sign-in is available in the installed desktop app.");
  }
}

async function database(): Promise<Database> {
  requireDesktopRuntime();
  databasePromise ??= Database.load(DATABASE_PATH);
  return databasePromise;
}

function isHospitalUser(value: unknown): value is HospitalUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<HospitalUser>;
  return (
    typeof user.id === "string" &&
    typeof user.name === "string" &&
    typeof user.email === "string" &&
    typeof user.role === "string" &&
    typeof user.facilityId === "string" &&
    typeof user.facility?.id === "string" &&
    typeof user.facility?.name === "string"
  );
}

function isByteArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  );
}

function isCipherEnvelope(
  value: unknown,
): value is { iv: number[]; ciphertext: number[] } {
  if (!value || typeof value !== "object") return false;
  const envelope = value as { iv?: unknown; ciphertext?: unknown };
  return (
    isByteArray(envelope.iv) &&
    envelope.iv.length === 12 &&
    isByteArray(envelope.ciphertext)
  );
}

async function loadCurrentRow(): Promise<SessionRow | null> {
  const db = await database();
  const rows = await db.select<SessionRow[]>(
    `SELECT email, user_json, token_issued_at, vault_path, last_login_at
     FROM auth_session WHERE session_id = 'current' LIMIT 1`,
  );
  return rows[0] ?? null;
}

function createVaultHandle(
  stronghold: Stronghold,
  client: Client,
  db: Database,
): SecureSessionVault {
  let recordEncryptionKeyPromise: Promise<CryptoKey> | undefined;

  async function getRecordEncryptionKey(createIfMissing: boolean): Promise<CryptoKey> {
    recordEncryptionKeyPromise ??= (async () => {
      const storedKey = await client.getStore().get(RECORD_ENCRYPTION_KEY);
      if (storedKey) {
        const keyBytes = new ArrayBuffer(storedKey.length);
        new Uint8Array(keyBytes).set(storedKey);
        return crypto.subtle.importKey(
          "raw",
          keyBytes,
          { name: "AES-GCM" },
          false,
          ["encrypt", "decrypt"],
        );
      }
      if (!createIfMissing) {
        throw new Error("The patient-record encryption key is missing from secure storage.");
      }
      const generatedKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"],
      );
      const rawKey = await crypto.subtle.exportKey("raw", generatedKey);
      await client
        .getStore()
        .insert(RECORD_ENCRYPTION_KEY, Array.from(new Uint8Array(rawKey)));
      await stronghold.save();
      return crypto.subtle.importKey(
        "raw",
        rawKey,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"],
      );
    })();
    try {
      return await recordEncryptionKeyPromise;
    } catch (error) {
      recordEncryptionKeyPromise = undefined;
      throw error;
    }
  }

  async function encryptRecord(data: Record<string, unknown>): Promise<string> {
    const key = await getRecordEncryptionKey(true);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(data));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
    return JSON.stringify({
      iv: Array.from(iv),
      ciphertext: Array.from(new Uint8Array(ciphertext)),
    });
  }

  async function decryptRecord(
    encrypted: string,
    description: string,
  ): Promise<Record<string, unknown>> {
    let envelope: unknown;
    try {
      envelope = JSON.parse(encrypted) as unknown;
    } catch {
      throw new UnreadableLocalRecordError(`${description} contains invalid encrypted data.`);
    }
    if (!isCipherEnvelope(envelope)) {
      throw new UnreadableLocalRecordError(`${description} contains invalid encrypted data.`);
    }
    const key = await getRecordEncryptionKey(false);
    let plaintext: ArrayBuffer;
    try {
      plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(envelope.iv) },
        key,
        new Uint8Array(envelope.ciphertext),
      );
    } catch {
      throw new UnreadableLocalRecordError(`${description} could not be decrypted.`);
    }
    let data: unknown;
    try {
      data = JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
    } catch {
      throw new UnreadableLocalRecordError(`${description} contains invalid decrypted data.`);
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new UnreadableLocalRecordError(`${description} contains invalid decrypted data.`);
    }
    return data as Record<string, unknown>;
  }

  async function readEncryptedRecord(
    key: string,
    id: string,
  ): Promise<Record<string, unknown>> {
    const isPatientVisit = key.startsWith("patient-visit:");
    const bytes = await client.getStore().get(key);
    if (!bytes) {
      throw isPatientVisit
        ? new UnreadableLocalRecordError(
            "This saved visit appears in the local record list, but its encrypted patient details are unavailable in secure storage. It may be an older record from before encrypted form storage was implemented, so it cannot be reopened. Other visits are not affected.",
          )
        : new Error(`Saved referral ${id} is missing its encrypted details.`);
    }
    let data: unknown;
    try {
      data = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      throw isPatientVisit
        ? new UnreadableLocalRecordError(
            "This saved visit's encrypted patient details could not be read. The record may be damaged and cannot be reopened.",
          )
        : new Error(`Saved referral ${id} could not be read.`);
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw isPatientVisit
        ? new UnreadableLocalRecordError(
            "This saved visit's encrypted patient details are invalid and cannot be reopened.",
          )
        : new Error(`Saved referral ${id} has invalid details.`);
    }
    return data as Record<string, unknown>;
  }

  async function readOptionalEncryptedRecord(
    key: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    const bytes = await client.getStore().get(key);
    if (!bytes) return null;
    let data: unknown;
    try {
      data = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      throw new Error(`Saved diagnosis for visit ${id} could not be read.`);
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error(`Saved diagnosis for visit ${id} has invalid data.`);
    }
    return data as Record<string, unknown>;
  }

  return {
    async savePatientVisit(data, visitId) {
      const id = visitId ?? crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const dataCiphertext = await encryptRecord(data);
      await db.execute(
        `INSERT INTO patient_visits (visit_id, created_at, data_ciphertext)
         VALUES ($1, $2, $3)
         ON CONFLICT(visit_id) DO UPDATE SET data_ciphertext = excluded.data_ciphertext`,
        [id, createdAt, dataCiphertext],
      );
      const rows = await db.select<{ created_at: string }[]>(
        "SELECT created_at FROM patient_visits WHERE visit_id = $1 LIMIT 1",
        [id],
      );
      if (!rows[0]) throw new Error("The patient visit could not be indexed in local storage.");
      return { id, createdAt: rows[0].created_at };
    },
    async listPatientVisits() {
      const visits = await db.select<VisitRow[]>(
        `SELECT visit_id, created_at, tracking_id, has_diagnosis, data_ciphertext
         FROM patient_visits ORDER BY created_at DESC`,
      );
      const results: StoredRecord[] = [];
      let unavailableCount = 0;
      for (const visit of visits) {
        let data: Record<string, unknown>;
        try {
          data = visit.data_ciphertext
            ? await decryptRecord(
                visit.data_ciphertext,
                "This saved visit",
              )
            : await readEncryptedRecord(`patient-visit:${visit.visit_id}`, visit.visit_id);
        } catch (error) {
          if (!(error instanceof UnreadableLocalRecordError)) throw error;
          unavailableCount += 1;
          continue;
        }
        results.push({
          id: visit.visit_id,
          createdAt: visit.created_at,
          hasDiagnosis: visit.has_diagnosis === 1,
          data: {
            ...data,
            ...(visit.tracking_id ? { reportTrackingId: visit.tracking_id } : {}),
          },
        });
      }
      return { records: results, unavailableCount };
    },
    async linkPatientVisitReport(visitId, trackingId) {
      const result = await db.execute(
        "UPDATE patient_visits SET tracking_id = $1 WHERE visit_id = $2",
        [trackingId, visitId],
      );
      if (result.rowsAffected !== 1) {
        throw new Error("The saved intake record could not be linked to its report.");
      }
    },
    async savePatientDiagnosis(visitId, report) {
      const visits = await db.select<{ visit_id: string }[]>(
        "SELECT visit_id FROM patient_visits WHERE visit_id = $1 LIMIT 1",
        [visitId],
      );
      if (!visits[0]) throw new Error("The patient visit could not be found in local storage.");
      const diagnosisCiphertext = await encryptRecord(report);
      const result = await db.execute(
        `UPDATE patient_visits
         SET diagnosis_ciphertext = $1, has_diagnosis = 1
         WHERE visit_id = $2`,
        [diagnosisCiphertext, visitId],
      );
      if (result.rowsAffected !== 1) {
        throw new Error("The saved diagnosis could not be indexed with its patient visit.");
      }
    },
    async getPatientDiagnosis(visitId) {
      const visits = await db.select<
        { has_diagnosis: number; diagnosis_ciphertext: string | null }[]
      >(
        `SELECT has_diagnosis, diagnosis_ciphertext
         FROM patient_visits WHERE visit_id = $1 LIMIT 1`,
        [visitId],
      );
      if (!visits[0]) throw new Error("The patient visit could not be found in local storage.");
      if (visits[0].has_diagnosis !== 1) return null;
      if (visits[0].diagnosis_ciphertext) {
        return decryptRecord(
          visits[0].diagnosis_ciphertext,
          "The saved diagnosis",
        );
      }
      const report = await readOptionalEncryptedRecord(
        `patient-diagnosis:${visitId}`,
        visitId,
      );
      if (!report) {
        throw new Error(
          "The saved diagnosis is unavailable: its encrypted report is missing from secure storage.",
        );
      }
      return report;
    },
    async saveReferralDraft(data) {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const encoded = new TextEncoder().encode(JSON.stringify(data));
      await client.getStore().insert(`referral:${id}`, Array.from(encoded));
      await stronghold.save();
      await db.execute(
        "INSERT INTO referrals (referral_id, created_at, status) VALUES ($1, $2, 'draft')",
        [id, createdAt],
      );
      return { id, createdAt };
    },
    async listReferralDrafts() {
      const referrals = await db.select<ReferralRow[]>(
        "SELECT referral_id, created_at, status FROM referrals ORDER BY created_at DESC",
      );
      const results: (StoredRecord & { status: string })[] = [];
      for (const referral of referrals) {
        results.push({
          id: referral.referral_id,
          createdAt: referral.created_at,
          status: referral.status,
          data: await readEncryptedRecord(`referral:${referral.referral_id}`, referral.referral_id),
        });
      }
      return results;
    },
    async lock() {
      await stronghold.unload();
    },
  };
}

export async function hasSavedSession(): Promise<boolean> {
  if (!isTauri()) return false;
  return (await loadCurrentRow()) !== null;
}

async function saveDailySessionSecret(email: string, password: string): Promise<string> {
  if (!isTauri()) throw new Error("Daily session storage requires the desktop app.");
  const normalizedEmail = email.trim().toLowerCase();
  const loggedInAt = new Date().toISOString();
  await invoke("store_daily_session_secret", {
    email: normalizedEmail,
    secret: password,
  });
  const db = await database();
  await db.execute(
    "UPDATE auth_session SET last_login_at = $1 WHERE session_id = 'current'",
    [loggedInAt],
  );
  return loggedInAt;
}

export async function clearDailySessionSecret(email: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("delete_daily_session_secret", {
    email: email.trim().toLowerCase(),
  });
}

export async function saveHospitalSession(
  session: HospitalSession,
  vaultPassword: string,
): Promise<StoredHospitalSession> {
  requireDesktopRuntime();
  const db = await database();
  const normalizedEmail = session.user.email.trim().toLowerCase();
  const existing = await loadCurrentRow();
  if (existing?.email === normalizedEmail) {
    const stronghold = await Stronghold.load(existing.vault_path, vaultPassword);
    let client: Client;
    let dailyLoginAt: string;
    try {
      client = await stronghold.loadClient(CLIENT_NAME);
      await client
        .getStore()
        .insert(TOKEN_KEY, Array.from(new TextEncoder().encode(session.token)));
      await stronghold.save();
      await db.execute(
        `UPDATE auth_session
         SET user_json = $1, token_issued_at = $2, updated_at = $3
         WHERE session_id = 'current'`,
        [
          JSON.stringify(session.user),
          session.tokenIssuedAt ?? null,
          new Date().toISOString(),
        ],
      );
      dailyLoginAt = await saveDailySessionSecret(normalizedEmail, vaultPassword);
    } catch (error) {
      await stronghold.unload();
      throw error;
    }
    return {
      ...session,
      dailyLoginAt,
      vault: createVaultHandle(stronghold, client, db),
    };
  }

  const vaultPath = await join(
    await appLocalDataDir(),
    `hospital-${crypto.randomUUID()}.hold`,
  );
  const stronghold = await Stronghold.load(vaultPath, vaultPassword);
  let client: Client;
  try {
    client = await stronghold.createClient(CLIENT_NAME);
    await client
      .getStore()
      .insert(TOKEN_KEY, Array.from(new TextEncoder().encode(session.token)));
    await stronghold.save();
  } catch (error) {
    await stronghold.unload();
    throw error;
  }

  let dailyLoginAt: string;
  try {
    await db.execute(
      `INSERT OR REPLACE INTO auth_session
        (session_id, email, user_json, token_issued_at, vault_path, updated_at, last_login_at)
       VALUES ('current', $1, $2, $3, $4, $5, $6)`,
      [
        normalizedEmail,
        JSON.stringify(session.user),
        session.tokenIssuedAt ?? null,
        vaultPath,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
    dailyLoginAt = await saveDailySessionSecret(normalizedEmail, vaultPassword);
  } catch (error) {
    await stronghold.unload();
    throw error;
  }
  return {
    ...session,
    dailyLoginAt,
    vault: createVaultHandle(stronghold, client, db),
  };
}

export async function restoreDailySession(): Promise<StoredHospitalSession | null> {
  if (!isTauri()) return null;
  const row = await loadCurrentRow();
  if (!row?.last_login_at) return null;
  const lastLoginAt = Date.parse(row.last_login_at);
  if (
    !Number.isFinite(lastLoginAt) ||
    Date.now() - lastLoginAt < 0 ||
    Date.now() - lastLoginAt >= DAILY_SESSION_MS
  ) {
    await clearDailySessionSecret(row.email);
    return null;
  }
  const password = await invoke<string | null>("load_daily_session_secret", {
    email: row.email,
  });
  if (!password) return null;
  return unlockSavedSession(row.email, password, false);
}

export async function unlockSavedSession(
  email: string,
  vaultPassword: string,
  remember = true,
): Promise<StoredHospitalSession | null> {
  const row = await loadCurrentRow();
  if (!row || row.email !== email.trim().toLowerCase()) return null;

  let user: unknown;
  try {
    user = JSON.parse(row.user_json) as unknown;
  } catch {
    throw new Error("The saved hospital profile is damaged. Sign in online to refresh it.");
  }
  if (!isHospitalUser(user)) {
    throw new Error("The saved hospital profile is invalid. Sign in online to refresh it.");
  }

  const stronghold = await Stronghold.load(row.vault_path, vaultPassword);
  let client: Client;
  let tokenBytes: Uint8Array | null;
  try {
    client = await stronghold.loadClient(CLIENT_NAME);
    tokenBytes = await client.getStore().get(TOKEN_KEY);
  } catch (error) {
    await stronghold.unload();
    throw error;
  }
  if (!tokenBytes) {
    await stronghold.unload();
    throw new Error("The saved sign-in is unavailable. Connect to the internet and sign in again.");
  }

  const token = new TextDecoder().decode(tokenBytes);
  if (!token.startsWith("hu_")) {
    await stronghold.unload();
    throw new Error("The saved sign-in is invalid. Connect to the internet and sign in again.");
  }

  try {
    const dailyLoginAt = remember
      ? await saveDailySessionSecret(row.email, vaultPassword)
      : row.last_login_at;
    if (!dailyLoginAt) throw new Error("The daily session expiry could not be verified.");
    return {
      token,
      user,
      dailyLoginAt,
      vault: createVaultHandle(stronghold, client, await database()),
      ...(row.token_issued_at ? { tokenIssuedAt: row.token_issued_at } : {}),
    };
  } catch (error) {
    await stronghold.unload();
    throw error;
  }
}

export async function refreshSavedUser(user: HospitalUser): Promise<void> {
  const db = await database();
  await db.execute(
    `UPDATE auth_session
     SET email = $1, user_json = $2, updated_at = $3
     WHERE session_id = 'current'`,
    [user.email.trim().toLowerCase(), JSON.stringify(user), new Date().toISOString()],
  );
}
