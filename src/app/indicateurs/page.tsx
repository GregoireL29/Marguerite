"use client";

import { useUserProfile } from "@/components/AppShell";
import { SalarieIndicateurs } from "@/components/SalarieIndicateurs";
import { ManagerIndicateurs } from "@/components/ManagerIndicateurs";
import { GerantIndicateurs } from "@/components/GerantIndicateurs";

export default function IndicateursPage() {
  const profile = useUserProfile();

  if (!profile) return null;

  if (profile.role === "salarie") {
    return <SalarieIndicateurs />;
  }

  if (profile.role === "gerant") {
    return <GerantIndicateurs />;
  }

  return <ManagerIndicateurs />;
}
