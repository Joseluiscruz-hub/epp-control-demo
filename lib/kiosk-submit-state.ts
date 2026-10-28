import type { ReplacementReason } from "./kiosk-types";

export type KioskSubmitInput = {
  selectedCount: number;
  requestReason: ReplacementReason | null;
  submitting: boolean;
};

/**
 * Estado del boton "Enviar a aprobación" del kiosko. Depende solo de las validaciones de
 * negocio (EPP elegido, motivo, envio en curso); no exige desplazarse hasta el final.
 */
export function getKioskSubmitState({ selectedCount, requestReason, submitting }: KioskSubmitInput) {
  if (submitting) return { enabled: false, hint: "" } as const;
  if (selectedCount <= 0) return { enabled: false, hint: "Elige al menos un EPP del catálogo." } as const;
  if (!requestReason) return { enabled: false, hint: "Elige el motivo para continuar." } as const;
  return { enabled: true, hint: "" } as const;
}
