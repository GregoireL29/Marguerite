"use client";

import { useUserProfile } from "@/components/AppShell";
import { SalarieDocuments } from "@/components/SalarieDocuments";
import { ManagerDocuments } from "@/components/ManagerDocuments";

export default function DocumentsPage() {
  const profile = useUserProfile();

  if (!profile) return null;

  if (profile.role === "salarie") {
    return <SalarieDocuments />;
  }

  return <ManagerDocuments />;
}
