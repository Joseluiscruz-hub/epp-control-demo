"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Loader2, HardHat, UserCheck, ShieldCheck } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "./auth-provider";
import { collection, query, where, getDocs } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "@/lib/firestore-error";
import { toast } from "sonner";
import { createLocalAssignment, listLocalEmployees, listLocalInventory } from "@/lib/kiosk-local-store";
import { resolveEppReplacementDays } from "@/lib/epp-duration-rules";
import { normalizePlantId } from "@/lib/plants";
import { SERVER_UNAVAILABLE_MESSAGE, canFallbackToLocalNow } from "@/lib/offline-fallback-policy";
import { newIdempotencyKey } from "@/lib/idempotency";
import { fetchWithIdempotencyKey } from "@/lib/idempotent-fetch";
import { usePlantStore } from "@/store/usePlantStore";

type EmployeeOption = { id: string; name: string; area?: string; plantaId?: string };
type ItemSizeOption = { sku?: string; stock?: number; available?: boolean };
type ItemOption = {
  id: string;
  name: string;
  stock: number;
  replacementDays: number;
  plantaId?: string;
  hasSizes?: boolean;
  sizes?: Record<string, ItemSizeOption>;
};

function availableSizeEntries(item: ItemOption | undefined) {
  if (!item?.hasSizes || !item.sizes) return [];
  return Object.entries(item.sizes).filter(([, variant]) => (
    variant.available === true || Number(variant.stock ?? 0) > 0
  ));
}

export function AssignPpeDialog() {
  const { user: authUser } = useAuth();
  const { activePlantId } = usePlantStore();
  const writePlantId = normalizePlantId(activePlantId);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef(false);
  const attemptKeyRef = useRef<{ signature: string; key: string } | null>(null);
  
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);

  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [selectedSize, setSelectedSize] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const empSnap = await getDocs(activePlantId === 'todas'
        ? query(collection(db, 'employees'))
        : query(collection(db, 'employees'), where('plantaId', '==', activePlantId))
      );
      setEmployees(empSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name,
        area: d.data().area,
        plantaId: d.data().plantaId,
      })));

      const itemSnap = await getDocs(activePlantId === 'todas'
        ? query(collection(db, 'ppe_catalog'))
        : query(collection(db, 'ppe_catalog'), where('plantaId', '==', activePlantId))
      );
      setItems(itemSnap.docs.map(d => {
        const data = d.data();
        return {
        id: d.id, 
        name: data.name,
        stock: Number(data.stock ?? 0),
        hasSizes: data.hasSizes === true,
        sizes: data.sizes,
        replacementDays: resolveEppReplacementDays(
          {
            sku: data.sku ?? d.id,
            material: data.material,
            name: data.name,
            sizes: data.sizes,
          },
          Number(data.replacementDays ?? 365)
        )
        ,
        plantaId: data.plantaId,
      };
      }));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'employees/ppe_catalog');
      setEmployees(listLocalEmployees().map((employee) => ({ id: employee.id, name: employee.name })));
      setItems(listLocalInventory().map((item) => ({
        id: item.docId,
        name: item.name,
        stock: Number(item.stock ?? 0),
        replacementDays: Number(item.replacementDays ?? 365),
      })));
    }
  }, [activePlantId]);

  useEffect(() => {
    if (!open) return;

    void (async () => {
      await fetchData();
    })();
  }, [fetchData, open]);

  const selectedItemRecord = useMemo(
    () => items.find((item) => item.id === selectedItem),
    [items, selectedItem]
  );
  const selectedItemSizes = useMemo(
    () => availableSizeEntries(selectedItemRecord),
    [selectedItemRecord]
  );

  const handleItemSelect = (value: string | null) => {
    const nextItemId = value || "";
    const nextItem = items.find((item) => item.id === nextItemId);
    setSelectedItem(nextItemId);
    setSelectedSize(availableSizeEntries(nextItem)[0]?.[0] ?? "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !selectedItem || !authUser) return;
    // Candado sincrono: evita un segundo envio antes de que React deshabilite el boton.
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setLoading(true);
    try {
      const itemRecord = items.find(i => i.id === selectedItem);
      const employeeRecord = employees.find(employee => employee.id === selectedEmployee);
      if (!itemRecord) throw new Error("Item no encontrado");
      if (itemRecord.hasSizes && !selectedSize) {
        toast.error("Selecciona una talla disponible para este material.");
        setLoading(false);
        return;
      }

      if (itemRecord.stock <= 0) {
        toast.error("No hay stock disponible para este artículo.");
        setLoading(false);
        return;
      }

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("missing_admin_session");

      // Una llave por intento de entrega; se reutiliza si el admin reintenta la misma entrega.
      const attemptSignature = `${selectedEmployee}|${selectedItem}|${itemRecord.hasSizes ? selectedSize : "N/A"}`;
      if (!attemptKeyRef.current || attemptKeyRef.current.signature !== attemptSignature) {
        attemptKeyRef.current = { signature: attemptSignature, key: newIdempotencyKey() };
      }

      const response = await fetchWithIdempotencyKey("/api/assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: {
          employeeId: selectedEmployee,
          itemId: selectedItem,
          size: itemRecord.hasSizes ? selectedSize : "N/A",
          plantaId: normalizePlantId(employeeRecord?.plantaId ?? itemRecord.plantaId ?? writePlantId),
        },
      }, attemptKeyRef.current.key);
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(typeof errorBody?.error === "string" ? errorBody.error : "assignment_failed");
      }

      attemptKeyRef.current = null;
      toast.success("EPP Asignado exitosamente");
      setOpen(false);
      setSelectedEmployee("");
      setSelectedItem("");
      setSelectedSize("");
    } catch (err) {
      try {
        // Solo sin red real + modo offline (o herramienta local). Un error del servidor
        // nunca crea una asignacion local: el servidor pudo haber registrado la entrega.
        if (!canFallbackToLocalNow()) throw err;
        const itemRecord = items.find(i => i.id === selectedItem);
        if (!itemRecord) throw err;
        createLocalAssignment({
          employeeId: selectedEmployee,
          sku: selectedItem,
          size: itemRecord.hasSizes ? selectedSize : 'N/A',
          itemId: selectedItem,
          replacementDays: itemRecord.replacementDays,
          issuedByUserId: authUser?.uid || 'offline-admin',
        });
        toast.success("EPP asignado localmente");
        setOpen(false);
        setSelectedEmployee("");
        setSelectedItem("");
        setSelectedSize("");
      } catch {
        if (err instanceof Error && err.message === 'out_of_stock') {
          toast.error("No hay stock disponible para este artículo.");
        } else if (err instanceof TypeError) {
          toast.error(SERVER_UNAVAILABLE_MESSAGE);
        } else if (err instanceof Error && err.message && !/^[a-z_]+$/.test(err.message)) {
          // Mensaje claro del servidor (p. ej. planta invalida, sin stock).
          toast.error(err.message);
        } else {
          toast.error("Hubo un error al registrar la entrega. No se guardo nada localmente.");
        }
        handleFirestoreError(err, OperationType.CREATE, 'assignments');
      }
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="surface-action w-full flex items-center justify-between p-4 group text-left"
      >
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-[var(--primary)] flex items-center justify-center group-hover:scale-105 transition-transform">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-black text-white leading-tight uppercase tracking-wide">Nueva Dotación</p>
            <p className="section-eyebrow mt-1">Asignar material a nómina</p>
          </div>
        </div>
        <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-white/5 group-hover:bg-[var(--primary)] transition-colors">
          <ArrowRight className="h-4 w-4 text-white/35 group-hover:text-white transition-colors" />
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-xl border border-white/10 p-0 overflow-hidden bg-background">
          <div className="bg-white/[0.055] p-7 text-white relative border-b border-white/10">
             <div className="absolute top-0 right-0 p-8 opacity-5">
                <HardHat className="h-20 w-20" />
             </div>
             <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight">Registro de Entrega</DialogTitle>
                <p className="text-white/50 font-bold mt-1">Vincular EPP a un colaborador en planta.</p>
             </DialogHeader>
          </div>
          
          <form onSubmit={handleSubmit} className="p-7 space-y-6">
            <div className="space-y-4">
              <Label className="section-eyebrow ml-1">Seleccionar Colaborador</Label>
              <Select value={selectedEmployee} onValueChange={v => setSelectedEmployee(v || '')} disabled={loading}>
                <SelectTrigger className="h-14 rounded-lg bg-white/5 border-white/10 font-bold text-white px-5">
                  <div className="flex items-center gap-3">
                    <UserCheck className="h-5 w-5 text-red-600" />
                    <SelectValue placeholder="Buscar por nombre..." />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-lg border-white/10 bg-card text-white">
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id} className="font-bold py-3 px-4">{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <Label className="section-eyebrow ml-1">Especificación de Equipo (SKU)</Label>
              <Select value={selectedItem} onValueChange={handleItemSelect} disabled={loading}>
                <SelectTrigger className="h-14 rounded-lg bg-white/5 border-white/10 font-bold text-white px-5">
                  <div className="flex items-center gap-3">
                    <HardHat className="h-5 w-5 text-red-600" />
                    <SelectValue placeholder="Seleccionar material..." />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-lg border-white/10 bg-card text-white">
                  {items.map(it => (
                    <SelectItem key={it.id} value={it.id} className="font-bold py-3 px-4">
                       <div className="flex justify-between items-center w-full gap-10">
                          <span>{it.name}</span>
                          <Badge className="rounded-md bg-white/10 text-white/60 border-none font-black text-[9px]">STOCK: {it.stock}</Badge>
                       </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedItemRecord?.hasSizes && (
              <div className="space-y-4">
                <Label className="section-eyebrow ml-1">Talla disponible</Label>
                <Select value={selectedSize} onValueChange={v => setSelectedSize(v || '')} disabled={loading || selectedItemSizes.length === 0}>
                  <SelectTrigger className="h-14 rounded-lg bg-white/5 border-white/10 font-bold text-white px-5">
                    <SelectValue placeholder="Seleccionar talla..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border-white/10 bg-card text-white">
                    {selectedItemSizes.map(([size, variant]) => (
                      <SelectItem key={size} value={size} className="font-bold py-3 px-4">
                        <div className="flex justify-between items-center w-full gap-10">
                          <span>{size}</span>
                          <Badge className="rounded-md bg-white/10 text-white/60 border-none font-black text-[9px]">STOCK: {Number(variant.stock ?? 0)}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-14 rounded-lg bg-[var(--primary)] hover:bg-primary text-white font-black uppercase tracking-widest transition-all text-sm active:scale-95"
              disabled={loading || !selectedEmployee || !selectedItem || (selectedItemRecord?.hasSizes && !selectedSize)}
            >
              {loading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : "Confirmar Dotación Técnica"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
