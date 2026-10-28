"use client";

import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExternalLink } from 'lucide-react';
import type { DashboardStats, InsightData } from '@/app/_hooks/useDashboardData';

export interface DashboardHeroProps {
  authDisplayName: string | null | undefined;
  stats: DashboardStats;
  insights: InsightData;
}

/** Encabezado del Resumen ejecutivo: título, contexto y cumplimiento, sin efectos. */
export function DashboardHero({ authDisplayName, stats, insights }: DashboardHeroProps) {
  const rate = Math.max(0, Math.min(100, insights.complianceRate));
  const tone = rate >= 90 ? 'var(--primary)' : rate >= 70 ? 'var(--warning)' : 'var(--critical)';

  return (
    <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="section-eyebrow">Control de EPP · Operación</p>
        <h1 className="mt-1.5 text-[28px] font-medium leading-tight tracking-[-0.015em] text-foreground">
          Resumen ejecutivo
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Hola {authDisplayName?.split(' ')[0] || 'Admin'}. {stats.activeEmployees} colaboradores activos
          {' · '}
          {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
        </p>
      </div>

      <div className="flex items-center gap-6">
        <div className="min-w-[200px]">
          <div className="flex items-baseline justify-between gap-4">
            <span className="section-eyebrow">Cumplimiento EPP</span>
            <span className="font-mono text-2xl tracking-[-0.03em] text-foreground">{rate}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-sm bg-muted" role="progressbar" aria-valuenow={rate} aria-valuemin={0} aria-valuemax={100} aria-label="Cumplimiento EPP">
            <div className="h-full rounded-sm" style={{ width: `${rate}%`, background: tone }} />
          </div>
        </div>
        <Link
          href="/kiosko"
          target="_blank"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          Abrir kiosko
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </header>
  );
}
