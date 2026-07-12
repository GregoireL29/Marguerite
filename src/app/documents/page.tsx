"use client";

import { useState } from "react";
import { useUserProfile } from "@/components/AppShell";
import { SalarieDocuments } from "@/components/SalarieDocuments";
import { ManagerDocuments } from "@/components/ManagerDocuments";
import { BoutiqueSelector } from "@/components/BoutiqueSelector";

export default function DocumentsPage() {
  const profile = useUserProfile();
  const [selectedBoutiqueId, setSelectedBoutiqueId] = useState<string | null>(null);

  if (!profile) return null;

  if (profile.role === "salarie") {
    return <SalarieDocuments />;
  }

  if (profile.role === "gerant") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-8">
        <BoutiqueSelector value={selectedBoutiqueId} onChange={setSelectedBoutiqueId} />
        {selectedBoutiqueId && <ManagerDocuments boutiqueId={selectedBoutiqueId} />}
      </div>
    );
  }

  return <ManagerDocuments />;
}
