"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getEmployeeById } from "@/lib/kiosk-api";
import { Loader2, HardHat, ShieldCheck } from "lucide-react";
import { clearKioskSession, setKioskSessionBusy } from "@/lib/kiosk-session";

function getKioskConnectionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : 0;
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";

  if (status === 401 && message.includes("App Check")) {
    return "No se pudo validar App Check. Recarga el kiosko e intenta de nuevo.";
  }

  if (code === "permission-denied") {
    return "El kiosko no tiene permisos. Sincroniza desde el panel de Empleados.";
  }

  if (code === "unavailable") {
    return "No hay conexión con el servidor corporativo.";
  }

  return "Error de autenticación. Intenta de nuevo.";
}

export default function KioskoHomePage() {
  const router = useRouter();
  const [empId, setEmpId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleContinue = async () => {
    if (!empId.trim()) return;
    setLoading(true);
    setKioskSessionBusy(true);
    setError("");
    try {
      const emp = await getEmployeeById(empId.trim());
      if (!emp) {
        setError("Número de empleado no encontrado. Verifica con tu supervisor.");
        setLoading(false);
        return;
      }
      if (!emp.active) {
        setError("Colaborador inactivo. Contacta a Seguridad Industrial.");
        setLoading(false);
        return;
      }

      clearKioskSession();
      sessionStorage.setItem("kiosk_employee_id", emp.id);
      sessionStorage.setItem("kiosk_employee_name", emp.name);
      sessionStorage.setItem("kiosk_employee_plant", emp.plantaId ?? "");
      sessionStorage.setItem("kiosk_first_login", String(Boolean(emp.firstLogin)));
      sessionStorage.setItem("kiosk_terms_accepted", String(Boolean(emp.termsAccepted)));

      if (emp.firstLogin || !emp.termsAccepted) {
        router.push("/kiosko/setup");
        return;
      }

      router.push("/kiosko/login");
    } catch (error) {
      console.error("[Kiosko employee lookup error]", error);
      setError(getKioskConnectionErrorMessage(error));
      setLoading(false);
    } finally {
      setKioskSessionBusy(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8 py-14 relative overflow-hidden bg-background">
      {/* ── Background Elements ──────────────── */}
      <div className="absolute inset-0 pointer-events-none">
      </div>

      <div className="flex flex-col items-center gap-4 text-center relative z-10">
        <div className="w-20 h-20 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center mb-2">
          <HardHat size={48} className="text-primary" />
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight uppercase">Kiosko EPP</h1>
        <div className="flex items-center gap-2 text-primary font-bold text-[10px] tracking-widest uppercase">
          <ShieldCheck className="h-4 w-4" /> AssetGuard
        </div>
        <p className="text-white/50 max-w-sm text-sm font-medium mt-2">
          Ingresa tu número de nómina corporativa para acceder a tu dotación.
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-5 relative z-10">
        <div className="relative">
          <input
            type="tel"
            inputMode="numeric"
            placeholder="Ej. 1881"
            value={empId}
            onChange={e => setEmpId(e.target.value.replace(/\D/g, ""))}
            onKeyDown={e => e.key === "Enter" && handleContinue()}
            className="w-full text-center text-4xl font-black tracking-widest bg-white/5 border border-white/10 focus:border-primary focus:bg-white/10 rounded-lg px-6 py-6 text-white outline-none transition-all placeholder:text-white/20 shadow-inner"
            maxLength={10}
            autoFocus
          />
        </div>

        {error && (
          <p className="text-red-400 text-center text-sm font-bold bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-lg px-4 py-4 uppercase tracking-wider">
            {error}
          </p>
        )}

        <button
          onClick={handleContinue}
          disabled={!empId.trim() || loading}
          className="w-full py-6 rounded-lg bg-primary hover:bg-primary-strong disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground font-black text-xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
        >
          {loading ? <Loader2 size={28} className="animate-spin" /> : "Validar Nómina"}
        </button>
      </div>

      <div className="relative z-10 w-full max-w-sm flex justify-center mt-4">
        <NumPad value={empId} onChange={setEmpId} onConfirm={handleContinue} />
      </div>
    </div>
  );
}

// ── Teclado numérico táctil ───────────────────────────────────────────────────
function NumPad({
  value, onChange, onConfirm,
}: { value: string; onChange: (v: string) => void; onConfirm: () => void }) {
  const keys = ["1","2","3","4","5","6","7","8","9","⌫","0","✓"];

  const press = (k: string) => {
    if (k === "⌫") onChange(value.slice(0, -1));
    else if (k === "✓") onConfirm();
    else if (value.length < 10) onChange(value + k);
  };

  return (
    <div className="grid grid-cols-3 gap-3 w-full">
      {keys.map(k => (
        <button
          key={k}
          onClick={() => press(k)}
          className={`h-16 rounded-lg text-2xl font-black transition-all active:scale-95 select-none
            ${k === "✓"
              ? "bg-primary text-primary-foreground hover:bg-primary-strong"
              : k === "⌫"
              ? "bg-[var(--critical)]/15 text-[var(--critical)] border border-[var(--critical)]/30 hover:bg-[var(--critical)]/25"
              : "bg-white/5 text-white hover:bg-white/10 border border-white/10 hover:border-white/20"
            }`}
        >
          {k}
        </button>
      ))}
    </div>
  );
}
