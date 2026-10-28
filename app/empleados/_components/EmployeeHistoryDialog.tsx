"use client";

import {
  Dialog, DialogContent, DialogTitle
} from '@/components/ui/dialog';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  HardHat,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'motion/react';
import type { Employee, Assignment, KioskRequestHistory } from '../_hooks/useEmployeeData';
import { replacementUrgency, replacementUrgencyTextClass } from '@/lib/replacement-urgency';

export interface EmployeeHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEmployee: Employee | null;
  history: Assignment[];
  kioskRequests: KioskRequestHistory[];
  historyLoading: boolean;
}

function formatDate(date?: Date, pattern = 'dd MMM, yyyy') {
  if (!date || Number.isNaN(date.getTime())) return 'Fecha pendiente';
  return format(date, pattern, { locale: es });
}

function shortId(id: string) {
  return id.length > 10 ? id.slice(0, 10).toUpperCase() : id.toUpperCase();
}

function requestStatusMeta(status: string) {
  if (status === 'approved') {
    return {
      label: 'Aprobada',
      Icon: CheckCircle2,
      className: 'bg-primary/15 text-primary border-primary/20',
    };
  }
  if (status === 'rejected') {
    return {
      label: 'Rechazada',
      Icon: XCircle,
      className: 'bg-red-400/15 text-red-300 border-red-400/20',
    };
  }
  return {
    label: 'Pendiente',
    Icon: Clock3,
    className: 'bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/20',
  };
}

function reasonLabel(reason?: string) {
  if (reason === 'vida_util') return 'Vida útil';
  if (reason === 'desgaste') return 'Desgaste';
  if (reason === 'extravio') return 'Extravio';
  return 'Solicitud';
}

export function EmployeeHistoryDialog({
  open,
  onOpenChange,
  selectedEmployee,
  history,
  kioskRequests,
  historyLoading,
}: EmployeeHistoryDialogProps) {
  const hasRecords = history.length > 0 || kioskRequests.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl rounded-[2rem] border border-white/10 p-0 overflow-hidden bg-card">
        <div className="bg-[var(--primary)] p-8 text-white flex items-center justify-between gap-6">
          <div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Expediente de Seguridad</DialogTitle>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <p className="text-white font-bold opacity-90">{selectedEmployee?.name}</p>
              <span className="px-2 py-1 bg-white/20 rounded font-black text-[9px] tracking-widest">
                NÓMINA #{selectedEmployee?.id}
              </span>
            </div>
          </div>
          <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
        </div>

        <div className="p-8 max-h-[650px] overflow-y-auto">
          {historyLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-[var(--primary)]" />
            </div>
          ) : !hasRecords ? (
            <div className="text-center py-20 rounded-2xl border border-white/10 bg-white/5">
              <Activity className="h-12 w-12 mx-auto mb-4 text-white/20" />
              <p className="text-white/40 font-bold uppercase tracking-widest text-xs">
                Sin solicitudes ni dotaciones
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {kioskRequests.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-white">
                    <ClipboardList className="h-4 w-4 text-[var(--primary)]" />
                    <h3 className="font-black uppercase tracking-widest text-xs">Solicitudes de Kiosko</h3>
                  </div>

                  <div className="grid gap-3">
                    {kioskRequests.map((request) => {
                      const meta = requestStatusMeta(request.status);
                      const StatusIcon = meta.Icon;
                      const eventDate = request.approvedAt ?? request.rejectedAt ?? request.createdAt;
                      return (
                        <motion.div
                          key={request.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="p-5 rounded-2xl bg-white/5 border border-white/10"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4 min-w-0">
                              <div className={`h-12 w-12 rounded-xl flex items-center justify-center border ${meta.className}`}>
                                <StatusIcon className="h-6 w-6" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-white uppercase text-sm">
                                  Solicitud {shortId(request.id)}
                                </p>
                                <p className="text-[10px] text-white/45 font-bold tracking-widest uppercase mt-1">
                                  {formatDate(eventDate)}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <span className={`inline-flex items-center gap-1.5 font-bold text-[9px] tracking-widest px-3 py-1 rounded-lg border uppercase ${meta.className}`}>
                                {meta.label}
                              </span>
                              {request.hasEarlyReplacementAlert && (
                                <span className="inline-flex items-center gap-1.5 font-bold text-[9px] tracking-widest px-3 py-1 rounded-lg bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20 uppercase">
                                  <AlertTriangle className="h-3 w-3" />
                                  Alerta vida útil
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 grid gap-2">
                            {request.items.map((item, index) => (
                              <div
                                key={`${request.id}-${item.sku}-${index}`}
                                className="flex items-center justify-between gap-3 rounded-xl bg-black/20 border border-white/5 px-4 py-3"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-white truncate">
                                    {item.itemName || item.sku}
                                  </p>
                                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">
                                    SKU {item.sku}{item.size && item.size !== 'N/A' ? ` - Talla ${item.size}` : ''}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest">
                                    {reasonLabel(item.replacementReason)}
                                  </p>
                                  {Number(item.chargeAmount ?? 0) > 0 && (
                                    <p className="text-[10px] text-red-300 font-bold uppercase tracking-widest mt-1">
                                      Cargo ${Number(item.chargeAmount).toFixed(2)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </section>
              )}

              {history.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-white">
                    <HardHat className="h-4 w-4 text-[var(--primary)]" />
                    <h3 className="font-black uppercase tracking-widest text-xs">Dotación asignada</h3>
                  </div>

                  <div className="grid gap-3">
                    {history.map(h => (
                      <motion.div
                        key={h.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between gap-4 p-5 rounded-2xl bg-white/5 border border-white/10"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                            h.status === 'active' ? 'bg-[var(--primary)]/20 text-[var(--primary)]' : 'bg-white/10 text-white/40'
                          }`}>
                            <HardHat className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white text-base uppercase truncate">
                              {h.itemName || h.sku}
                            </p>
                            <p className="text-[10px] text-white/50 font-bold tracking-widest uppercase mt-0.5">
                              DOTACIÓN: {formatDate(h.assignedAt)}
                            </p>
                            {h.size && h.size !== 'N/A' && (
                              <p className="text-[10px] text-white/35 font-bold tracking-widest uppercase mt-0.5">
                                SKU {h.sku} - Talla {h.size}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`inline-block font-bold text-[9px] tracking-widest px-3 py-1 rounded-lg uppercase ${
                            h.status === 'active' ? 'bg-[var(--primary)] text-white' : 'bg-white/10 text-white/40'
                          }`}>
                            {h.status === 'active' ? 'EN OPERACIÓN' : 'HISTÓRICO'}
                          </span>
                          {h.nextReplacementAt && h.status === 'active' && (
                            <p className={`text-[9px] font-bold uppercase tracking-widest mt-1.5 ${replacementUrgencyTextClass(replacementUrgency(h.nextReplacementAt))}`}>
                              Cambio: {formatDate(h.nextReplacementAt, 'dd/MM/yyyy')}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
