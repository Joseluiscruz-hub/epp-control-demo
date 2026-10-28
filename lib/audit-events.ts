import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";
import { getIpHashSalt, getTrustedClientIp, isIpHashSaltConfigured } from "./request-ip";

export type AuditEventInput = {
  type: string;
  actorUid?: string;
  actorEmail?: string;
  targetCollection: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
};

function getClientIp(req?: NextRequest) {
  if (!req) return "";
  const ip = getTrustedClientIp(req.headers);
  return ip === "unknown" ? "" : ip;
}

function hashIp(ip: string) {
  if (!ip) return null;
  // In production, never persist an IP hash built with a public/hardcoded salt:
  // it could be reversed by brute force over the IPv4 space.
  if (process.env.NODE_ENV === "production" && !isIpHashSaltConfigured()) {
    getIpHashSalt("assetguard-audit"); // logs a one-time warning
    return null;
  }
  const salt = getIpHashSalt("assetguard-audit");
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export function buildAuditEvent(input: AuditEventInput, req?: NextRequest) {
  return {
    type: input.type,
    actorUid: input.actorUid ?? null,
    actorEmail: input.actorEmail ?? null,
    targetCollection: input.targetCollection,
    targetId: input.targetId,
    before: input.before ?? null,
    after: input.after ?? null,
    metadata: input.metadata ?? {},
    ipHash: hashIp(getClientIp(req)),
    userAgent: req?.headers.get("user-agent") ?? null,
    createdAt: FieldValue.serverTimestamp(),
  };
}
