"use client";

import { useUserProfile } from "@/components/AppShell";
import { SalarieAccueil } from "@/components/SalarieAccueil";
import { ManagerAccueil } from "@/components/ManagerAccueil";
import { GerantAccueil } from "@/components/GerantAccueil";

export default function AccueilPage() {
  const profile = useUserProfile();

  if (!profile) return null;

  if (profile.role === "salarie") {
    return <SalarieAccueil />;
  }

  if (profile.role === "gerant") {
    return <GerantAccueil />;
  }

  return <ManagerAccueil />;
}
