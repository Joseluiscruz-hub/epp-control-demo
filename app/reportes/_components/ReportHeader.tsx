"use client";

import {
  CalendarDays,
  ChevronDown,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PeriodMode } from "../_hooks/useReportData";

export interface ReportHeaderProps {
  periodMode: PeriodMode;
  setPeriodMode: (mode: PeriodMode) => void;
  selectedDate: string;
  setSelectedDate: (v: string) => void;
  selectedMonth: string;
  setSelectedMonth: (v: string) => void;
  selectedYear: string;
  setSelectedYear: (v: string) => void;
  rangeStart: string;
  setRangeStart: (v: string) => void;
  rangeEnd: string;
  setRangeEnd: (v: string) => void;
  periodLabel: string;
  loading: boolean;
  onRefresh: () => void;
}

/** Mismo estilo que el selector de periodo; conserva el calendario nativo. */
const PERIOD_FIELD =
  "h-10 rounded-md border-input bg-card font-mono text-[13px] font-medium text-foreground shadow-none focus-visible:border-primary [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 hover:[&::-webkit-calendar-picker-indicator]:opacity-100";

export function ReportHeader({
  periodMode,
  setPeriodMode,
  selectedDate,
  setSelectedDate,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  rangeStart,
  setRangeStart,
  rangeEnd,
  setRangeEnd,
  periodLabel,
  loading,
  onRefresh,
}: ReportHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
          <FileSpreadsheet className="h-6 w-6" />
        </div>
        <div>
          <p className="section-eyebrow">Bajas SAP</p>
          <h1 className="text-2xl font-black tracking-tight text-white">Reporte de Consumo EPP</h1>
          <p className="mt-1 text-sm font-semibold text-white/45">{periodLabel}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative">
        <select
          value={periodMode}
          onChange={(event) => setPeriodMode(event.target.value as PeriodMode)}
          className="h-10 appearance-none rounded-md border border-input bg-card py-0 pl-3 pr-9 text-[13px] font-medium text-foreground outline-none focus-visible:border-primary"
        >
          <option value="day">Diario</option>
          <option value="month">Mensual</option>
          <option value="year">Anual</option>
          <option value="range">Rango</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        </div>
        <div className="relative">
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          {periodMode === "day" && (
            <Input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className={`${PERIOD_FIELD} pl-10`}
            />
          )}
          {periodMode === "month" && (
            <Input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className={`${PERIOD_FIELD} pl-10`}
            />
          )}
          {periodMode === "year" && (
            <Input
              type="number"
              value={selectedYear}
              min="2020"
              max="2100"
              onChange={(event) => setSelectedYear(event.target.value)}
              className={`${PERIOD_FIELD} w-28 pl-10`}
            />
          )}
        </div>
        {periodMode === "range" && (
          <div className="flex gap-2">
            <Input
              type="date"
              value={rangeStart}
              onChange={(event) => setRangeStart(event.target.value)}
              className={PERIOD_FIELD}
            />
            <Input
              type="date"
              value={rangeEnd}
              onChange={(event) => setRangeEnd(event.target.value)}
              className={PERIOD_FIELD}
            />
          </div>
        )}
        <Button
          variant="outline"
          className="h-10 rounded-md border-input bg-card text-[13px] font-medium text-foreground hover:bg-muted"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </Button>
      </div>
    </div>
  );
}
