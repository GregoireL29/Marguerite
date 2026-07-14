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

  interface VentesDuJour {
    chiffre_affaires: number | null;
    nombre_articles: number | null;
    nombre_visiteurs: number | null;
    nombre_cartes_fidelite: number | null;
  }

  // undefined = chargement, null = aucune saisie pour aujourd'hui.
  const [ventes, setVentes] = useState<VentesDuJour | null | undefined>(undefined);
  const [indicateursActifs, setIndicateursActifs] = useState<{
    panierArticle: boolean;
    tauxTransformation: boolean;
    tauxEncartement: boolean;
  } | null>(null);
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

  const loadVentes = useCallback(async () => {
    if (!profile?.boutique_id) return;
    const today = toISODate(new Date());

    const [boutiqueRes, ventesRes] = await Promise.all([
      supabase
        .from("boutiques")
        .select(
          "indicateur_panier_article_actif, indicateur_taux_transformation_actif, indicateur_taux_encartement_actif"
        )
        .eq("id", profile.boutique_id)
        .single(),
      supabase
        .from("ventes_quotidiennes")
        .select("chiffre_affaires, nombre_articles, nombre_visiteurs, nombre_cartes_fidelite")
        .eq("boutique_id", profile.boutique_id)
        .eq("date", today)
        .maybeSingle(),
    ]);

    if (boutiqueRes.error) {
      setError(boutiqueRes.error.message);
      return;
    }
    if (ventesRes.error) {
      setError(ventesRes.error.message);
      return;
    }

    setIndicateursActifs({
      panierArticle: boutiqueRes.data.indicateur_panier_article_actif,
      tauxTransformation: boutiqueRes.data.indicateur_taux_transformation_actif,
      tauxEncartement: boutiqueRes.data.indicateur_taux_encartement_actif,
    });
    setVentes(
      ventesRes.data
        ? {
            chiffre_affaires: Number(ventesRes.data.chiffre_affaires),
            nombre_articles: ventesRes.data.nombre_articles,
            nombre_visiteurs: ventesRes.data.nombre_visiteurs,
            nombre_cartes_fidelite: ventesRes.data.nombre_cartes_fidelite,
          }
        : null
    );
  }, [profile]);

  useEffect(() => {
    loadTaches();
    if (isManager) loadVentes();
  }, [loadTaches, loadVentes, isManager]);

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
            Chiffre d&apos;affaires et indicateurs du jour
          </h2>
          {ventes === undefined || indicateursActifs === null ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : (
            (() => {
              const manquants: string[] = [];
              if (ventes === null || ventes.chiffre_affaires === null) {
                manquants.push("Chiffre d'affaires");
              }
              if (
                indicateursActifs.panierArticle &&
                (ventes === null || ventes.nombre_articles === null)
              ) {
                manquants.push("Nombre d'articles vendus");
              }
              if (
                indicateursActifs.tauxTransformation &&
                (ventes === null || ventes.nombre_visiteurs === null)
              ) {
                manquants.push("Nombre de visiteurs");
              }
              if (
                indicateursActifs.tauxEncartement &&
                (ventes === null || ventes.nombre_cartes_fidelite === null)
              ) {
                manquants.push("Nombre de cartes de fidélité créées");
              }

              if (manquants.length > 0) {
                return (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                    <p className="text-sm text-foreground">
                      Pas encore saisi : {manquants.join(", ")}.
                    </p>
                    <Link
                      href="/indicateurs/saisie"
                      className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
                    >
                      Saisir
                    </Link>
                  </div>
                );
              }

              return (
                <p className="text-sm text-green-600 dark:text-green-400">
                  Tout est saisi pour aujourd&apos;hui : CA{" "}
                  {ventes!.chiffre_affaires!.toLocaleString("fr-FR")} €
                  {indicateursActifs.panierArticle &&
                    ` · ${ventes!.nombre_articles} articles`}
                  {indicateursActifs.tauxTransformation &&
                    ` · ${ventes!.nombre_visiteurs} visiteurs`}
                  {indicateursActifs.tauxEncartement &&
                    ` · ${ventes!.nombre_cartes_fidelite} cartes fidélité`}
                </p>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}
