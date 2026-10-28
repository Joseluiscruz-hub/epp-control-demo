/** Flujos públicos (kiosko de planta y portal del colaborador) que no usan el shell administrativo. */
export function isPublicFlowPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === "/portal" || pathname.startsWith("/portal/") || pathname.startsWith("/kiosko");
}

/** Ruta activa: coincidencia exacta o subruta (por ejemplo /empleados/123 activa /empleados). */
export function isRouteActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
