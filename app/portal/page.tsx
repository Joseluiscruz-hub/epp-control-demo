"use client";

import { useState } from 'react';
import { getAppCheckTokenForRequest, isAppCheckRequiredForClient } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HardHat, Search, AlertTriangle, CheckCircle2, ArrowLeft, Loader2, ShieldCheck, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { replacementUrgency, replacementUrgencyTextClass } from '@/lib/replacement-urgency';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { canUseLocalFallback, getLocalKioskEmployee, getLocalPPECatalog, listLocalAssignmentsForEmployee } from '@/lib/kiosk-local-store';

interface Assignment {
  id: string;
  sku: string;
  itemId?: string;
  itemName?: string;
  size?: string;
  assignedAt: Date;
  nextReplacementAt?: Date;
  status: string;
}

interface Employee {
  id: string;
  name: string;
  area: string;
}

type PortalEmployeeData = {
  id?: string;
  name?: string;
  area?: string;
  plantArea?: string;
  active?: boolean;
};

type PortalAssignmentData = {
  id?: string;
  sku?: string;
  itemId?: string;
  itemName?: string;
  description?: string;
  size?: string;
  assignedAt?: string;
  nextReplacementAt?: string;
  status?: string;
};

type PortalEmployeePayload = {
  employee?: PortalEmployeeData | null;
  assignments?: PortalAssignmentData[];
  error?: string;
};

function parseRequiredDate(value: unknown) {
  if (typeof value !== 'string') return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function parseOptionalDate(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function buildLocalAssignments(employeeId: string): Assignment[] {
  const catalog = getLocalPPECatalog();

  return listLocalAssignmentsForEmployee(employeeId).map((assignment) => {
    const item = catalog.find((candidate) => (
      candidate.id === assignment.itemId ||
      candidate.sku === assignment.sku ||
      Object.values(candidate.sizes ?? {}).some((variant) => variant.sku === assignment.sku)
    ));

    return {
      id: assignment.id,
      sku: assignment.sku,
      itemId: assignment.itemId,
      itemName: item?.name,
      size: assignment.size,
      assignedAt: assignment.assignedAt,
      nextReplacementAt: assignment.nextReplacementAt,
      status: assignment.status,
    };
  });
}

export default function UserPortal() {
  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmployeeId = employeeId.replace(/\D/g, '').trim();
    if (!normalizedEmployeeId) return;

    setLoading(true);
    try {
      const appCheckToken = await getAppCheckTokenForRequest();
      if (!appCheckToken && isAppCheckRequiredForClient()) {
        throw new Error('missing_app_check');
      }

      const employeeResponse = await fetch('/api/portal/employee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
        },
        body: JSON.stringify({ employeeId: normalizedEmployeeId }),
      });
      const payload = await employeeResponse.json().catch(() => ({})) as PortalEmployeePayload;
      if (!employeeResponse.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'portal_employee_lookup_failed');
      }
      const employeeData = payload?.employee;

      if (!employeeData || employeeData.active !== true) {
        if (!canUseLocalFallback()) {
          setEmployee(null);
          setAssignments([]);
          toast.error('Número de empleado no válido');
          return;
        }

        const localEmployee = getLocalKioskEmployee(normalizedEmployeeId);
        if (!localEmployee || localEmployee.active !== true) {
          setEmployee(null);
          setAssignments([]);
          toast.error('Número de empleado no válido');
          return;
        }
        setEmployee({
          id: localEmployee.id,
          name: localEmployee.name,
          area: localEmployee.area ?? localEmployee.plantArea ?? 'SIN ÁREA',
        });
        setAssignments(buildLocalAssignments(localEmployee.id));
        return;
      }

      setEmployee({
        id: employeeData.id ?? normalizedEmployeeId,
        name: employeeData.name ?? 'Colaborador',
        area: employeeData.area ?? employeeData.plantArea ?? 'SIN ÁREA',
      });

      const assignmentData = Array.isArray(payload?.assignments) ? payload.assignments : [];
      setAssignments(assignmentData.map((assignment, index) => ({
        id: assignment.id ?? `${normalizedEmployeeId}-${assignment.sku ?? 'sku'}-${index}`,
        sku: assignment.sku ?? 'SIN SKU',
        itemId: assignment.itemId,
        itemName: assignment.itemName || assignment.description || assignment.sku || 'SIN DESCRIPCIÓN',
        size: assignment.size,
        assignedAt: parseRequiredDate(assignment.assignedAt),
        nextReplacementAt: parseOptionalDate(assignment.nextReplacementAt),
        status: assignment.status ?? 'active',
      })));
    } catch (error) {
      console.error(error);
      if (!canUseLocalFallback()) {
        toast.error('Error de conexión con el servidor corporativo');
        return;
      }

      const localEmployee = getLocalKioskEmployee(normalizedEmployeeId);
      if (!localEmployee || localEmployee.active !== true) {
        toast.error('Error de conexión con el servidor corporativo');
        return;
      }
      setEmployee({
        id: localEmployee.id,
        name: localEmployee.name,
        area: localEmployee.area ?? localEmployee.plantArea ?? 'SIN ÁREA',
      });
      setAssignments(buildLocalAssignments(localEmployee.id));
      toast.warning('Modo offline: datos locales cargados');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* ── Dynamic Background ───────────────────── */}
      <div className="absolute inset-0 pointer-events-none">
      </div>

      <div className="w-full max-w-2xl relative z-10">
        {/* ── Branding ───────────────────────────── */}
        <motion.div 
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <div className="inline-flex h-16 w-16 rounded-xl bg-white/5 border border-white/10 items-center justify-center mb-8">
            <ShieldCheck className="h-10 w-10 text-[var(--primary)]" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Portal de Seguridad</h1>
          <p className="text-[var(--primary)] font-black tracking-[0.3em] uppercase text-[10px]">Plataforma corporativa</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!employee ? (
            <motion.div
              key="search-box"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5, type: "spring", damping: 20 }}
            >
              <div className="enterprise-panel relative">
                <div className="p-8 pb-5 text-center">
                  <h2 className="text-2xl font-black text-white tracking-tight">Bienvenido, Colaborador</h2>
                  <p className="text-sm text-white/50 font-medium mt-2">Consulta el estado de tu Equipo de Protección Personal.</p>
                </div>
                <div className="p-8 pt-5">
                  <form onSubmit={handleSearch} className="space-y-6">
                    <div className="relative group">
                      <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-6 w-6 text-white/40 group-focus-within:text-[var(--primary)] transition-colors" />
                      <Input
                        placeholder="Número de Nómina"
                        className="pl-16 py-7 text-xl rounded-lg border-white/10 bg-white/5 focus-visible:ring-1 focus-visible:ring-[var(--primary)] focus-visible:border-[var(--primary)] text-white placeholder:text-white/30 transition-all font-black text-center"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value.replace(/\D/g, '').slice(0, 12))}
                        inputMode="numeric"
                        autoFocus
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full h-14 text-sm font-black bg-[var(--primary)] hover:bg-primary text-white transition-all active:scale-[0.98] rounded-lg uppercase tracking-widest group"
                      disabled={loading || !employeeId.trim()}
                    >
                      {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                        <>
                          Validar Identidad
                          <ArrowLeft className="ml-3 h-5 w-5 rotate-180 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </Button>
                    <Link
                      href="/kiosko"
                      className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/5 h-14 text-[11px] font-bold uppercase tracking-widest text-white/70 transition-all hover:border-[var(--primary)]/50 hover:text-white"
                    >
                      <HardHat className="h-4 w-4 text-primary" />
                      Solicitar EPP en Kiosko
                    </Link>
                  </form>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="profile-data"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
            {/* ── Corporate Profile Card ───────────────── */}
            <div className="enterprise-panel">
              <div className="bg-card/50 p-8 flex flex-col sm:flex-row items-center justify-between gap-6 border-b border-white/10">
                <div className="flex items-center gap-6 text-center sm:text-left">
                  <div className="h-14 w-14 rounded-lg bg-[var(--primary)]/20 border border-[var(--primary)]/30 flex items-center justify-center text-[var(--primary)]">
                    <HardHat className="h-8 w-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">{employee.name}</h2>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2">
                       <span className="bg-white/10 text-white/80 px-3 py-1 font-bold rounded-lg text-[10px] tracking-widest">ID: {employee.id}</span>
                       <span className="bg-[var(--primary)] text-white px-3 py-1 font-bold rounded-lg text-[10px] tracking-widest uppercase">{employee.area}</span>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEmployee(null)} className="text-white/40 hover:text-white hover:bg-white/10 rounded-lg px-4 py-5 font-bold uppercase tracking-widest text-[10px]">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Salir
                </Button>
              </div>

              <div className="p-8">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] pl-1 mb-4">Inventario Asignado</h3>
                  
                  {assignments.length === 0 ? (
                    <div className="py-16 text-center space-y-4 rounded-lg border border-white/5 bg-white/[0.02]">
                       <div className="h-16 w-16 bg-white/5 rounded-lg flex items-center justify-center mx-auto">
                          <Activity className="h-8 w-8 text-white/20" />
                       </div>
                       <p className="text-white/50 font-bold text-sm">No se registran equipos asignados a esta nómina.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {assignments.map((ass) => {
                        const isActive = ass.status === 'active';
                        const urgency = replacementUrgency(ass.nextReplacementAt);
                        const isOverdue = urgency === 'overdue';
                        
                        return (
                          <motion.div
                            key={ass.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`surface-action p-5 flex flex-col sm:flex-row items-center justify-between gap-4 ${!isActive ? 'opacity-50 grayscale' : ''}`}
                          >
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${isActive ? (isOverdue ? 'bg-[var(--critical)]/15 text-[var(--critical)]' : 'bg-primary/15 text-primary') : 'bg-white/10 text-white/40'}`}>
                                <ShieldCheck className="h-6 w-6" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-lg font-black text-white tracking-tight leading-tight break-words">
                                  {ass.itemName || ass.sku}
                                </h4>
                                <p className="text-[10px] text-white/35 font-bold uppercase tracking-widest mt-1">
                                  SKU: {ass.sku}
                                  {ass.size && ass.size !== 'N/A' ? ` · Talla: ${ass.size}` : ''}
                                </p>
                                <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-0.5">
                                  Entrega: {format(ass.assignedAt, "dd MMM, yyyy", { locale: es })}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-center sm:items-end gap-2 w-full sm:w-auto">
                              {isActive ? (
                                isOverdue ? (
                                  <div className="bg-[var(--critical)]/10 text-[var(--critical)] border border-[var(--critical)]/30 flex items-center gap-2 py-1.5 px-4 rounded-lg font-bold text-[10px] tracking-widest uppercase">
                                    <AlertTriangle className="h-3.5 w-3.5" /> Reposición
                                  </div>
                                ) : (
                                  <div className="bg-primary/10 text-primary border border-primary/20 flex items-center gap-2 py-1.5 px-4 rounded-lg font-bold text-[10px] tracking-widest uppercase">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Vigente
                                  </div>
                                )
                              ) : (
                                <div className="bg-white/10 text-white/50 border border-white/10 py-1.5 px-4 rounded-lg font-bold text-[10px] tracking-widest uppercase">
                                  Histórico
                                </div>
                              )}
                              
                              {ass.nextReplacementAt && isActive && (
                                <p className={`text-[9px] font-bold uppercase tracking-widest ${replacementUrgencyTextClass(urgency)}`}>
                                  Cambio: {format(ass.nextReplacementAt, "dd/MM/yyyy")}
                                </p>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="enterprise-panel p-6 text-center">
              <Link
                href="/kiosko"
                className="mb-4 flex w-full items-center justify-center gap-3 rounded-lg bg-[var(--primary)] px-6 py-4 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-primary"
              >
                <HardHat className="h-4 w-4" />
                Abrir Kiosko para solicitar EPP
              </Link>
              <p className="text-white/40 text-[11px] font-medium leading-relaxed max-w-sm mx-auto">
                Si encuentras discrepancias, reportalo al área de <span className="text-[var(--primary)] font-bold uppercase">Seguridad Industrial</span>.
              </p>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
        
        {/* ── Footer ───────────────────────────────── */}
        <div className="mt-12 text-center space-y-4 relative z-10">
          <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em]">AssetGuard v4.0</p>
          <div className="flex items-center justify-center gap-6">
            <Link href="/" className="text-white/40 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest">Admin Login</Link>
            <div className="h-1 w-1 rounded-full bg-[var(--primary)]" />
            <a href="#" className="text-white/40 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest">Soporte Técnico</a>
          </div>
        </div>
      </div>
    </div>
  );
}
