"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { isPublicFlowPath } from "@/lib/app-routes";

/**
 * Tema claro/oscuro para las pantallas administrativas.
 * - Claro es el predeterminado de la consola (rediseño corporativo).
 * - Se guarda la preferencia en localStorage ("assetguard-theme").
 * - Kiosko y portal se fuerzan a oscuro: su flujo no se rediseña.
 * Se usa data-theme (no la clase .dark) para no activar variantes dark: de shadcn
 * que hoy no están en uso.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const forcedTheme = isPublicFlowPath(pathname) ? "dark" : undefined;

  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem={false}
      storageKey="assetguard-theme"
      themes={["dark", "light"]}
      forcedTheme={forcedTheme}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
