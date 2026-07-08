"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

type JourKey = "lun" | "mar" | "mer" | "jeu" | "ven" | "sam" | "dim";

const JOURS: { key: JourKey; label: string; offset: number }[] = [
  { key: "lun", label: "Lundi", offset: 0 },
  { key: "mar", label: "Mardi", offset: 1 },
  { key: "mer", label: "Mercredi", offset: 2 },
  { key: "jeu", label: "Jeudi", offset: 3 },
  { key: "ven", label: "Vendredi", offset: 4 },
  { key: "sam", label: "Samedi", offset: 5 },
  { key: "dim", label: "Dimanche", offset: 6 },
];

interface CreneauRow {
  id: string;
  jour: string;
  heure_debut: string;
  heure_fin: string;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

function getMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function formatDateLong(d: Date): string {
  const end = addDays(d, 6);
  return `${d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
  })} – ${end.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })}`;
}

export function SalarieWeekView() {
  const profile = useUserProfile();
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [boutiqueNom, setBoutiqueNom] = useState("");
  const [creneaux, setCreneaux] = useState<CreneauRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (week: Date) => {
      if (!profile) return;
      setLoading(true);
      setError(null);

      const { data: boutique, error: boutiqueError } = await supabase
        .from("boutiques")
        .select("nom")
        .eq("id", profile.boutique_id)
        .single();

      if (boutiqueError || !boutique) {
        setError(boutiqueError?.message ?? "Boutique introuvable.");
        setLoading(false);
        return;
      }
      setBoutiqueNom(boutique.nom);

      const semaineDebut = toISODate(week);

      const { data: planning, error: planningError } = await supabase
        .from("plannings")
        .select("id")
        .eq("boutique_id", profile.boutique_id)
        .eq("semaine_debut", semaineDebut)
        .maybeSingle();

      if (planningError) {
        setError(planningError.message);
        setLoading(false);
        return;
      }

      if (!planning) {
        setCreneaux([]);
        setLoading(false);
        return;
      }

      const { data: creneauxData, error: creneauxError } = await supabase
        .from("creneaux")
        .select("id, jour, heure_debut, heure_fin")
        .eq("planning_id", planning.id)
        .eq("utilisateur_id", profile.id)
        .order("jour")
        .order("heure_debut");

      if (creneauxError) {
        setError(creneauxError.message);
        setLoading(false);
        return;
      }

      setCreneaux(creneauxData ?? []);
      setLoading(false);
    },
    [profile]
  );

  useEffect(() => {
    load(weekStart);
  }, [weekStart, load]);

  if (!profile) return null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          className="rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
          aria-label="Semaine précédente"
        >
          &lsaquo;
        </button>
        <h1 className="text-lg font-medium text-zinc-900">
          Semaine du {formatDateLong(weekStart)}
        </h1>
        <button
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          className="rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
          aria-label="Semaine suivante"
        >
          &rsaquo;
        </button>
      </div>

      <p className="text-sm text-zinc-500">
        {profile.nom} — {boutiqueNom}
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Chargement...</p>
      ) : (
        <div className="flex flex-col divide-y divide-zinc-200">
          {JOURS.map(({ key, label, offset }) => {
            const date = addDays(weekStart, offset);
            const dateISO = toISODate(date);
            const dayCreneaux = creneaux.filter((c) => c.jour === dateISO);

            return (
              <div
                key={key}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900">{label}</p>
                  <p className="text-xs text-zinc-400">
                    {formatDateShort(date)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {dayCreneaux.length === 0 ? (
                    <span className="text-sm text-zinc-400">Repos</span>
                  ) : (
                    dayCreneaux.map((c) => (
                      <span
                        key={c.id}
                        className="rounded-md px-2 py-1 text-sm font-medium text-white"
                        style={{ backgroundColor: profile.couleur }}
                      >
                        {c.heure_debut.slice(0, 5)}–{c.heure_fin.slice(0, 5)}
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
