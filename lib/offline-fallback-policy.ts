/**
 * Politica unica para decidir si una operacion puede guardarse en localStorage
 * (modo offline) en lugar de fallar.
 *
 * Regla: solo si el dispositivo esta REALMENTE sin red (navigator.onLine === false) y el
 * modo offline esta habilitado (NEXT_PUBLIC_ENABLE_OFFLINE_MODE=true). Un error del servidor
 * (5xx, 4xx, timeout con red) NUNCA cae a local: el servidor pudo haber guardado la operacion
 * y un registro local la duplicaria. En ese caso se muestra un error claro.
 *
 * Excepcion: localhost / 127.0.0.1 es la herramienta local de Windows (USO_LOCAL.md) y
 * conserva su respaldo local; no aplica a staging ni a produccion.
 */
export type OfflineFallbackInput = {
  offlineModeEnabled: boolean;
  online: boolean | undefined;
  hostname: string | undefined;
};

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

export function isLocalToolHost(hostname: string | undefined) {
  return typeof hostname === "string" && LOCAL_HOSTNAMES.has(hostname);
}

export function shouldFallbackToLocal(input: OfflineFallbackInput) {
  if (isLocalToolHost(input.hostname)) return true;
  return input.offlineModeEnabled && input.online === false;
}

export function readOfflineFallbackInput(): OfflineFallbackInput {
  return {
    offlineModeEnabled: process.env.NEXT_PUBLIC_ENABLE_OFFLINE_MODE === "true",
    online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
    hostname: typeof window !== "undefined" ? window.location.hostname : undefined,
  };
}

/** Atajo para el navegador: lee navigator, window y la variable de entorno. */
export function canFallbackToLocalNow() {
  return shouldFallbackToLocal(readOfflineFallbackInput());
}

export const SERVER_UNAVAILABLE_MESSAGE =
  "No se pudo completar con el servidor. No se guardo nada localmente; revisa la conexion e intenta de nuevo o avisa a tu supervisor.";

/**
 * Un fallo de red genuino es la excepcion que lanza fetch (TypeError) sin respuesta HTTP.
 * Cualquier error con status (KioskApiError u otra respuesta HTTP) NO es fallo de red.
 */
export function isNetworkFailure(error: unknown) {
  if (!error || typeof error !== "object") return false;
  if ("status" in error && typeof (error as { status?: unknown }).status === "number") return false;
  return error instanceof TypeError;
}

/** Respaldo local solo si hubo excepcion de red Y la politica offline lo permite. */
export function shouldFallbackAfterError(error: unknown, input: OfflineFallbackInput) {
  return isNetworkFailure(error) && shouldFallbackToLocal(input);
}
