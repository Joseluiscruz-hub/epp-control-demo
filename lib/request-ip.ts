/**
 * Client IP resolution and IP-hash salt handling shared by rate limiting and
 * audit logging.
 *
 * X-Forwarded-For is a comma separated list where every proxy *appends* the
 * address it saw. Only the entries appended by our own infrastructure can be
 * trusted; anything to the left may be supplied by the caller. On Cloud Run the
 * Google front end appends the real client address, so the trusted client IP is
 * found by walking the list from the right, skipping internal/private hops
 * (e.g. 169.254.x.x) and `TRUSTED_PROXY_HOPS - 1` additional public proxies
 * (set TRUSTED_PROXY_HOPS=2 when an external HTTPS load balancer is in front).
 */

type HeaderSource = { get(name: string): string | null };

const MAX_IP_LENGTH = 64;

function normalizeIpCandidate(value: string) {
  let candidate = value.trim().replace(/^"|"$/g, "");
  if (!candidate || candidate.length > MAX_IP_LENGTH) return "";
  // [IPv6]:port or [IPv6]
  const bracketed = candidate.match(/^\[([0-9a-fA-F:.]+)\](?::\d+)?$/);
  if (bracketed) return bracketed[1].toLowerCase();
  // IPv4:port
  const ipv4WithPort = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) candidate = ipv4WithPort[1];
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(candidate)) return candidate;
  if (/^[0-9a-fA-F:.]+$/.test(candidate) && candidate.includes(":")) return candidate.toLowerCase();
  return "";
}

export function isInternalIp(ip: string) {
  const mapped = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const v4 = mapped.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const v6 = mapped.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || /^fe[89ab]/.test(v6);
}

function trustedProxyHops() {
  const parsed = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 10 ? parsed : 1;
}

export function getTrustedClientIp(headers: HeaderSource, hops = trustedProxyHops()): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const entries = forwardedFor
      .split(",")
      .map(normalizeIpCandidate)
      .filter(Boolean);
    const publicEntries = entries.filter((ip) => !isInternalIp(ip));
    if (publicEntries.length > 0) {
      // Rightmost public entry is the hop appended by the closest trusted
      // proxy. With N trusted public proxies, the client is N-1 further left.
      const index = Math.max(0, publicEntries.length - hops);
      return publicEntries[index];
    }
    if (entries.length > 0) return entries[entries.length - 1];
  }

  // Only used when no X-Forwarded-For is present (e.g. local development).
  return normalizeIpCandidate(headers.get("x-real-ip") ?? "") || "unknown";
}

let warnedMissingSalt = false;

/**
 * Returns the configured AUDIT_IP_SALT. Outside production a stable fallback is
 * used so local development and tests keep working. In production the
 * fallback is still returned (so rate limiting keeps working) but a warning is
 * logged once, and `isIpHashSaltConfigured()` lets callers that persist hashes
 * (audit events) refuse to store an easily reversible value.
 */
export function getIpHashSalt(fallback: string): string {
  const configured = process.env.AUDIT_IP_SALT?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production" && !warnedMissingSalt) {
    warnedMissingSalt = true;
    console.warn(
      "[security] AUDIT_IP_SALT no esta configurado en produccion: los hashes de IP de auditoria se omiten " +
        "y los limites de tasa usan una sal predecible. Configura el secreto AUDIT_IP_SALT en Secret Manager."
    );
  }
  return process.env.GOOGLE_CLOUD_PROJECT || fallback;
}

export function isIpHashSaltConfigured() {
  return Boolean(process.env.AUDIT_IP_SALT?.trim());
}
