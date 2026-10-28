"use client";

import { useId, type ChangeEvent } from "react";
import { FileUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilePickerProps {
  accept?: string;
  disabled?: boolean;
  fileName?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  buttonLabel?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Selector de archivo con botón propio en español. El input nativo queda oculto
 * pero accesible (teclado y lector de pantalla) y conserva el diálogo del sistema.
 */
export function FilePicker({
  accept,
  disabled,
  fileName,
  onChange,
  buttonLabel = "Seleccionar archivo",
  placeholder = "Ningún archivo seleccionado",
  className,
}: FilePickerProps) {
  const id = useId();
  return (
    <div
      className={cn(
        "flex min-h-14 flex-col gap-3 rounded-lg border border-border bg-background p-2 sm:flex-row sm:items-center",
        disabled && "opacity-60",
        className,
      )}
    >
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={onChange}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        className={cn(
          "inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-xs font-semibold uppercase tracking-wider text-primary-foreground transition-colors hover:bg-primary/90",
          "peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--primary)]",
          disabled && "pointer-events-none",
        )}
      >
        <FileUp className="h-4 w-4" aria-hidden="true" />
        {buttonLabel}
      </label>
      <span
        className={cn("min-w-0 truncate px-1 font-mono text-xs", fileName ? "text-foreground" : "text-muted-foreground")}
        title={fileName || undefined}
        aria-live="polite"
      >
        {fileName || placeholder}
      </span>
    </div>
  );
}
