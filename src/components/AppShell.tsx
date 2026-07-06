"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { AppMenu } from "@/components/AppMenu";
import { OnboardingScreen } from "@/components/OnboardingScreen";

type Status = "loading" | "logged-out" | "onboarding" | "ready";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [session, setSession] = useState<Session | null>(null);

  const checkOnboarding = useCallback(async (session: Session | null) => {
    if (!session) {
      setSession(null);
      setStatus("logged-out");
      return;
    }

    setSession(session);

    const { data } = await supabase
      .from("utilisateurs")
      .select("id, structure_id")
      .eq("auth_id", session.user.id)
      .maybeSingle();

    setStatus(!data || !data.structure_id ? "onboarding" : "ready");
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

  if (status === "loading") {
    return null;
  }

  if (status === "onboarding" && session) {
    return (
      <OnboardingScreen
        authId={session.user.id}
        email={session.user.email ?? ""}
        onComplete={() => checkOnboarding(session)}
      />
    );
  }

  return (
    <>
      {status === "ready" && <AppMenu />}
      {children}
    </>
  );
}
