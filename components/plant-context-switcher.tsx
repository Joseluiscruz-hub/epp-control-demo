"use client";

import { useEffect } from "react";
import { MapPin } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLANTS, normalizePlantId, plantLabel, type ActivePlantId } from "@/lib/plants";
import { usePlantStore } from "@/store/usePlantStore";

export function PlantContextSwitcher({ compact = false }: { compact?: boolean }) {
  const { profile, isGlobalAdmin } = useAuth();
  const { activePlantId, setActivePlant } = usePlantStore();

  const localPlantId = normalizePlantId(profile?.plantaId);

  useEffect(() => {
    if (!profile || isGlobalAdmin) return;
    setActivePlant(localPlantId);
  }, [isGlobalAdmin, localPlantId, profile, setActivePlant]);

  if (!profile) return null;

  if (!isGlobalAdmin) {
    return (
      <div className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-bold text-white/60">
        <MapPin className="h-3.5 w-3.5 text-red-300" />
        <span className={compact ? "sr-only" : ""}>{plantLabel(localPlantId)}</span>
      </div>
    );
  }

  return (
    <Select value={activePlantId} onValueChange={(value) => setActivePlant(value as ActivePlantId)}>
      <SelectTrigger
        className={`h-9 rounded-lg border-white/10 bg-white/5 text-xs font-bold text-white ${
          compact ? "w-full" : "w-[190px]"
        }`}
        aria-label="Seleccionar planta activa"
      >
        <MapPin className="h-3.5 w-3.5 shrink-0 text-red-300" aria-hidden="true" />
        <SelectValue placeholder="Planta">
          {(value: unknown) => plantLabel(value)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="rounded-xl border-white/10 bg-muted text-white">
        <SelectItem value="todas">Vista Global</SelectItem>
        {PLANTS.map((plant) => (
          <SelectItem key={plant.id} value={plant.id}>
            {plant.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
