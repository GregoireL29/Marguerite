"use client";

import { useUserProfile } from "@/components/AppShell";
import { SalarieAnnonces } from "@/components/SalarieAnnonces";
import { ManagerAnnonces } from "@/components/ManagerAnnonces";

export default function AnnoncesPage() {
  const profile = useUserProfile();

  if (!profile) return null;

  if (profile.role === "salarie") {
    return <SalarieAnnonces />;
  }

  return <ManagerAnnonces />;
}
