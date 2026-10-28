"use client";

import { ClipboardCopy, Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ReportActionBarProps {
  /* Filters */
  itemFilter: string;
  setItemFilter: (v: string) => void;
  employeeFilter: string;
  setEmployeeFilter: (v: string) => void;
  areaFilter: string;
  setAreaFilter: (v: string) => void;

  /* Badges */
  sapFolio: string;
  filteredCount: number;
  totalCount: number;
  localMode: boolean;
  missingRows: number;

  /* Actions */
  onExportSap: () => void;
  onExportDetail: () => void;
  onCopySummary: () => void;
  summaryDisabled: boolean;
  detailDisabled: boolean;
}

export function ReportActionBar({
  itemFilter,
  setItemFilter,
  employeeFilter,
  setEmployeeFilter,
  areaFilter,
  setAreaFilter,
  sapFolio,
  filteredCount,
  totalCount,
  localMode,
  missingRows,
  onExportSap,
  onExportDetail,
  onCopySummary,
  summaryDisabled,
  detailDisabled,
}: ReportActionBarProps) {
  return (
    <>
      {/* Filters */}
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Input
          value={itemFilter}
          onChange={(event) => setItemFilter(event.target.value)}
          placeholder="Filtrar por artículo, SKU o material"
          className="h-10 rounded-lg border-white/10 bg-white/5 font-semibold text-white placeholder:text-white/30"
        />
        <Input
          value={employeeFilter}
          onChange={(event) => setEmployeeFilter(event.target.value)}
          placeholder="Filtrar por usuario o nómina"
          className="h-10 rounded-lg border-white/10 bg-white/5 font-semibold text-white placeholder:text-white/30"
        />
        <Input
          value={areaFilter}
          onChange={(event) => setAreaFilter(event.target.value)}
          placeholder="Filtrar por área o CECO"
          className="h-10 rounded-lg border-white/10 bg-white/5 font-semibold text-white placeholder:text-white/30"
        />
      </div>

      {/* Badges + Export buttons */}
      <div className="flex flex-col gap-3 border-t border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-white/70">
            Folio {sapFolio}
          </Badge>
          <Badge className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-white/60">
            {filteredCount} de {totalCount} movimientos
          </Badge>
          {localMode && (
            <Badge className="rounded-md border border-[var(--warning)]/20 bg-[var(--warning)]/10 px-3 py-1 text-[var(--warning)]">
              Modo local
            </Badge>
          )}
          {missingRows > 0 && (
            <Badge className="rounded-md border border-red-400/25 bg-red-500/10 px-3 py-1 text-red-200">
              Datos por revisar
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="h-10 rounded-lg bg-[var(--primary)] font-black text-white hover:bg-primary"
            onClick={onExportSap}
            disabled={summaryDisabled}
          >
            <Download className="h-4 w-4" />
            SAP CSV
          </Button>
          <Button
            variant="outline"
            className="h-10 rounded-lg border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={onExportDetail}
            disabled={detailDisabled}
          >
            <Download className="h-4 w-4" />
            Detalle CSV
          </Button>
          <Button
            variant="ghost"
            className="h-10 rounded-lg text-white/55 hover:bg-white/5 hover:text-white"
            onClick={() => void onCopySummary()}
            disabled={detailDisabled}
          >
            <ClipboardCopy className="h-4 w-4" />
            Copiar
          </Button>
        </div>
      </div>
    </>
  );
}
