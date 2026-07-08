"use client";

import { useUserProfile } from "@/components/AppShell";
import { SalarieTaches } from "@/components/SalarieTaches";
import { ManagerTaches } from "@/components/ManagerTaches";

export default function TachesPage() {
  const profile = useUserProfile();

  if (!profile) return null;

  if (profile.role === "salarie") {
    return <SalarieTaches />;
  }

  return <ManagerTaches />;
}
