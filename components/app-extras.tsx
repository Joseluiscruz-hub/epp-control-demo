"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AiChatPanel } from "@/components/ai-chat-panel";
import { isPublicFlowPath } from "@/lib/app-routes";

export function AppMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicFlow = isPublicFlowPath(pathname);

  if (isPublicFlow) {
    return <main className="relative z-10 min-h-screen">{children}</main>;
  }

  return (
    <div className="lg:pl-64">
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 animate-fade-in">
        {children}
      </main>
    </div>
  );
}

export function AppExtras() {
  const pathname = usePathname();
  const isPublicFlow = isPublicFlowPath(pathname);

  if (isPublicFlow) return null;

  return (
    <>
      <footer className="relative z-10 no-print mt-auto lg:pl-64">
        <div className="brand-divider mx-8" />
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span className="text-shell-muted text-[10px] uppercase tracking-[0.2em] font-bold">
            AssetGuard Corporate v4.0
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: "rgb(var(--primary-rgb)/0.7)" }}>
            Impulsado por Gemini
          </span>
        </div>
      </footer>
      <AiChatPanel />
    </>
  );
}
