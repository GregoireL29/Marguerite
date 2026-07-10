"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { AppMenu } from "@/components/AppMenu";
import { OnboardingScreen } from "@/components/OnboardingScreen";

type Status = "loading" | "logged-out" | "onboarding" | "ready";

export interface UserProfile {
  id: string;
  nom: string;
  couleur: string;
  role: string;
  structure_id: string;
  boutique_id: string;
}

const UserProfileContext = createContext<UserProfile | null>(null);

export function useUserProfile() {
  return useContext(UserProfileContext);
}

// Écrans réservés au manager : un salarié qui y accède directement par
// l'URL est renvoyé vers le Planning (lecture seule pour lui).
const MANAGER_ONLY_ROUTES = [
  "/equipe",
  "/boutique",
  "/regles",
  "/indicateurs/saisie",
  "/factures-fournisseurs",
  "/echeances",
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const checkOnboarding = useCallback(async (session: Session | null) => {
    if (!session) {
      setSession(null);
      setProfile(null);
      setStatus("logged-out");
      return;
    }

    setSession(session);

    const { data } = await supabase
      .from("utilisateurs")
      .select("id, nom, couleur, role, structure_id, boutique_id")
      .eq("auth_id", session.user.id)
      .maybeSingle();

    if (!data || !data.structure_id) {
      setProfile(null);
      setStatus("onboarding");
      return;
    }

    setProfile(data as UserProfile);
    setStatus("ready");
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => checkOnboarding(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      checkOnboarding(session);
    });

    return () => subscription.unsubscribe();
  }, [checkOnboarding]);

  const isBlockedRoute =
    status === "ready" &&
    profile?.role === "salarie" &&
    MANAGER_ONLY_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );

  useEffect(() => {
    if (isBlockedRoute) {
      router.replace("/");
    }
  }, [isBlockedRoute, router]);

  // La page d'invitation gère elle-même son propre flux de compte (elle
  // relie un utilisateur déjà créé par le manager) : elle ne doit jamais
  // être remplacée par l'écran "créer une nouvelle structure", y compris
  // dans la fenêtre où un compte fraîchement inscrit n'est pas encore relié.
  const isJoinRoute = pathname?.startsWith("/rejoindre/") ?? false;

  if (status === "loading") {
    return null;
  }

  if (status === "onboarding" && session && !isJoinRoute) {
    return (
      <OnboardingScreen
        authId={session.user.id}
        email={session.user.email ?? ""}
        onComplete={() => checkOnboarding(session)}
      />
    );
  }

  return (
    <UserProfileContext.Provider value={profile}>
      {status === "ready" && <AppMenu />}
      {isBlockedRoute ? null : children}
    </UserProfileContext.Provider>
  );
}
