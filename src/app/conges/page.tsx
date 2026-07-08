"use client";

import { useUserProfile } from "@/components/AppShell";
import { SalarieConges } from "@/components/SalarieConges";
import { ManagerConges } from "@/components/ManagerConges";

export default function CongesPage() {
  const profile = useUserProfile();

  if (!profile) return null;

  if (profile.role === "salarie") {
    return <SalarieConges />;
  }

  return <ManagerConges />;
}
