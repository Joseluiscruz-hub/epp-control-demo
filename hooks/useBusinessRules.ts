"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { applyBusinessRules, validateBusinessRules, type BusinessRulesSnapshot } from "@/lib/business-rules";

/**
 * Syncs the browser's rule lookups with the active Firestore version so
 * client-side previews (replacement days, reorder points) match the server.
 * If the request fails the in-code defaults stay active.
 */
export function useBusinessRules() {
  const [version, setVersion] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch("/api/admin/business-rules", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = (await res.json()) as BusinessRulesSnapshot;
        if (data.source !== "firestore" || !validateBusinessRules(data).ok || cancelled) return;
        applyBusinessRules(data);
        setVersion(data.version);
      } catch {
        // defaults remain active
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return version;
}
