"use client";

import { useUserProfile } from "@/components/AppShell";
import { SalarieOnboarding } from "@/components/SalarieOnboarding";
import { ManagerOnboarding } from "@/components/ManagerOnboarding";

export default function OnboardingTabPage() {
  const profile = useUserProfile();

  if (!profile) return null;

  if (profile.role === "salarie") {
    return <SalarieOnboarding />;
  }

  return <ManagerOnboarding />;
}
