"use client";

import { useUserProfile } from "@/components/AppShell";
import { ManagerEcheances } from "@/components/Echeances";
import { GerantEcheances } from "@/components/GerantEcheances";

export default function EcheancesPage() {
  const profile = useUserProfile();

  if (!profile) return null;

  if (profile.role === "gerant") {
    return <GerantEcheances />;
  }

  return <ManagerEcheances />;
}
