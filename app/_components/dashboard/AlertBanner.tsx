"use client";

import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { Assignment } from '@/app/_hooks/useDashboardData';

// ── Props ─────────────────────────────────────────────────────

export interface AlertBannerProps {
  upcomingAlerts: Assignment[];
}

// ── Component ─────────────────────────────────────────────────

export function AlertBanner({ upcomingAlerts }: AlertBannerProps) {
  return (
    <AnimatePresence>
      {upcomingAlerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="rounded-lg relative p-5 flex flex-col sm:flex-row items-center gap-5"
          style={{
            background: 'rgb(var(--critical-rgb)/0.06)',
            border: '1px solid rgb(var(--critical-rgb)/0.2)',
          }}
        >
          <div className="h-12 w-12 rounded-lg flex items-center justify-center shrink-0 relative z-10" style={{background:'rgb(var(--critical-rgb)/0.15)', border:'1px solid rgb(var(--critical-rgb)/0.25)'}}>
            <AlertTriangle className="h-7 w-7" style={{color:'var(--critical)'}} />
          </div>
          <div className="flex-1 text-center sm:text-left relative z-10">
            <h2 className="text-base font-medium text-foreground mb-1">Alertas críticas de reposición</h2>
            <p className="text-white/50 text-sm font-medium">
              Se detectaron{' '}
              <span className="font-black" style={{color:'var(--critical)'}}>{upcomingAlerts.length} casos críticos</span>
              {' '}de EPP por vencer en planta.
            </p>
          </div>
          <Link href="/empleados" className="relative z-10 shrink-0">
            <Button className="rounded-lg px-5 h-10 font-medium text-sm transition-all group">
              Intervenir
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
