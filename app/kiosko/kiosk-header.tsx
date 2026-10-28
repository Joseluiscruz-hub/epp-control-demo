"use client";

import { usePathname } from "next/navigation";
import { useKioskSessionStatus } from "@/components/kiosk-inactivity-guard";
import { formatCountdown, maskEmployeeId } from "@/lib/kiosk-catalog-view";
import { KioskoClock } from "./kiosko-clock";

/** Rutas donde el encabezado muestra al colaborador y el botón Salir. */
const SELECTION_ROUTES = ["/kiosko/catalogo"];

export function KioskHeader() {
  const pathname = usePathname();
  const { session, secondsLeft, logout } = useKioskSessionStatus();
  const showSession = Boolean(session) && secondsLeft !== null && secondsLeft > 0;
  const showIdentity = showSession && SELECTION_ROUTES.some((route) => pathname?.startsWith(route));

  return (
    <header className="flex h-[72px] flex-none items-center justify-between gap-6 border-b border-border bg-[var(--kiosk-sunken)] px-6 sm:px-8">
      <div className="flex items-center gap-3">
        <svg width="30" height="30" viewBox="0 0 22 22" aria-hidden="true" className="flex-none">
          <rect x="1" y="1" width="20" height="20" rx="4" fill="none" stroke="var(--kiosk-control)" strokeWidth="1.5" />
          <circle cx="11" cy="11" r="4" fill="var(--primary)" />
        </svg>
        <div className="leading-tight">
          <div className="text-lg font-semibold tracking-[0.01em] text-foreground">AssetGuard</div>
          <div className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground">KIOSKO DE EPP</div>
        </div>
      </div>

      {showSession ? (
        <div className="flex items-center gap-4 sm:gap-6">
          {showIdentity && session && (
            <div className="hidden text-right leading-tight sm:block">
              <div className="max-w-[16rem] truncate font-medium text-foreground">{session.employeeName || "Colaborador"}</div>
              <div className="text-[13px] text-muted-foreground">N.º {maskEmployeeId(session.employeeId)}</div>
            </div>
          )}
          <div
            className="flex items-center gap-2.5 rounded-full border border-input px-4 py-2 font-mono text-[13px] text-foreground/80"
            role="timer"
            aria-live="off"
            aria-label={`La sesión se cierra automáticamente en ${formatCountdown(secondsLeft ?? 0)}`}
          >
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${(secondsLeft ?? 0) <= 60 ? "bg-[var(--warning)]" : "bg-primary"}`} />
            <span className="hidden md:inline">Cierre automático en</span> {formatCountdown(secondsLeft ?? 0)}
          </div>
          {showIdentity && (
            <button
              type="button"
              onClick={() => void logout()}
              className="flex h-12 items-center rounded-lg border border-input px-[22px] font-medium text-foreground transition-colors hover:bg-[var(--kiosk-selected)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Salir
            </button>
          )}
        </div>
      ) : (
        <KioskoClock />
      )}
    </header>
  );
}
