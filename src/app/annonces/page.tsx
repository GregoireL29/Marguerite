"use client";

import { useUserProfile } from "@/components/AppShell";
import { SalarieAnnonces } from "@/components/SalarieAnnonces";
import { ManagerAnnonces } from "@/components/ManagerAnnonces";
import { GerantAnnonces } from "@/components/GerantAnnonces";

export default function AnnoncesPage() {
  const profile = useUserProfile();

  if (!profile) return null;

  if (profile.role === "salarie") {
    return <SalarieAnnonces />;
  }

  if (profile.role === "gerant") {
    return <GerantAnnonces />;
  }

  return <ManagerAnnonces />;
}
