"use client";

import {
  CheckCircle2,
  PackageCheck,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReportStatsGridProps {
  totalQuantity: number;
  uniqueEmployees: number;
  topArea: [string, number] | null;
  missingRows: number;
}

function StatTile({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "neutral" | "green" | "amber" | "red";
}) {
  const toneClass = {
    neutral: "border-white/10 bg-white/[0.04] text-white",
    green: "border-primary/20 bg-primary/10 text-primary",
    amber: "border-[var(--warning)]/25 bg-[var(--warning)]/10 text-[var(--warning)]",
    red: "border-red-400/25 bg-red-500/10 text-red-200",
  }[tone];

  return (
    <div className={cn("rounded-lg border p-4", toneClass)}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-current/15 bg-black/10">
          {icon}
        </span>
        <span className="text-2xl font-black tracking-tight">{value}</span>
      </div>
      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] opacity-60">{label}</p>
    </div>
  );
}

export function ReportStatsGrid({
  totalQuantity,
  uniqueEmployees,
  topArea,
  missingRows,
}: ReportStatsGridProps) {
  return (
    <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        icon={<PackageCheck className="h-4 w-4" />}
        label="Cantidad para baja"
        value={totalQuantity}
        tone={totalQuantity > 0 ? "green" : "neutral"}
      />
      <StatTile
        icon={<Users className="h-4 w-4" />}
        label="Colaboradores"
        value={uniqueEmployees}
        tone="neutral"
      />
      <StatTile
        icon={<TrendingUp className="h-4 w-4" />}
        label="Área principal"
        value={topArea ? topArea[0] : "Sin consumo"}
        tone="amber"
      />
      <StatTile
        icon={missingRows > 0 ? <ShieldAlert className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        label="Revisión de datos"
        value={missingRows > 0 ? `${missingRows} alertas` : "Listo"}
        tone={missingRows > 0 ? "red" : "green"}
      />
    </div>
  );
}
