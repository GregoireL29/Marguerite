"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";
import { WidgetCard, WidgetEmpty, WidgetLoading } from "@/components/widgets/WidgetCard";

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

// --- Mon planning du jour -------------------------------------------

interface CreneauRow {
  id: string;
  heure_debut: string;
  heure_fin: string;
}

export function WidgetMonPlanningJour() {
  const profile = useUserProfile();
  const [creneaux, setCreneaux] = useState<CreneauRow[] | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      const monday = getMonday(new Date());
      const { data: planning } = await supabase
        .from("plannings")
        .select("id")
        .eq("boutique_id", profile.boutique_id)
        .eq("semaine_debut", toISODate(monday))
        .maybeSingle();

      if (!planning) {
        if (!cancelled) setCreneaux([]);
        return;
      }

      const { data: rows } = await supabase
        .from("creneaux")
        .select("id, heure_debut, heure_fin")
        .eq("planning_id", planning.id)
        .eq("utilisateur_id", profile.id)
        .eq("jour", toISODate(new Date()))
        .order("heure_debut");

      if (!cancelled) setCreneaux(rows ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  return (
    <WidgetCard title="Mon planning du jour" href="/planning">
      {creneaux === null ? (
        <WidgetLoading />
      ) : creneaux.length === 0 ? (
        <WidgetEmpty text="Repos aujourd'hui." />
      ) : (
        <div className="flex flex-col gap-1">
          {creneaux.map((c) => (
            <span
              key={c.id}
              className="self-start rounded-md px-2 py-1 text-xs font-medium text-white"
              style={{ backgroundColor: profile?.couleur }}
            >
              {c.heure_debut.slice(0, 5)}–{c.heure_fin.slice(0, 5)}
            </span>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

// --- Mes tâches --------------------------------------------------------

interface TacheRow {
  id: string;
  titre: string;
  statut: "a_faire" | "faite" | "reportee";
}

export function WidgetMesTaches() {
  const profile = useUserProfile();
  const [taches, setTaches] = useState<TacheRow[] | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      const { data: rows } = await supabase
        .from("taches")
        .select("id, titre, statut")
        .eq("assigne_a", profile.id)
        .eq("date", toISODate(new Date()));

      if (!cancelled) setTaches(rows ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  async function toggle(t: TacheRow) {
    setUpdatingId(t.id);
    const nextStatut = t.statut === "faite" ? "a_faire" : "faite";
    const { error } = await supabase.from("taches").update({ statut: nextStatut }).eq("id", t.id);
    setUpdatingId(null);
    if (!error) {
      setTaches((prev) => prev?.map((x) => (x.id === t.id ? { ...x, statut: nextStatut } : x)) ?? null);
    }
  }

  return (
    <WidgetCard title="Mes tâches" href="/taches">
      {taches === null ? (
        <WidgetLoading />
      ) : taches.length === 0 ? (
        <WidgetEmpty text="Aucune tâche aujourd'hui." />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {taches.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={t.statut === "faite"}
                disabled={updatingId === t.id}
                onChange={() => toggle(t)}
              />
              <span
                className={t.statut === "faite" ? "text-zinc-400 line-through" : "text-zinc-900"}
              >
                {t.titre}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

// --- Ma progression vers l'objectif d'équipe -----------------------------

type Periode = "semaine" | "mois" | "annee";

const PERIODE_LABEL: Record<Periode, string> = {
  semaine: "Semaine",
  mois: "Mois",
  annee: "Année",
};

const PERIODE_ORDER: Record<Periode, number> = { semaine: 0, mois: 1, annee: 2 };

function rangeForObjectif(periode: Periode, dateDebut: string): { start: string; end: string } {
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

export function WidgetMaProgressionObjectif() {
  const profile = useUserProfile();
  const [progress, setProgress] = useState<{ periode: Periode; cible: number; realise: number } | null>(
    null
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      const todayISO = toISODate(new Date());
      const { data: objectifs } = await supabase
        .from("objectifs")
        .select("periode, date_debut, ca_cible")
        .eq("boutique_id", profile.boutique_id);

      const actifs = (objectifs ?? [])
        .filter((o) => {
          const { start, end } = rangeForObjectif(o.periode as Periode, o.date_debut);
          return todayISO >= start && todayISO <= end;
        })
        .sort((a, b) => PERIODE_ORDER[a.periode as Periode] - PERIODE_ORDER[b.periode as Periode]);

      if (actifs.length === 0) {
        if (!cancelled) {
          setProgress(null);
          setLoaded(true);
        }
        return;
      }

      const first = actifs[0];
      const { start, end } = rangeForObjectif(first.periode as Periode, first.date_debut);

      const { data: ventes } = await supabase
        .from("ventes_quotidiennes")
        .select("chiffre_affaires")
        .eq("boutique_id", profile.boutique_id)
        .gte("date", start)
        .lte("date", end);

      const realise = (ventes ?? []).reduce((s, v) => s + Number(v.chiffre_affaires), 0);

      if (!cancelled) {
        setProgress({ periode: first.periode as Periode, cible: first.ca_cible, realise });
        setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const percent =
    progress && progress.cible > 0 ? Math.min(100, Math.round((progress.realise / progress.cible) * 100)) : 0;

  return (
    <WidgetCard title="Objectif d'équipe" href="/indicateurs">
      {!loaded ? (
        <WidgetLoading />
      ) : !progress ? (
        <WidgetEmpty text="Aucun objectif défini pour le moment." />
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-zinc-500">
            {PERIODE_LABEL[progress.periode]} — {Math.round(progress.realise).toLocaleString("fr-FR")} € /{" "}
            {Math.round(progress.cible).toLocaleString("fr-FR")} €
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-zinc-900" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-xs text-zinc-400">{percent}% de l&apos;objectif atteint</p>
        </div>
      )}
    </WidgetCard>
  );
}

// --- Mon parcours de formation -----------------------------------------

interface ModuleRow {
  id: string;
  titre: string;
  ordre: number;
}

interface ProgressionRow {
  module_id: string;
  statut: "verrouille" | "en_cours" | "complete";
}

export function WidgetMonParcoursFormation() {
  const profile = useUserProfile();
  const [state, setState] = useState<{ activeTitre: string | null; complete: number; total: number } | null>(
    null
  );

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      const { data: modulesData } = await supabase
        .from("modules_formation")
        .select("id, titre, ordre")
        .eq("boutique_id", profile.boutique_id)
        .order("ordre");

      const modules = (modulesData ?? []) as ModuleRow[];
      if (modules.length === 0) {
        if (!cancelled) setState({ activeTitre: null, complete: 0, total: 0 });
        return;
      }

      const { data: progressionData } = await supabase
        .from("progression_formation")
        .select("module_id, statut")
        .eq("utilisateur_id", profile.id)
        .in(
          "module_id",
          modules.map((m) => m.id)
        );

      const progression = (progressionData ?? []) as ProgressionRow[];
      const completeCount = progression.filter((p) => p.statut === "complete").length;

      let activeTitre: string | null = null;
      for (const m of modules) {
        const row = progression.find((p) => p.module_id === m.id);
        if (!row || row.statut !== "complete") {
          activeTitre = m.titre;
          break;
        }
      }

      if (!cancelled) {
        setState({ activeTitre, complete: completeCount, total: modules.length });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  return (
    <WidgetCard title="Mon parcours de formation" href="/onboarding">
      {state === null ? (
        <WidgetLoading />
      ) : state.total === 0 ? (
        <WidgetEmpty text="Aucun module de formation pour l'instant." />
      ) : state.activeTitre === null ? (
        <p className="text-xs text-green-700">Formation terminée 🎉</p>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-zinc-500">Module en cours</p>
          <p className="text-sm text-zinc-900">{state.activeTitre}</p>
          <p className="text-xs text-zinc-400">
            {state.complete}/{state.total} modules complétés
          </p>
        </div>
      )}
    </WidgetCard>
  );
}
