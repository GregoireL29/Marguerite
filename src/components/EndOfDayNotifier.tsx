"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";
import { FinDeJourneeModal } from "@/components/FinDeJourneeModal";
import { getFermetureMinutesAujourdhui, type Horaires } from "@/lib/horaires";
import { toISODate } from "@/lib/indicateurs";

const FENETRE_NOTIF_MINUTES = 10;
const INTERVALLE_VERIF_MS = 60_000;

// Notification navigateur ~10 min avant la fermeture de la boutique du
// jour, visible uniquement onglet ouvert (pas de service worker). Ciblé
// manager uniquement : la fermeture boutique n'est pas l'heure de fin de
// service personnelle d'un salarié.
export function EndOfDayNotifier() {
  const profile = useUserProfile();
  const [showModal, setShowModal] = useState(false);
  const horairesRef = useRef<Horaires | null>(null);

  const isManager = profile?.role === "manager";
  const boutiqueId = profile?.boutique_id ?? null;

  useEffect(() => {
    if (!isManager || !boutiqueId) return;

    let cancelled = false;

    supabase
      .from("boutiques")
      .select("horaires")
      .eq("id", boutiqueId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) horairesRef.current = data.horaires as Horaires;
      });

    // Demande de permission une seule fois, jamais réclamée en boucle à
    // chaque session : au pire l'utilisateur l'active plus tard dans les
    // réglages du navigateur.
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default" &&
      !localStorage.getItem("marguerite-notif-permission-asked")
    ) {
      localStorage.setItem("marguerite-notif-permission-asked", "1");
      Notification.requestPermission();
    }

    function check() {
      const horaires = horairesRef.current;
      if (!horaires) return;

      const fermeture = getFermetureMinutesAujourdhui(horaires);
      if (fermeture === null) return;

      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const restant = fermeture - nowMinutes;

      if (restant < 0 || restant > FENETRE_NOTIF_MINUTES) return;

      const flagKey = `marguerite-fin-journee-${boutiqueId}-${toISODate(now)}`;
      if (localStorage.getItem(flagKey)) return;
      localStorage.setItem(flagKey, "1");

      if (document.visibilityState === "visible") {
        setShowModal(true);
      } else if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        const notif = new Notification("Marguerite", {
          body: "La boutique ferme bientôt : tâches et CA du jour à vérifier.",
        });
        notif.onclick = () => {
          window.focus();
          setShowModal(true);
        };
      }
    }

    check();
    const interval = setInterval(check, INTERVALLE_VERIF_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isManager, boutiqueId]);

  if (!showModal) return null;

  return <FinDeJourneeModal onClose={() => setShowModal(false)} />;
}
