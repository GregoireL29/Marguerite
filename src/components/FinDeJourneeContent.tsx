"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";
import { TacheReportConfirmation, type TacheStale } from "@/components/TacheReportConfirmation";
import { toISODate, addDays } from "@/lib/indicateurs";

export function FinDeJourneeContent() {
  const profile = useUserProfile();
  const isManager = profile?.role === "manager";
  const isSalarie = profile?.role === "salarie";

  const [taches, setTaches] = useState<TacheStale[] | null>(null);
  // undefined = chargement, null = pas encore saisi, number = déjà saisi.
  const [caSaisi, setCaSaisi] = useState<number | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const loadTaches = useCallback(async () => {
    if (!profile) return;
    const today = toISODate(new Date());

    let query = supabase
      .from("taches")
      .select("id, titre, categorie, boutique_id, assigne_a")
      .eq("date", today)
      .eq("statut", "a_faire");

    if (isManager) {
      if (!profile.boutique_id) {
        setTaches([]);
        return;
      }
      query = query.eq("boutique_id", profile.boutique_id);
    } else {
      query = query.eq("assigne_a", profile.id);
    }

    const { data, error: fetchError } = await query;
    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setTaches((data ?? []) as TacheStale[]);
  }, [profile, isManager]);

  const loadCa = useCallback(async () => {
    if (!profile?.boutique_id) return;
    const today = toISODate(new Date());

    const { data, error: fetchError } = await supabase
      .from("ventes_quotidiennes")
      .select("chiffre_affaires")
      .eq("boutique_id", profile.boutique_id)
      .eq("date", today)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setCaSaisi(data ? Number(data.chiffre_affaires) : null);
  }, [profile]);

  useEffect(() => {
    loadTaches();
    if (isManager) loadCa();
  }, [loadTaches, loadCa, isManager]);

  if (!profile) return null;

  if (!isManager && !isSalarie) {
    return (
      <p className="text-sm text-faint-foreground">
        Cette routine n&apos;est pas disponible pour ce rôle.
      </p>
    );
  }

  const tomorrow = toISODate(addDays(new Date(), 1));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-medium text-foreground">Fin de journée</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isManager
            ? "Un dernier tour avant de fermer."
            : "Un dernier coup d'œil sur tes tâches du jour."}
        </p>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">Tâches du jour</h2>
        {taches === null ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : taches.length === 0 ? (
          <p className="text-sm text-faint-foreground">
            Toutes les tâches du jour sont cochées.
          </p>
        ) : (
          <TacheReportConfirmation
            taches={taches}
            reportToDate={tomorrow}
            embedded
            onDone={loadTaches}
          />
        )}
      </div>

      {isManager && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-foreground">
            Chiffre d&apos;affaires du jour
          </h2>
          {caSaisi === undefined ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : caSaisi === null ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <p className="text-sm text-foreground">Pas encore saisi.</p>
              <Link
                href="/indicateurs/saisie"
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
              >
                Saisir
              </Link>
            </div>
          ) : (
            <p className="text-sm text-green-600 dark:text-green-400">
              Déjà saisi : {caSaisi.toLocaleString("fr-FR")} €
            </p>
          )}
        </div>
      )}
    </div>
  );
}
