"use client";

import { useUserProfile } from "@/components/AppShell";
import { SalarieEntretiens } from "@/components/SalarieEntretiens";
import { GerantEntretiens } from "@/components/GerantEntretiens";

export default function EntretiensPage() {
  const profile = useUserProfile();

  if (!profile) return null;

  // Salarié comme manager demandent un entretien au gérant : même vue
  // "mes demandes" pour les deux, seule la file de traitement est gérant.
  if (profile.role === "gerant") {
    return <GerantEntretiens />;
  }

  return <SalarieEntretiens />;
}
