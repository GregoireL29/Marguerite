"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

type Periode = "semaine" | "mois" | "annee";

const PERIODE_LABEL: Record<Periode, string> = {
  semaine: "Semaine",
  mois: "Mois",
  annee: "Année",
};

const PERIODE_ORDER: Record<Periode, number> = {
  semaine: 0,
  mois: 1,
  annee: 2,
};

interface ObjectifProgress {
  periode: Periode;
  ca_cible: number;
  ca_realise: number;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rangeForObjectif(
  periode: Periode,
  dateDebut: string
): { start: string; end: string } {
  const [y, m, d] = dateDebut.split("-").map(Number);
  const start = new Date(y, m - 1, d);

  if (periode === "semaine") {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start: toISODate(start), end: toISODate(end) };
  }
  if (periode === "mois") {
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return { start: toISODate(start), end: toISODate(end) };
  }
  const end = new Date(start.getFullYear(), 11, 31);
  return { start: toISODate(start), end: toISODate(end) };
}

// Vue salarié : juste un repère motivant et collectif — la progression
// vers l'objectif de CA de chaque période en cours (semaine/mois/année),
// sans le détail du CA, du panier moyen ni le bilan diagnostic.
export function SalarieIndicateurs() {
  const profile = useUserProfile();
  const [progressList, setProgressList] = useState<ObjectifProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    const todayISO = toISODate(new Date());

    const { data: objectifs, error: objectifsError } = await supabase
      .from("objectifs")
      .select("periode, date_debut, ca_cible")
      .eq("boutique_id", profile.boutique_id);

    if (objectifsError) {
      setError(objectifsError.message);
      setLoading(false);
      return;
    }

    const actifs = (objectifs ?? []).filter((o) => {
      const { start, end } = rangeForObjectif(
        o.periode as Periode,
        o.date_debut
      );
      return todayISO >= start && todayISO <= end;
    });

    const results: ObjectifProgress[] = [];

    for (const o of actifs) {
      const { start, end } = rangeForObjectif(
        o.periode as Periode,
        o.date_debut
      );

      const { data: ventes, error: ventesError } = await supabase
        .from("ventes_quotidiennes")
        .select("chiffre_affaires")
        .eq("boutique_id", profile.boutique_id)
        .gte("date", start)
        .lte("date", end);

      if (ventesError) {
        setError(ventesError.message);
        setLoading(false);
        return;
      }

      const realise = (ventes ?? []).reduce(
        (s, v) => s + Number(v.chiffre_affaires),
        0
      );
      results.push({
        periode: o.periode as Periode,
        ca_cible: o.ca_cible,
        ca_realise: realise,
      });
    }

    results.sort((a, b) => PERIODE_ORDER[a.periode] - PERIODE_ORDER[b.periode]);

    setProgressList(results);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  if (!profile) return null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-medium text-foreground">Indicateurs</h1>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : progressList.length === 0 ? (
        <p className="text-sm text-faint-foreground">
          Aucun objectif défini pour le moment.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {progressList.map((p) => {
            const percent =
              p.ca_cible > 0
                ? Math.min(100, Math.round((p.ca_realise / p.ca_cible) * 100))
                : 0;
            return (
              <div key={p.periode} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium text-foreground">
                    Objectif {PERIODE_LABEL[p.periode]}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round(p.ca_realise).toLocaleString("fr-FR")} € /{" "}
                    {Math.round(p.ca_cible).toLocaleString("fr-FR")} €
                  </p>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-border/30">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="text-xs text-faint-foreground">
                  {percent}% de l&apos;objectif atteint
                </p>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
