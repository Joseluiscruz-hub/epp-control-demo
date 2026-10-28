"use client";

import { FileText, Package, TrendingDown, AlertTriangle } from 'lucide-react';

export interface InventoryStatsGridProps {
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  reorderCount: number;
}

export function InventoryStatsGrid({
  totalStock,
  lowStockCount,
  outOfStockCount,
  reorderCount,
}: InventoryStatsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      <div className="kpi-card p-6 group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
           <Package className="h-20 w-20 text-white" />
        </div>
        <p className="section-eyebrow mb-2">Piezas Totales (PZA)</p>
        <p className="text-4xl font-black text-white tracking-tight">{totalStock.toLocaleString()}</p>
      </div>
      
      <div className="kpi-card p-6 group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
           <FileText className="h-20 w-20 text-[var(--warning)]" />
        </div>
        <p className="section-eyebrow mb-2" style={{color:'var(--warning)'}}>SOLPED requerida</p>
        <p className="text-4xl font-black text-[var(--warning)] tracking-tight">{reorderCount}</p>
      </div>

      <div className="kpi-card p-6 group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
           <TrendingDown className="h-20 w-20 text-[var(--warning)]" />
        </div>
        <p className="section-eyebrow mb-2" style={{color:'var(--warning)'}}>Stock Crítico</p>
        <p className="text-4xl font-black text-[var(--warning)] tracking-tight">{lowStockCount}</p>
      </div>

      <div className="kpi-card p-6 group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
           <AlertTriangle className="h-20 w-20 text-[var(--critical)]" />
        </div>
        <p className="section-eyebrow mb-2" style={{color:'var(--critical)'}}>Agotado Total</p>
        <p className="text-4xl font-black text-[var(--critical)] tracking-tight">{outOfStockCount}</p>
      </div>
    </div>
  );
}
