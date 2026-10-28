"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Bell,
  Bot,
  ExternalLink,
  FileSpreadsheet,
  HardHat,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  RadioTower,
  ShieldCheck,
  UserCog,
  Users,
  WalletCards,
  X,
  type LucideProps,
} from "lucide-react";
import { useAuth } from "./auth-provider";
import { PlantContextSwitcher } from "./plant-context-switcher";
import { ThemeToggle } from "./theme-toggle";
import { isPublicFlowPath, isRouteActive } from "@/lib/app-routes";
import { cn } from "@/lib/utils";

type NavIcon = ComponentType<LucideProps>;

interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: NavIcon;
  globalOnly?: boolean;
}

const NAV_LINKS: NavItem[] = [
  { href: "/", label: "Dashboard", description: "Resumen ejecutivo de EPP", icon: LayoutDashboard },
  { href: "/monitoreo", label: "Monitoreo", description: "Torre de control en vivo", icon: RadioTower },
  { href: "/empleados", label: "Empleados", description: "Colaboradores y dotaciones", icon: Users },
  { href: "/inventario", label: "Inventario", description: "Catálogo y existencias", icon: Package },
  { href: "/reportes", label: "Reportes", description: "Consumo y exportaciones", icon: FileSpreadsheet },
  { href: "/presupuesto", label: "Presupuesto", description: "Gasto contra meta", icon: WalletCards, globalOnly: true },
  { href: "/administradores", label: "Admins", description: "Accesos administrativos", icon: UserCog },
];

const EXTERNAL_LINKS: { href: string; label: string; icon: NavIcon }[] = [
  { href: "/portal", label: "Portal colaborador", icon: ExternalLink },
  { href: "/kiosko", label: "Kiosko EPP", icon: HardHat },
];

function roleLabel(isGlobalAdmin: boolean, isAdmin: boolean) {
  if (isGlobalAdmin) return "Global";
  if (isAdmin) return "Local";
  return "Editor";
}

function UserAvatar({ size }: { size: number }) {
  const { user } = useAuth();
  if (user?.photoURL) {
    return (
      <Image
        src={user.photoURL}
        alt="Perfil"
        width={size}
        height={size}
        unoptimized
        className="shrink-0 rounded-full ring-2 ring-white/10"
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/15 text-xs font-bold text-[var(--primary)] ring-2 ring-white/10"
      style={{ width: size, height: size }}
    >
      {user?.email?.charAt(0).toUpperCase() || "A"}
    </div>
  );
}

function SidebarContent({ onNavigate, extra }: { onNavigate?: () => void; extra?: ReactNode }) {
  const { user, logOut, isAdmin, isGlobalAdmin } = useAuth();
  const pathname = usePathname();
  const visibleNavLinks = NAV_LINKS.filter((link) => !link.globalOnly || isGlobalAdmin);

  return (
    <div className="flex h-full flex-col">
      {/* Marca */}
      <Link
        href="/"
        onClick={onNavigate}
        className="group flex h-[4.25rem] shrink-0 items-center gap-3 border-b border-shell-border px-5"
        aria-label="Ir al dashboard de AssetGuard"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] ring-1 ring-white/20 transition-transform duration-300 group-hover:rotate-0 group-hover:scale-[1.04] rotate-3">
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
        <div className="leading-none">
          <span className="block font-display text-base font-extrabold tracking-tight text-shell-foreground">AssetGuard</span>
          <span className="mt-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.17em] text-[var(--primary)]/80">
            AssetGuard
            <span className="text-shell-muted">· EPP</span>
          </span>
        </div>
      </Link>

      {extra}

      <nav className="custom-scroll flex-1 overflow-y-auto px-3 py-5" aria-label="Navegación principal">
        <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-shell-muted">Módulos de control</p>
        <ul className="space-y-1">
          {visibleNavLinks.map((link) => {
            const isActive = isRouteActive(pathname, link.href);
            const Icon = link.icon;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50",
                    isActive
                      ? "bg-[var(--primary)]/12 text-shell-foreground"
                      : "text-shell-muted hover:bg-shell-hover hover:text-shell-foreground"
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active-indicator"
                      className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[var(--primary)]"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors duration-200",
                      isActive
                        ? "border-transparent bg-[var(--primary)] text-white"
                        : "border-shell-border bg-shell-hover group-hover:border-red-500/25 group-hover:text-[var(--primary)]"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="truncate">{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mb-2 mt-6 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-shell-muted">Accesos de planta</p>
        <ul className="space-y-1">
          {EXTERNAL_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  target="_blank"
                  onClick={onNavigate}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-shell-muted transition-colors duration-200 hover:bg-shell-hover hover:text-shell-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-shell-border bg-shell-hover group-hover:text-[var(--warning)]">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="truncate">{link.label}</span>
                  <ExternalLink className="ml-auto h-3 w-3 opacity-40" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Usuario */}
      <div className="shrink-0 border-t border-shell-border p-3">
        <div className="flex items-center gap-3 rounded-xl bg-shell-hover p-2.5">
          <UserAvatar size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-shell-foreground">{user?.displayName || "Admin"}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">{roleLabel(isGlobalAdmin, isAdmin)}</p>
          </div>
          <button
            type="button"
            onClick={logOut}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-shell-muted transition-colors hover:bg-primary/10 hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusHeader({ mobileOpen, onToggleMobile }: { mobileOpen: boolean; onToggleMobile: () => void }) {
  const { isOfflineSession } = useAuth();
  const pathname = usePathname();
  const [online, setOnline] = useState(true);
  const current = NAV_LINKS.find((link) => isRouteActive(pathname, link.href));
  const live = online && !isOfflineSession;

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  return (
    <header className="glass-header sticky top-0 z-30 no-print">
      <div className="flex h-[4.25rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-shell-border text-shell-muted transition-colors hover:bg-shell-hover hover:text-shell-foreground lg:hidden"
          onClick={onToggleMobile}
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <div className="min-w-0 flex-1">
          <p className="hidden items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--primary)] sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
            Centro de mando · Seguridad
          </p>
          <p className="truncate font-display text-base font-bold leading-tight text-shell-foreground sm:text-lg">
            {current?.label ?? "AssetGuard EPP"}
            {current && (
              <span className="ml-2 hidden text-xs font-medium text-shell-muted md:inline">{current.description}</span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden md:block">
            <PlantContextSwitcher />
          </div>

          <div
            className={cn(
              "hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 sm:flex",
              live ? "border-primary/25 bg-primary/10" : "border-[var(--warning)]/25 bg-[var(--warning)]/10"
            )}
            title={live ? "Conectado en vivo" : "Sin conexión o sesión offline"}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className={cn("absolute inline-flex h-full w-full  rounded-full opacity-50", live ? "bg-primary" : "bg-[var(--warning)]")} />
              <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", live ? "bg-primary" : "bg-[var(--warning)]")} />
            </span>
            <span className={cn("text-[9px] font-black uppercase tracking-widest", live ? "text-primary" : "text-[var(--warning)]")}>
              {live ? "Live" : "Off"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("assetguard:open-aria"))}
            className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            title="Abrir ARIA · Asistente IA"
            aria-label="Abrir ARIA · Asistente IA"
          >
            <Bot className="h-3.5 w-3.5" />
            <span className="hidden text-[9px] font-bold uppercase tracking-wider lg:inline">ARIA</span>
          </button>

          <Link
            href="/monitoreo"
            aria-label="Ver alertas en Monitoreo"
            title="Ver alertas en Monitoreo"
            className="flex h-9 items-center gap-1.5 rounded-lg border border-shell-border px-2.5 text-shell-muted transition-colors hover:bg-shell-hover hover:text-shell-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
          >
            <Bell className="h-4 w-4" />
            <span className="hidden text-xs font-semibold xl:inline">Alertas</span>
          </Link>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

/**
 * Shell administrativo: barra lateral fija (escritorio), cajón deslizable (móvil)
 * y encabezado de estado. No se muestra en kiosko ni portal.
 */
export function NavBar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const hideNav = isPublicFlowPath(pathname);

  useEffect(() => {
    const timeout = window.setTimeout(() => setMobileOpen(false), 0);
    return () => window.clearTimeout(timeout);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  if (hideNav) return null;

  return (
    <>
      {/* Barra lateral fija (lg+) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-shell-border bg-shell  lg:block no-print">
        <SidebarContent />
      </aside>

      {/* Cajón móvil */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-nav-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60  lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <motion.aside
              id="mobile-navigation"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="absolute inset-y-0 left-0 flex w-[17rem] max-w-[85vw] flex-col border-r border-shell-border bg-background"
              onClick={(event) => event.stopPropagation()}
              aria-label="Navegación móvil"
            >
              <SidebarContent
                onNavigate={() => setMobileOpen(false)}
                extra={(
                  <div className="border-b border-shell-border px-4 py-3 md:hidden">
                    <PlantContextSwitcher compact />
                  </div>
                )}
              />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="lg:pl-64">
        <StatusHeader mobileOpen={mobileOpen} onToggleMobile={() => setMobileOpen((open) => !open)} />
      </div>
    </>
  );
}
