import { useEffect, useState } from "react";
import App from "@/App";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { OnboardingScreen, StartupSplash } from "@/components/auth/OnboardingScreen";
import {
  ApiConnectionError,
  ApiError,
  hospitalLogin,
  verifyHospitalSession,
} from "@/lib/api";
import {
  hasSavedSession,
  clearDailySessionSecret,
  refreshSavedUser,
  restoreDailySession,
  saveHospitalSession,
  type StoredHospitalSession,
  unlockSavedSession,
} from "@/lib/sessionStore";

type ActiveSession = StoredHospitalSession;
const DAILY_SESSION_MS = 24 * 60 * 60 * 1000;
const ONBOARDING_ACK_KEY = "ent-care:onboarding:terms-approved-2026-11-v1";

export default function AppRoot() {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [hasLocalSession, setHasLocalSession] = useState(false);
  const [isCheckingLocalSession, setIsCheckingLocalSession] = useState(true);
  const [notice, setNotice] = useState("");
  const [hasAcknowledgedOnboarding, setHasAcknowledgedOnboarding] = useState(false);
  const [setupStorageError, setSetupStorageError] = useState("");

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        try {
          if (active) {
            setHasAcknowledgedOnboarding(
              localStorage.getItem(ONBOARDING_ACK_KEY) === "acknowledged",
            );
            setSetupStorageError("");
          }
        } catch (error) {
          if (active) {
            setSetupStorageError(
              error instanceof Error
                ? `Could not read the setup acknowledgement on this device: ${error.message}`
                : "Could not read the setup acknowledgement on this device.",
            );
          }
        }
        const exists = await hasSavedSession();
        if (active) setHasLocalSession(exists);
        if (exists) {
          try {
            const restored = await restoreDailySession();
            if (active && restored) setSession(restored);
          } catch (error) {
            if (active) {
              setNotice(
                error instanceof Error
                  ? `Could not restore today's secure session: ${error.message}`
                  : "Could not restore today's secure session.",
              );
            }
          }
        }
      } catch (error) {
        if (active) {
          setNotice(
            error instanceof Error
              ? `Local session storage is unavailable: ${error.message}`
              : "Local session storage is unavailable.",
          );
        }
      } finally {
        if (active) setIsCheckingLocalSession(false);
      }
    }
    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  function acknowledgeOnboarding() {
    try {
      localStorage.setItem(ONBOARDING_ACK_KEY, "acknowledged");
      setSetupStorageError("");
      setHasAcknowledgedOnboarding(true);
    } catch (error) {
      setSetupStorageError(
        error instanceof Error
          ? `Could not save your acknowledgement on this device: ${error.message}`
          : "Could not save your acknowledgement on this device.",
      );
    }
  }

  useEffect(() => {
    if (!session) return;
    let active = true;
    const token = session.token;
    const email = session.user.email;
    const vault = session.vault;

    async function verifySession() {
      if (!navigator.onLine) {
        if (active) setIsOffline(true);
        return;
      }
      try {
        const freshUser = await verifyHospitalSession(token);
        await refreshSavedUser(freshUser);
        if (active) {
          setSession((current) =>
            current?.token === token ? { ...current, user: freshUser } : current,
          );
          setIsOffline(false);
          setNotice("");
        }
      } catch (error) {
        if (error instanceof ApiConnectionError) {
          if (active) setIsOffline(true);
          return;
        }
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          try {
            await clearDailySessionSecret(email);
            await vault.lock();
          } catch (lockError) {
            if (active) {
              setNotice(
                lockError instanceof Error
                  ? `The session is invalid, but the secure vault could not be locked: ${lockError.message}`
                  : "The session is invalid, but the secure vault could not be locked.",
              );
            }
            return;
          }
          if (active) {
            setSession(null);
            setIsOffline(false);
            setHasLocalSession(true);
            setNotice(
              error.code === "ACCOUNT_DISABLED"
                ? "This hospital account is disabled. Contact the ENT-Care administrator."
                : "This hospital session is no longer valid. Sign in again while online.",
            );
          }
          return;
        }
        if (active) {
          setNotice(
            error instanceof Error
              ? `Could not refresh account details: ${error.message}`
              : "Could not refresh account details.",
          );
        }
      }
    }

    const handleOnline = () => void verifySession();
    const handleOffline = () => {
      if (active) setIsOffline(true);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const refreshTimer = window.setInterval(() => void verifySession(), 15 * 60 * 1000);
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(refreshTimer);
    };
  }, [session?.token]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    const expiresAt = Date.parse(session.dailyLoginAt) + DAILY_SESSION_MS;
    const delay = Math.max(0, expiresAt - Date.now());
    const expiryTimer = window.setTimeout(() => {
      void (async () => {
        let keychainError = "";
        try {
          await clearDailySessionSecret(session.user.email);
        } catch (error) {
          keychainError =
            error instanceof Error ? ` Could not clear the saved unlock: ${error.message}` : "";
        }
        try {
          await session.vault.lock();
        } catch (error) {
          if (active) {
            setNotice(
              error instanceof Error
                ? `The daily session expired, but the secure workspace could not be locked: ${error.message}`
                : "The daily session expired, but the secure workspace could not be locked.",
            );
          }
          return;
        }
        if (active) {
          setSession(null);
          setIsOffline(false);
          setHasLocalSession(true);
          setNotice(`Your daily session expired. Sign in again to continue.${keychainError}`);
        }
      })();
    }, delay);
    return () => {
      active = false;
      window.clearTimeout(expiryTimer);
    };
  }, [session?.token, session?.dailyLoginAt]);

  async function signIn(email: string, password: string) {
    setNotice("");
    try {
      const onlineSession = await hospitalLogin(email, password);
      const savedSession = await saveHospitalSession(onlineSession, password);
      setSession(savedSession);
      setIsOffline(false);
      setHasLocalSession(true);
    } catch (error) {
      const canUseOfflineSession =
        error instanceof ApiConnectionError ||
        (error instanceof ApiError && error.status >= 500);
      if (!canUseOfflineSession) throw error;

      const savedSession = await unlockSavedSession(email, password);
      if (!savedSession) {
        throw new Error(
          "The service is unreachable and no saved session matches this email. Connect to the internet for first-time sign-in.",
        );
      }
      setSession(savedSession);
      setIsOffline(true);
      setHasLocalSession(true);
    }
  }

  async function lockWorkspace() {
    if (session) {
      try {
        await clearDailySessionSecret(session.user.email);
        await session.vault.lock();
      } catch (error) {
        setNotice(
          error instanceof Error
            ? `Could not lock the secure session: ${error.message}`
            : "Could not lock the secure session. Close the app and try again.",
        );
        return;
      }
    }
    setSession(null);
    setIsOffline(false);
  }

  if (isCheckingLocalSession) return <StartupSplash />;

  if (!hasAcknowledgedOnboarding) {
    return (
      <OnboardingScreen
        onComplete={acknowledgeOnboarding}
        storageError={setupStorageError}
      />
    );
  }

  if (!session) {
    return (
      <LoginScreen
        onSignIn={signIn}
        hasSavedSession={hasLocalSession}
        notice={notice}
      />
    );
  }

  return (
    <App
      session={session}
      vault={session.vault}
      isOffline={isOffline}
      onLock={lockWorkspace}
    />
  );
}
