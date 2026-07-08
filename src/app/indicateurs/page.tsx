"use client";

import { useUserProfile } from "@/components/AppShell";
import { SalarieIndicateurs } from "@/components/SalarieIndicateurs";
import { ManagerIndicateurs } from "@/components/ManagerIndicateurs";

export default function IndicateursPage() {
  const profile = useUserProfile();

  if (!profile) return null;

  if (profile.role === "salarie") {
    return <SalarieIndicateurs />;
  }

  return <ManagerIndicateurs />;
}
