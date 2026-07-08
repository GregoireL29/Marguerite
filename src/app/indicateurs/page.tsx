"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

type Periode = "jour" | "semaine" | "mois" | "annee";

const PERIODES: { value: Periode; label: string }[] = [
  { value: "jour", label: "Jour" },
  { value: "semaine", label: "Semaine" },
  { value: "mois", label: "Mois" },
  { value: "annee", label: "Année" },
];

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

function getRange(periode: Periode, anchor: Date): { start: Date; end: Date } {
  if (periode === "jour") {
    return { start: anchor, end: anchor };
  }
  if (periode === "semaine") {
    const start = getMonday(anchor);
    return { start, end: addDays(start, 6) };
  }
  if (periode === "mois") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { start, end };
  }
  return {
    start: new Date(anchor.getFullYear(), 0, 1),
    end: new Date(anchor.getFullYear(), 11, 31),
  };
}

function getPrevAnchor(periode: Periode, anchor: Date): Date {
  if (periode === "jour") return addDays(anchor, -1);
  if (periode === "semaine") return addDays(anchor, -7);
  if (periode === "mois") return new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
  return new Date(anchor.getFullYear() - 1, 0, 1);
}

function navigateAnchor(periode: Periode, anchor: Date, dir: 1 | -1): Date {
  if (periode === "jour") return addDays(anchor, dir);
  if (periode === "semaine") return addDays(anchor, dir * 7);
  if (periode === "mois") return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  return new Date(anchor.getFullYear() + dir, 0, 1);
}

function formatRangeLabel(periode: Periode, start: Date, end: Date): string {
  if (periode === "jour") {
    return start.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }
  if (periode === "annee") {
    return String(start.getFullYear());
  }
  return `${start.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
  })} – ${end.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })}`;
}

function formatEuros(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
}

function pct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function formatPct(p: number | null): string {
  if (p === null) return "n/a";
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}

type Direction = "up" | "down" | "stable" | null;

function classify(p: number | null): Direction {
  if (p === null) return null;
  if (p > 2) return "up";
  if (p < -2) return "down";
  return "stable";
}

// Règles simples de comparaison de signes/pourcentages : pas d'appel IA.
// L'idée est d'expliquer la cause de la variation du CA (fréquentation vs
// panier moyen) plutôt que d'afficher un chiffre isolé.
function buildDiagnostic(
  caPct: number | null,
  freqPct: number | null,
  panierPct: number | null
): string {
  const caDir = classify(caPct);
  const freqDir = classify(freqPct);
  const panierDir = classify(panierPct);

  if (caDir === null) {
    return "Pas assez de données sur la période précédente pour établir une comparaison.";
  }

  const caStr = formatPct(caPct);
  const freqStr = formatPct(freqPct);
  const panierStr = formatPct(panierPct);

  if (caDir === "up") {
    if (freqDir === "up" && panierDir === "down") {
      return `CA en hausse (${caStr}) mais porté uniquement par la fréquentation (${freqStr}) : le panier moyen recule (${panierStr}).`;
    }
    if (freqDir === "down" && panierDir === "up") {
      return `CA en hausse (${caStr}) malgré une fréquentation en baisse (${freqStr}), porté par un panier moyen plus élevé (${panierStr}).`;
    }
    if (freqDir === "up" && panierDir === "up") {
      return `CA en hausse (${caStr}), porté à la fois par la fréquentation (${freqStr}) et par le panier moyen (${panierStr}).`;
    }
    if (freqDir === "up" && panierDir === "stable") {
      return `CA en hausse (${caStr}), porté par la fréquentation (${freqStr}) ; le panier moyen reste stable.`;
    }
    if (freqDir === "stable" && panierDir === "up") {
      return `CA en hausse (${caStr}), porté par le panier moyen (${panierStr}) ; la fréquentation reste stable.`;
    }
    return `CA en hausse (${caStr}).`;
  }

  if (caDir === "down") {
    if (freqDir === "down" && panierDir === "up") {
      return `CA en baisse (${caStr}) à cause d'un recul de la fréquentation (${freqStr}), partiellement compensé par un panier moyen plus élevé (${panierStr}).`;
    }
    if (freqDir === "up" && panierDir === "down") {
      return `CA en baisse (${caStr}) malgré une fréquentation en hausse (${freqStr}) : le panier moyen recule fortement (${panierStr}).`;
    }
    if (freqDir === "down" && panierDir === "down") {
      return `CA en baisse (${caStr}) : la fréquentation (${freqStr}) et le panier moyen (${panierStr}) reculent tous les deux.`;
    }
    if (freqDir === "down" && panierDir === "stable") {
      return `CA en baisse (${caStr}), porté par le recul de la fréquentation (${freqStr}) ; le panier moyen reste stable.`;
    }
    if (freqDir === "stable" && panierDir === "down") {
      return `CA en baisse (${caStr}), porté par le recul du panier moyen (${panierStr}) ; la fréquentation reste stable.`;
    }
    return `CA en baisse (${caStr}).`;
  }

  if (freqDir === "up" && panierDir === "down") {
    return `CA stable (${caStr}) : la hausse de fréquentation (${freqStr}) compense un panier moyen en recul (${panierStr}).`;
  }
  if (freqDir === "down" && panierDir === "up") {
    return `CA stable (${caStr}) : la baisse de fréquentation (${freqStr}) est compensée par un panier moyen plus élevé (${panierStr}).`;
  }
  return `CA stable (${caStr}), fréquentation et panier moyen également stables.`;
}

interface Objectif {
  id: string;
  ca_cible: number;
  panier_moyen_cible: number;
}

export default function IndicateursPage() {
  const profile = useUserProfile();
  const [periode, setPeriode] = useState<Periode>("semaine");
  const [anchor, setAnchor] = useState(() => new Date());
  const [caCurrent, setCaCurrent] = useState(0);
  const [freqCurrent, setFreqCurrent] = useState(0);
  const [caPrev, setCaPrev] = useState(0);
  const [freqPrev, setFreqPrev] = useState(0);
  const [objectif, setObjectif] = useState<Objectif | null>(null);
  const [caCible, setCaCible] = useState("");
  const [panierCible, setPanierCible] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    const { start, end } = getRange(periode, anchor);
    const prevAnchor = getPrevAnchor(periode, anchor);
    const { start: prevStart, end: prevEnd } = getRange(periode, prevAnchor);

    const [currentRes, prevRes, objectifRes] = await Promise.all([
      supabase
        .from("ventes_quotidiennes")
        .select("chiffre_affaires, frequentation")
        .eq("boutique_id", profile.boutique_id)
        .gte("date", toISODate(start))
        .lte("date", toISODate(end)),
      supabase
        .from("ventes_quotidiennes")
        .select("chiffre_affaires, frequentation")
        .eq("boutique_id", profile.boutique_id)
        .gte("date", toISODate(prevStart))
        .lte("date", toISODate(prevEnd)),
      periode === "jour"
        ? Promise.resolve({ data: null, error: null })
        : supabase
            .from("objectifs")
            .select("id, ca_cible, panier_moyen_cible")
            .eq("boutique_id", profile.boutique_id)
            .eq("periode", periode)
            .eq("date_debut", toISODate(start))
            .maybeSingle(),
    ]);

    if (currentRes.error) {
      setError(currentRes.error.message);
      setLoading(false);
      return;
    }
    if (prevRes.error) {
      setError(prevRes.error.message);
      setLoading(false);
      return;
    }
    if (objectifRes.error) {
      setError(objectifRes.error.message);
      setLoading(false);
      return;
    }

    const current = currentRes.data ?? [];
    const prev = prevRes.data ?? [];

    setCaCurrent(current.reduce((s, v) => s + Number(v.chiffre_affaires), 0));
    setFreqCurrent(current.reduce((s, v) => s + v.frequentation, 0));
    setCaPrev(prev.reduce((s, v) => s + Number(v.chiffre_affaires), 0));
    setFreqPrev(prev.reduce((s, v) => s + v.frequentation, 0));

    const obj = objectifRes.data as Objectif | null;
    setObjectif(obj);
    setCaCible(obj ? String(obj.ca_cible) : "");
    setPanierCible(obj ? String(obj.panier_moyen_cible) : "");

    setLoading(false);
  }, [profile, periode, anchor]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveObjectif(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || periode === "jour") return;
    setSaving(true);
    setError(null);

    const { start } = getRange(periode, anchor);

    const { error: upsertError } = await supabase.from("objectifs").upsert(
      {
        boutique_id: profile.boutique_id,
        periode,
        date_debut: toISODate(start),
        ca_cible: Number(caCible),
        panier_moyen_cible: Number(panierCible),
      },
      { onConflict: "boutique_id,periode,date_debut" }
    );

    setSaving(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    await load();
  }

  if (!profile) return null;

  const { start, end } = getRange(periode, anchor);
  const panierCurrent = freqCurrent > 0 ? caCurrent / freqCurrent : null;
  const panierPrev = freqPrev > 0 ? caPrev / freqPrev : null;

  const caPct = pct(caCurrent, caPrev);
  const freqPct = pct(freqCurrent, freqPrev);
  const panierPct =
    panierCurrent !== null && panierPrev !== null
      ? pct(panierCurrent, panierPrev)
      : null;

  const diagnostic = buildDiagnostic(caPct, freqPct, panierPct);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-medium text-zinc-900">Indicateurs</h1>
        <Link
          href="/indicateurs/saisie"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Saisir les ventes du jour
        </Link>
      </div>

      <div className="flex gap-1">
        {PERIODES.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriode(p.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              periode === p.value
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setAnchor((a) => navigateAnchor(periode, a, -1))}
          className="rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
          aria-label="Période précédente"
        >
          &lsaquo;
        </button>
        <span className="text-sm font-medium capitalize text-zinc-900">
          {formatRangeLabel(periode, start, end)}
        </span>
        <button
          onClick={() => setAnchor((a) => navigateAnchor(periode, a, 1))}
          className="rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
          aria-label="Période suivante"
        >
          &rsaquo;
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Chargement...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md border border-zinc-200 p-4">
              <p className="text-xs text-zinc-500">Chiffre d&apos;affaires</p>
              <p className="text-2xl font-medium text-zinc-900">
                {formatEuros(caCurrent)}
              </p>
              <p className="text-xs text-zinc-400">
                vs période précédente : {formatPct(caPct)}
              </p>
              {objectif && (
                <p className="mt-1 text-xs text-zinc-500">
                  Objectif : {formatEuros(objectif.ca_cible)} (
                  {objectif.ca_cible > 0
                    ? Math.round((caCurrent / objectif.ca_cible) * 100)
                    : 0}
                  %)
                </p>
              )}
            </div>
            <div className="rounded-md border border-zinc-200 p-4">
              <p className="text-xs text-zinc-500">Panier moyen</p>
              <p className="text-2xl font-medium text-zinc-900">
                {panierCurrent !== null
                  ? formatEuros(panierCurrent)
                  : "n/a"}
              </p>
              <p className="text-xs text-zinc-400">
                vs période précédente : {formatPct(panierPct)}
              </p>
              {objectif && (
                <p className="mt-1 text-xs text-zinc-500">
                  Objectif : {formatEuros(objectif.panier_moyen_cible)}
                  {panierCurrent !== null &&
                    objectif.panier_moyen_cible > 0 &&
                    ` (${Math.round(
                      (panierCurrent / objectif.panier_moyen_cible) * 100
                    )}%)`}
                </p>
              )}
            </div>
          </div>

          <p className="text-xs text-zinc-500">
            Fréquentation : {freqCurrent} client
            {freqCurrent > 1 ? "s" : ""} ({formatPct(freqPct)} vs période
            précédente)
          </p>

          <div className="rounded-md bg-zinc-50 p-4">
            <p className="text-sm text-zinc-800">{diagnostic}</p>
          </div>

          {periode !== "jour" && (
            <form
              onSubmit={handleSaveObjectif}
              className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4"
            >
              <p className="text-sm font-medium text-zinc-900">
                Objectif pour cette période
              </p>
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <label htmlFor="ca_cible" className="text-sm text-zinc-600">
                    CA cible (€)
                  </label>
                  <input
                    id="ca_cible"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={caCible}
                    onChange={(e) => setCaCible(e.target.value)}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <label
                    htmlFor="panier_cible"
                    className="text-sm text-zinc-600"
                  >
                    Panier moyen cible (€)
                  </label>
                  <input
                    id="panier_cible"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={panierCible}
                    onChange={(e) => setPanierCible(e.target.value)}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="self-start rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving
                  ? "Enregistrement..."
                  : objectif
                    ? "Mettre à jour l'objectif"
                    : "Définir l'objectif"}
              </button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
