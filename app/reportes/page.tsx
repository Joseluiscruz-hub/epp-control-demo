"use client";

import { motion } from 'motion/react';
import { FileSpreadsheet } from 'lucide-react';
import { useReportData } from './_hooks/useReportData';
import { ReportHeader } from './_components/ReportHeader';
import { ReportStatsGrid } from './_components/ReportStatsGrid';
import { ReportActionBar } from './_components/ReportActionBar';
import { SummaryTable } from './_components/SummaryTable';
import { DetailTable } from './_components/DetailTable';
import { DailyPulseSidebar } from './_components/DailyPulseSidebar';

export default function ReportesPage() {
  const data = useReportData();

  return (
    <div className="space-y-6 pb-20">

      {data.localMode && <p className="section-eyebrow">Modo offline</p>}

      {/* ── Period Selector ────────────────────────── */}
      <ReportHeader
        periodMode={data.periodMode}
        setPeriodMode={data.setPeriodMode}
        selectedDate={data.selectedDate}
        setSelectedDate={data.setSelectedDate}
        selectedMonth={data.selectedMonth}
        setSelectedMonth={data.setSelectedMonth}
        selectedYear={data.selectedYear}
        setSelectedYear={data.setSelectedYear}
        rangeStart={data.rangeStart}
        setRangeStart={data.setRangeStart}
        rangeEnd={data.rangeEnd}
        setRangeEnd={data.setRangeEnd}
        periodLabel={data.periodLabel}
        loading={data.loading}
        onRefresh={data.loadReport}
      />

      {/* ── Stats Grid ────────────────────────────── */}
      <ReportStatsGrid
        totalQuantity={data.totalQuantity}
        uniqueEmployees={data.uniqueEmployees}
        missingRows={data.missingRows}
        topArea={data.topArea}
      />

      {/* ── Action Bar (filters + export) ─────────── */}
      <ReportActionBar
        itemFilter={data.itemFilter}
        setItemFilter={data.setItemFilter}
        employeeFilter={data.employeeFilter}
        setEmployeeFilter={data.setEmployeeFilter}
        areaFilter={data.areaFilter}
        setAreaFilter={data.setAreaFilter}
        sapFolio={data.sapFolio}
        filteredCount={data.rows.length}
        totalCount={data.allRows.length}
        localMode={data.localMode}
        missingRows={data.missingRows}
        onExportSap={data.exportSap}
        onExportDetail={data.exportDetail}
        onCopySummary={data.copySummary}
        summaryDisabled={data.loading || data.summaryRows.length === 0}
        detailDisabled={data.loading || data.rows.length === 0}
      />

      {/* ── Main Grid ─────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Summary + Detail Tables */}
        <div className="xl:col-span-2 space-y-6">
          <SummaryTable
            summaryRows={data.summaryRows}
            loading={data.loading}
          />
          <DetailTable
            rows={data.rows}
            loading={data.loading}
          />
        </div>

        {/* Daily Pulse Sidebar */}
        <DailyPulseSidebar
          summaryRows={data.summaryRows}
          loading={data.loading}
          missingRows={data.missingRows}
        />
      </div>
    </div>
  );
}
