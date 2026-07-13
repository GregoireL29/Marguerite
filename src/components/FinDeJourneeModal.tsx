"use client";

import { FinDeJourneeContent } from "@/components/FinDeJourneeContent";

export function FinDeJourneeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16 sm:items-center">
      <div className="relative w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg">
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-border/40 hover:text-foreground"
        >
          ✕
        </button>
        <FinDeJourneeContent />
      </div>
    </div>
  );
}
