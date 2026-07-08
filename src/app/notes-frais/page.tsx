"use client";

import { useUserProfile } from "@/components/AppShell";
import { SalarieNotesFrais } from "@/components/SalarieNotesFrais";
import { ManagerNotesFrais } from "@/components/ManagerNotesFrais";

export default function NotesFraisPage() {
  const profile = useUserProfile();

  if (!profile) return null;

  if (profile.role === "salarie") {
    return <SalarieNotesFrais />;
  }

  return <ManagerNotesFrais />;
}
