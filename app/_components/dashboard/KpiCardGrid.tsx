"use client";

import type { DashboardStats } from '@/app/_hooks/useDashboardData';

export interface KpiCardGridProps {
  loading: boolean;
  stats: DashboardStats;
}

interface Kpi {
  label: string;
  value: number | string;
  sub: string;
  /** Estado: normal (acento), warning o critical. Solo el crítico usa rojo. */
  tone: 'ok' | 'warning' | 'critical';
}

const TONE_COLOR: Record<Kpi['tone'], string> = {
  ok: 'var(--primary)',
  warning: 'var(--warning)',
  critical: 'var(--critical)',
};

/** Cuatro indicadores clave con datos reales: cifra en mono, etiqueta y estado. */
export function KpiCardGrid({ loading, stats }: KpiCardGridProps) {
  const kpis: Kpi[] = [
    {
      label: 'Entregas hoy',
      value: loading ? '—' : stats.todayAssignments,
      sub: 'En turno actual',
      tone: 'ok',
    },
    {
      label: 'Plantilla activa',
      value: loading || !stats.activeEmployees ? '—' : stats.activeEmployees,
      sub: 'Colaboradores en planta',
      tone: 'ok',
    },
    {
      label: 'Alertas de reposición',
      value: loading ? '—' : stats.alertsThisWeek,
      sub: stats.alertsThisWeek > 0 ? 'Requieren atención' : 'Todo en orden',
      tone: stats.alertsThisWeek > 0 ? 'warning' : 'ok',
    },
    {
      label: 'Stock global',
      value: loading || !stats.totalStock ? '—' : stats.totalStock,
      sub: stats.lowStockItems > 0 ? `${stats.lowStockItems} SKUs críticos` : 'Inventario estable',
      tone: stats.lowStockItems > 0 ? 'critical' : 'ok',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <section key={kpi.label} className="rounded-lg border border-border bg-card p-5">
          <p className="section-eyebrow">{kpi.label}</p>
          <p className="mt-3 font-mono text-[38px] font-normal leading-[1.1] tracking-[-0.03em] text-foreground tabular-nums">
            {kpi.value}
          </p>
          <p className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: TONE_COLOR[kpi.tone] }} aria-hidden />
            {kpi.sub}
          </p>
        </section>
      ))}
    </div>
  );
}
