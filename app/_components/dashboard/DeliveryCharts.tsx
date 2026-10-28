"use client";

import type { DeliveryDistribution, ReasonKey } from '@/lib/dashboard-distribution';

/** Uso normal en acento, vida útil en advertencia, extravío en crítico y dotación en neutro. */
const REASON_COLORS: Record<ReasonKey, string> = {
  desgaste: 'var(--primary)',
  vida_util: 'var(--warning)',
  extravio: 'var(--critical)',
  dotacion: 'var(--chart-3)',
};

export interface DeliveryChartsProps {
  loading: boolean;
  distribution: DeliveryDistribution;
}

/**
 * Entregas por semana, por área y por motivo. Las tres usan la misma ventana de
 * 8 semanas y solo las entregas que el panel ya tiene cargadas (hasta 200-300
 * recientes), por eso se indica el tamaño de la muestra.
 */
export function DeliveryCharts({ loading, distribution }: DeliveryChartsProps) {
  const { weekly, byArea, byReason, sample, inWindow } = distribution;
  const maxWeek = Math.max(1, ...weekly.map((w) => w.count));
  const maxArea = Math.max(1, ...byArea.map((a) => a.count));
  const totalReason = byReason.reduce((sum, r) => sum + r.count, 0);
  const empty = !loading && sample === 0;
  const windowLabel = weekly.length > 0 ? `Últimas ${weekly.length} semanas` : 'Últimas semanas';

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <section className="flex flex-col rounded-lg border border-border bg-card p-5 lg:col-span-2" aria-labelledby="chart-weekly">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="chart-weekly" className="text-sm font-medium text-foreground">Entregas por semana</h2>
          <span className="section-eyebrow">{loading ? '—' : `${inWindow} en 8 semanas · ${sample} cargadas`}</span>
        </div>
        {empty ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Aún no hay entregas registradas.</p>
        ) : (
          <ol className="mt-5 flex min-h-48 flex-1 gap-1.5 sm:gap-2" aria-label="Entregas por semana, de la más antigua a la actual">
            {weekly.map((w, i) => {
              const current = i === weekly.length - 1;
              const [day, month = ''] = w.label.split(' ');
              return (
                <li key={w.weekStart.toISOString()} className="flex min-w-0 flex-1 flex-col" title={`Semana del ${w.label}: ${w.count}`}>
                  <div className="flex flex-1 flex-col justify-end">
                    <span className="mb-1.5 text-center font-mono text-[11px] leading-4 text-muted-foreground">{w.count}</span>
                    <div
                      className="w-full rounded-sm"
                      style={{
                        height: `${Math.max(2, (w.count / maxWeek) * 100)}%`,
                        background: current ? 'var(--primary)' : 'var(--border)',
                        minHeight: 2,
                      }}
                    />
                  </div>
                  <span className="mt-1.5 flex h-7 flex-col items-center font-mono text-[10px] uppercase leading-[14px] text-muted-foreground">
                    <span>{day}</span>
                    <span>{month.replace('.', '')}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="flex flex-col gap-3">
      <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="chart-area">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="chart-area" className="text-sm font-medium text-foreground">Entregas por área</h2>
          <span className="section-eyebrow">{windowLabel}</span>
        </div>
        {byArea.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{loading ? 'Cargando…' : 'Sin entregas por área en este periodo.'}</p>
        ) : (
          <ul className="mt-5 space-y-3">
            {byArea.map((a) => (
              <li key={a.area}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="truncate text-foreground">{a.area}</span>
                  <span className="font-mono text-muted-foreground">{a.count}</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-sm bg-muted">
                  <div className="h-full rounded-sm bg-primary" style={{ width: `${(a.count / maxArea) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="chart-reason">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="chart-reason" className="text-sm font-medium text-foreground">Motivo de entrega</h2>
          <span className="section-eyebrow">{windowLabel}</span>
        </div>
        {byReason.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{loading ? 'Cargando…' : 'Sin entregas en este periodo.'}</p>
        ) : (
          <ul className="mt-5 space-y-3">
            {byReason.map((r) => (
              <li key={r.key}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="truncate text-foreground">{r.label}</span>
                  <span className="font-mono text-muted-foreground">
                    {r.count} · {r.percent}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-sm bg-muted">
                  <div
                    className="h-full rounded-sm"
                    style={{ width: `${(r.count / totalReason) * 100}%`, background: REASON_COLORS[r.key] }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}
