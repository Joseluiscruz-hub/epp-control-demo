import type { Metadata } from "next";
import "../../app/globals.css";
import { KioskInactivityGuard } from "@/components/kiosk-inactivity-guard";
import { KioskHeader } from "./kiosk-header";

export const metadata: Metadata = {
  title: "Kiosko EPP — Solicitud de Equipo de Protección Personal",
  description: "Sistema de autoservicio para solicitud de EPP.",
};

// Este layout NO incluye AuthGuard ni NavBar del admin.
// El kiosko tiene su propio flujo de autenticación por PIN de empleado.
export default function KioskoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="kiosko-root min-h-screen bg-background text-white flex flex-col select-none">
      <KioskInactivityGuard>
        {/* Encabezado: marca, colaborador, cierre automático y Salir */}
        <KioskHeader />
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </KioskInactivityGuard>
    </div>
  );
}
