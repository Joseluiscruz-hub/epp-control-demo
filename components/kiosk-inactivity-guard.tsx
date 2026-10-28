"use client";

import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Clock3 } from "lucide-react";
import { clearKioskSession, isKioskSessionBusy } from "@/lib/kiosk-session";
import { type KioskServerSession, getKioskServerSession, logoutKioskServerSession } from "@/lib/kiosk-api";

export type KioskSessionStatus = {
  /** Sesión del servidor vigente (null si no hay PIN validado). */
  session: KioskServerSession | null;
  /** Segundos para el cierre automático de la sesión; null si no hay sesión. */
  secondsLeft: number | null;
  /** Cierra la sesión del kiosko (servidor y navegador) y vuelve al inicio. */
  logout: () => Promise<void>;
};

const KioskSessionStatusContext = createContext<KioskSessionStatus>({
  session: null,
  secondsLeft: null,
  logout: async () => undefined,
});

export function useKioskSessionStatus() {
  return useContext(KioskSessionStatusContext);
}

const TIMEOUT_MS = 2 * 60 * 1000;
const WARNING_MS = 15 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart"] as const;

type TimerId = number | null;

export function KioskInactivityGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARNING_MS / 1000);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState<number | null>(null);
  const [serverSession, setServerSession] = useState<KioskServerSession | null>(null);
  const warningOpenRef = useRef(false);
  const resetTimersRef = useRef<() => void>(() => undefined);
  const timersRef = useRef<{
    warning: TimerId;
    logout: TimerId;
    countdown: TimerId;
  }>({
    warning: null,
    logout: null,
    countdown: null,
  });

  const clearTimers = useCallback(() => {
    const timers = timersRef.current;
    if (timers.warning) window.clearTimeout(timers.warning);
    if (timers.logout) window.clearTimeout(timers.logout);
    if (timers.countdown) window.clearInterval(timers.countdown);
    timers.warning = null;
    timers.logout = null;
    timers.countdown = null;
  }, []);

  const hasActiveSession = useCallback(() => {
    if (typeof window === "undefined") return false;
    if (pathname !== "/kiosko") return true;
    return Boolean(
      sessionStorage.getItem("kiosk_employee_id") ||
        sessionStorage.getItem("kiosk_request_id")
    );
  }, [pathname]);

  const closeWarning = useCallback(() => {
    warningOpenRef.current = false;
    setWarningOpen(false);
    setSecondsLeft(WARNING_MS / 1000);
  }, []);

  const timeoutSession = useCallback(async () => {
    if (isKioskSessionBusy()) {
      resetTimersRef.current();
      return;
    }

    clearTimers();
    closeWarning();
    await logoutKioskServerSession();
    clearKioskSession();
    router.replace("/kiosko");
  }, [clearTimers, closeWarning, router]);

  const startWarning = useCallback(() => {
    if (!hasActiveSession()) return;
    if (isKioskSessionBusy()) {
      resetTimersRef.current();
      return;
    }

    clearTimers();
    warningOpenRef.current = true;
    setWarningOpen(true);
    setSecondsLeft(WARNING_MS / 1000);

    const deadline = Date.now() + WARNING_MS;
    timersRef.current.countdown = window.setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 250);
    timersRef.current.logout = window.setTimeout(timeoutSession, WARNING_MS);
  }, [clearTimers, hasActiveSession, timeoutSession]);

  const resetTimers = useCallback(() => {
    clearTimers();
    closeWarning();
    if (!hasActiveSession()) return;
    timersRef.current.warning = window.setTimeout(startWarning, TIMEOUT_MS - WARNING_MS);
  }, [clearTimers, closeWarning, hasActiveSession, startWarning]);

  useEffect(() => {
    resetTimersRef.current = resetTimers;
  }, [resetTimers]);

  useEffect(() => {
    const setupTimer = window.setTimeout(resetTimers, 0);

    const handleActivity = () => {
      if (warningOpenRef.current) return;
      resetTimersRef.current();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    return () => {
      window.clearTimeout(setupTimer);
      clearTimers();
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
    };
  }, [clearTimers, pathname, resetTimers]);

  useEffect(() => {
    let active = true;
    let interval: number | undefined;
    void getKioskServerSession().then((session) => {
      if (!active || !session) { if (active) { setSessionSecondsLeft(null); setServerSession(null); } return; }
      setServerSession(session);
      const update = () => {
        const remaining = Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000));
        setSessionSecondsLeft(remaining);
        if (remaining === 0) {
          if (interval) window.clearInterval(interval);
          void timeoutSession();
        }
      };
      update();
      interval = window.setInterval(update, 1000);
    }).catch(() => { if (active) { setSessionSecondsLeft(null); setServerSession(null); } });
    return () => { active = false; if (interval) window.clearInterval(interval); };
  }, [pathname, timeoutSession]);

  const extendSession = () => {
    resetTimersRef.current();
  };

  const logoutNow = useCallback(async () => {
    if (isKioskSessionBusy()) {
      resetTimersRef.current();
      return;
    }
    clearTimers();
    closeWarning();
    await logoutKioskServerSession();
    clearKioskSession();
    router.replace("/kiosko");
  }, [clearTimers, closeWarning, router]);

  // La cuenta regresiva se muestra en el encabezado del kiosko (KioskHeader).
  const status = useMemo<KioskSessionStatus>(() => ({
    session: pathname === "/kiosko" ? null : serverSession,
    secondsLeft: pathname === "/kiosko" ? null : sessionSecondsLeft,
    logout: logoutNow,
  }), [logoutNow, pathname, serverSession, sessionSecondsLeft]);

  return (
    <KioskSessionStatusContext.Provider value={status}>
      {children}
      {warningOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-6 ">
          <div className="w-full max-w-md rounded-lg border border-[var(--warning)]/35 bg-background p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-2xl font-black uppercase tracking-tight text-white">Sesión por cerrar</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-white/60">
              No detectamos actividad. La sesión del kiosko se cerrará automáticamente.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-5 py-3 text-lg font-black text-[var(--warning)]">
              <Clock3 className="h-5 w-5" />
              {secondsLeft}s
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void logoutNow()}
                className="rounded-lg border border-white/10 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white/55 transition-colors hover:bg-white/10 hover:text-white"
              >
                Cerrar ahora
              </button>
              <button
                type="button"
                onClick={extendSession}
                className="rounded-lg bg-[var(--warning)] px-4 py-3 text-sm font-black uppercase tracking-wide text-gray-950 transition-colors hover:bg-[var(--warning)]"
              >
                Continuar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </KioskSessionStatusContext.Provider>
  );
}
