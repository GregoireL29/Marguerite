"use client";

import { useUserProfile } from "@/components/AppShell";
import { ManagerFacturesFournisseurs } from "@/components/FacturesFournisseurs";
import { GerantFacturesFournisseurs } from "@/components/GerantFacturesFournisseurs";

export default function FacturesFournisseursPage() {
  const profile = useUserProfile();

  if (!profile) return null;

  if (profile.role === "gerant") {
    return <GerantFacturesFournisseurs />;
  }

  return <ManagerFacturesFournisseurs />;
}
