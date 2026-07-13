"use client";

import { useUserProfile } from "@/components/AppShell";
import { FinDeJourneeContent } from "@/components/FinDeJourneeContent";

export default function FinDeJourneePage() {
  const profile = useUserProfile();

  if (!profile) return null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <FinDeJourneeContent />
    </main>
  );
}
