"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";
import { ManagerIndicateurs } from "@/components/ManagerIndicateurs";
import { BoutiqueSelector } from "@/components/BoutiqueSelector";
import {
  type Periode,
  PERIODES,
  getRange,
  navigateAnchor,
  formatRangeLabel,
  formatEuros,
  formatPct,
  pct,
  toISODate,
} from "@/lib/indicateurs";

interface BoutiqueStats {
  id: string;
  nom: string;
  ca: number;
  frequentation: number;
  panierMoyen: number | null;
  ecartVsMoyenne: number | null;
}

export function GerantIndicateurs() {
  const profile = useUserProfile();
  const [mode, setMode] = useState<"comparatif" | "detail">("comparatif");
  const [selectedBoutiqueId, setSelectedBoutiqueId] = useState<string | null>(null);
  const [periode, setPeriode] = useState<Periode>("mois");
  const [anchor, setAnchor] = useState(() => new Date());
  const [stats, setStats] = useState<BoutiqueStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    const { data: boutiques, error: boutiquesError } = await supabase
      .from("boutiques")
      .select("id, nom")
      .eq("structure_id", profile.structure_id)
      .order("nom");

    if (boutiquesError) {
      setError(boutiquesError.message);
      setLoading(false);
      return;
    }

    if (!boutiques || boutiques.length === 0) {
      setStats([]);
      setLoading(false);
      return;
    }

    const { start, end } = getRange(periode, anchor);
    const { data: ventes, error: ventesError } = await supabase
      .from("ventes_quotidiennes")
      .select("boutique_id, chiffre_affaires, frequentation")
      .in(
        "boutique_id",
        boutiques.map((b) => b.id)
      )
      .gte("date", toISODate(start))
      .lte("date", toISODate(end));

    if (ventesError) {
      setError(ventesError.message);
      setLoading(false);
      return;
    }

    const parBoutique = new Map<string, { ca: number; frequentation: number }>();
    for (const b of boutiques) parBoutique.set(b.id, { ca: 0, frequentation: 0 });
    for (const v of ventes ?? []) {
      const entry = parBoutique.get(v.boutique_id);
      if (!entry) continue;
      entry.ca += Number(v.chiffre_affaires);
      entry.frequentation += v.frequentation;
    }

    const caMoyen =
      boutiques.length > 0
        ? [...parBoutique.values()].reduce((s, e) => s + e.ca, 0) / boutiques.length
        : 0;

    const computed: BoutiqueStats[] = boutiques
      .map((b) => {
        const entry = parBoutique.get(b.id)!;
        const panierMoyen = entry.frequentation > 0 ? entry.ca / entry.frequentation : null;
        return {
          id: b.id,
          nom: b.nom,
          ca: entry.ca,
          frequentation: entry.frequentation,
          panierMoyen,
          ecartVsMoyenne: caMoyen > 0 ? pct(entry.ca, caMoyen) : null,
        };
      })
      .sort((a, b) => b.ca - a.ca);

    setStats(computed);
    setLoading(false);
  }, [profile, periode, anchor]);

  useEffect(() => {
    load();
  }, [load]);

  if (!profile) return null;

  const { start, end } = getRange(periode, anchor);

  if (mode === "detail") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-8">
        <button
          onClick={() => setMode("comparatif")}
          className="self-start text-sm text-muted-foreground hover:underline"
        >
          &larr; Comparatif boutiques
        </button>
        <BoutiqueSelector value={selectedBoutiqueId} onChange={setSelectedBoutiqueId} />
        {selectedBoutiqueId && (
          <div className="-mx-4">
            <ManagerIndicateurs boutiqueId={selectedBoutiqueId} />
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-medium text-foreground">Indicateurs</h1>
        <Link
          href="/indicateurs/saisie"
          className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-border/40"
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
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-border/40"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setAnchor((a) => navigateAnchor(periode, a, -1))}
          className="rounded-md border border-border px-2 py-1 text-sm text-muted-foreground hover:bg-border/40"
          aria-label="Période précédente"
        >
          &lsaquo;
        </button>
        <span className="text-sm font-medium capitalize text-foreground">
          {formatRangeLabel(periode, start, end)}
        </span>
        <button
          onClick={() => setAnchor((a) => navigateAnchor(periode, a, 1))}
          className="rounded-md border border-border px-2 py-1 text-sm text-muted-foreground hover:bg-border/40"
          aria-label="Période suivante"
        >
          &rsaquo;
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : stats.length === 0 ? (
        <p className="text-sm text-faint-foreground">
          Aucune boutique. Créez-en une depuis &laquo; Mes boutiques &raquo;.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {stats.map((s, i) => (
            <li key={s.id} className="flex flex-col gap-1 py-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setSelectedBoutiqueId(s.id);
                    setMode("detail");
                  }}
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  {i + 1}. {s.nom}
                </button>
                <p className="text-sm font-medium text-foreground">{formatEuros(s.ca)}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <p>
                  {s.frequentation} ticket{s.frequentation > 1 ? "s" : ""}
                  {s.panierMoyen !== null && ` · panier moyen ${formatEuros(s.panierMoyen)}`}
                </p>
                <p>{s.ecartVsMoyenne !== null ? `${formatPct(s.ecartVsMoyenne)} vs moyenne` : ""}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
