import bcrypt from "bcryptjs";
import { legacyHashPin } from "./pin-utils";

/** Solo servidor (usa bcryptjs). No importar desde componentes de cliente. */

export function isBcryptHash(stored: string) {
  return stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$");
}

/**
 * El hash heredado (32 bits, reversible por fuerza bruta en milisegundos) solo se acepta
 * si el operador lo habilita de forma explicita durante una migracion.
 */
export function isLegacyPinAllowed(env: NodeJS.ProcessEnv = process.env) {
  return env.KIOSK_ALLOW_LEGACY_PIN === "true";
}

export async function comparePin(
  pin: string,
  storedPin: string,
  options: { allowLegacy?: boolean } = {},
) {
  if (isBcryptHash(storedPin)) return bcrypt.compare(pin, storedPin);
  const allowLegacy = options.allowLegacy ?? isLegacyPinAllowed();
  if (!allowLegacy) return false;
  return storedPin === legacyHashPin(pin);
}
