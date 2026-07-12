"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";
import {
  type Periode,
  PERIODES,
  getRange,
  getPrevAnchor,
  getLastYearAnchor,
  navigateAnchor,
  formatRangeLabel,
  formatEuros,
  pct,
  formatPct,
  classify,
  toISODate,
} from "@/lib/indicateurs";

type ComparisonMode = "precedente" | "annee_precedente" | "objectif";

const COMPARISON_OPTIONS: { value: ComparisonMode; label: string }[] = [
  { value: "precedente", label: "Période précédente" },
  { value: "annee_precedente", label: "Même période l'an dernier" },
  { value: "objectif", label: "Objectif personnalisé" },
];

// Règles simples de comparaison de signes/pourcentages : pas d'appel IA.
// L'idée est d'expliquer la cause de la variation du CA (fréquentation vs
// panier moyen) plutôt que d'afficher un chiffre isolé. referenceLabel
// précise systématiquement à quoi la comparaison se rapporte.
function buildDiagnostic(
  caPct: number | null,
  freqPct: number | null,
  panierPct: number | null,
  referenceLabel: string
): string {
  const caDir = classify(caPct);
  const freqDir = classify(freqPct);
  const panierDir = classify(panierPct);

  if (caDir === null) {
    return `Pas assez de données sur ${referenceLabel} pour établir une comparaison.`;
  }

  const caStr = formatPct(caPct);
  const freqStr = formatPct(freqPct);
  const panierStr = formatPct(panierPct);

  let body: string;

  if (caDir === "up") {
    if (freqDir === "up" && panierDir === "down") {
      body = `CA en hausse (${caStr}) mais porté uniquement par la fréquentation (${freqStr}) : le panier moyen recule (${panierStr}).`;
    } else if (freqDir === "down" && panierDir === "up") {
      body = `CA en hausse (${caStr}) malgré une fréquentation en baisse (${freqStr}), porté par un panier moyen plus élevé (${panierStr}).`;
    } else if (freqDir === "up" && panierDir === "up") {
      body = `CA en hausse (${caStr}), porté à la fois par la fréquentation (${freqStr}) et par le panier moyen (${panierStr}).`;
    } else if (freqDir === "up" && panierDir === "stable") {
      body = `CA en hausse (${caStr}), porté par la fréquentation (${freqStr}) ; le panier moyen reste stable.`;
    } else if (freqDir === "stable" && panierDir === "up") {
      body = `CA en hausse (${caStr}), porté par le panier moyen (${panierStr}) ; la fréquentation reste stable.`;
    } else {
      body = `CA en hausse (${caStr}).`;
    }
  } else if (caDir === "down") {
    if (freqDir === "down" && panierDir === "up") {
      body = `CA en baisse (${caStr}) à cause d'un recul de la fréquentation (${freqStr}), partiellement compensé par un panier moyen plus élevé (${panierStr}).`;
    } else if (freqDir === "up" && panierDir === "down") {
      body = `CA en baisse (${caStr}) malgré une fréquentation en hausse (${freqStr}) : le panier moyen recule fortement (${panierStr}).`;
    } else if (freqDir === "down" && panierDir === "down") {
      body = `CA en baisse (${caStr}) : la fréquentation (${freqStr}) et le panier moyen (${panierStr}) reculent tous les deux.`;
    } else if (freqDir === "down" && panierDir === "stable") {
      body = `CA en baisse (${caStr}), porté par le recul de la fréquentation (${freqStr}) ; le panier moyen reste stable.`;
    } else if (freqDir === "stable" && panierDir === "down") {
      body = `CA en baisse (${caStr}), porté par le recul du panier moyen (${panierStr}) ; la fréquentation reste stable.`;
    } else {
      body = `CA en baisse (${caStr}).`;
    }
  } else if (freqDir === "up" && panierDir === "down") {
    body = `CA stable (${caStr}) : la hausse de fréquentation (${freqStr}) compense un panier moyen en recul (${panierStr}).`;
  } else if (freqDir === "down" && panierDir === "up") {
    body = `CA stable (${caStr}) : la baisse de fréquentation (${freqStr}) est compensée par un panier moyen plus élevé (${panierStr}).`;
  } else {
    body = `CA stable (${caStr}), fréquentation et panier moyen également stables.`;
  }

  return `Par rapport à ${referenceLabel} : ${body}`;
}

// Diagnostic dédié au mode "Objectif personnalisé" : pas de période de
// référence à comparer, mais un taux d'atteinte du CA cible et du panier
// moyen cible définis par le manager.
function buildDiagnosticObjectif(
  caCurrent: number,
  panierCurrent: number | null,
  objectif: Objectif | null
): string {
  if (!objectif) {
    return "Aucun objectif personnalisé défini pour cette période.";
  }

  const caPctAtteint =
    objectif.ca_cible > 0 ? (caCurrent / objectif.ca_cible) * 100 : null;
  const panierPctAtteint =
    panierCurrent !== null && objectif.panier_moyen_cible > 0
      ? (panierCurrent / objectif.panier_moyen_cible) * 100
      : null;

  const caPart = `CA à ${
    caPctAtteint !== null ? `${Math.round(caPctAtteint)}%` : "n/a"
  } de l'objectif (${formatEuros(caCurrent)} sur ${formatEuros(objectif.ca_cible)})`;

  const panierPart =
    panierCurrent !== null
      ? `panier moyen à ${
          panierPctAtteint !== null ? `${Math.round(panierPctAtteint)}%` : "n/a"
        } de l'objectif (${formatEuros(panierCurrent)} sur ${formatEuros(
          objectif.panier_moyen_cible
        )})`
      : "panier moyen non calculable (aucune fréquentation enregistrée)";

  return `Par rapport à l'objectif personnalisé : ${caPart} ; ${panierPart}.`;
}

interface Objectif {
  id: string;
  ca_cible: number;
  panier_moyen_cible: number;
}

export function ManagerIndicateurs({ boutiqueId }: { boutiqueId?: string }) {
  const profile = useUserProfile();
  const effectiveBoutiqueId = boutiqueId ?? profile?.boutique_id ?? null;
  const [periode, setPeriode] = useState<Periode>("semaine");
  const [anchor, setAnchor] = useState(() => new Date());
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("precedente");
  const [caCurrent, setCaCurrent] = useState(0);
  const [freqCurrent, setFreqCurrent] = useState(0);
  const [caReference, setCaReference] = useState(0);
  const [freqReference, setFreqReference] = useState(0);
  const [objectif, setObjectif] = useState<Objectif | null>(null);
  const [caCible, setCaCible] = useState("");
  const [panierCible, setPanierCible] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile || !effectiveBoutiqueId) return;
    setLoading(true);
    setError(null);

    const { start, end } = getRange(periode, anchor);
    const referenceAnchor =
      comparisonMode === "annee_precedente"
        ? getLastYearAnchor(periode, anchor)
        : getPrevAnchor(periode, anchor);
    const { start: refStart, end: refEnd } = getRange(periode, referenceAnchor);

    const [currentRes, referenceRes, objectifRes] = await Promise.all([
      supabase
        .from("ventes_quotidiennes")
        .select("chiffre_affaires, frequentation")
        .eq("boutique_id", effectiveBoutiqueId)
        .gte("date", toISODate(start))
        .lte("date", toISODate(end)),
      comparisonMode === "objectif"
        ? Promise.resolve({ data: null, error: null })
        : supabase
            .from("ventes_quotidiennes")
            .select("chiffre_affaires, frequentation")
            .eq("boutique_id", effectiveBoutiqueId)
            .gte("date", toISODate(refStart))
            .lte("date", toISODate(refEnd)),
      periode === "jour"
        ? Promise.resolve({ data: null, error: null })
        : supabase
            .from("objectifs")
            .select("id, ca_cible, panier_moyen_cible")
            .eq("boutique_id", effectiveBoutiqueId)
            .eq("periode", periode)
            .eq("date_debut", toISODate(start))
            .maybeSingle(),
    ]);

    if (currentRes.error) {
      setError(currentRes.error.message);
      setLoading(false);
      return;
    }
    if (referenceRes.error) {
      setError(referenceRes.error.message);
      setLoading(false);
      return;
    }
    if (objectifRes.error) {
      setError(objectifRes.error.message);
      setLoading(false);
      return;
    }

    const current = currentRes.data ?? [];
    const reference = referenceRes.data ?? [];

    setCaCurrent(current.reduce((s, v) => s + Number(v.chiffre_affaires), 0));
    setFreqCurrent(current.reduce((s, v) => s + v.frequentation, 0));
    setCaReference(reference.reduce((s, v) => s + Number(v.chiffre_affaires), 0));
    setFreqReference(reference.reduce((s, v) => s + v.frequentation, 0));

    const obj = objectifRes.data as Objectif | null;
    setObjectif(obj);
    setCaCible(obj ? String(obj.ca_cible) : "");
    setPanierCible(obj ? String(obj.panier_moyen_cible) : "");

    setLoading(false);
  }, [profile, effectiveBoutiqueId, periode, anchor, comparisonMode]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (periode === "jour" && comparisonMode === "objectif") {
      setComparisonMode("precedente");
    }
  }, [periode, comparisonMode]);

  async function handleSaveObjectif(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !effectiveBoutiqueId || periode === "jour") return;
    setSaving(true);
    setError(null);

    const { start } = getRange(periode, anchor);

    const { error: upsertError } = await supabase.from("objectifs").upsert(
      {
        boutique_id: effectiveBoutiqueId,
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
  const panierReference = freqReference > 0 ? caReference / freqReference : null;

  const isObjectifMode = comparisonMode === "objectif";
  const referenceShortLabel =
    comparisonMode === "annee_precedente" ? "même période l'an dernier" : "période précédente";
  const referenceLabel =
    comparisonMode === "annee_precedente" ? "la même période l'an dernier" : "la période précédente";

  const caPct = isObjectifMode ? null : pct(caCurrent, caReference);
  const freqPct = isObjectifMode ? null : pct(freqCurrent, freqReference);
  const panierPct =
    !isObjectifMode && panierCurrent !== null && panierReference !== null
      ? pct(panierCurrent, panierReference)
      : null;

  const caPctAtteint =
    isObjectifMode && objectif && objectif.ca_cible > 0
      ? Math.round((caCurrent / objectif.ca_cible) * 100)
      : null;
  const panierPctAtteint =
    isObjectifMode && objectif && panierCurrent !== null && objectif.panier_moyen_cible > 0
      ? Math.round((panierCurrent / objectif.panier_moyen_cible) * 100)
      : null;

  const diagnostic = isObjectifMode
    ? buildDiagnosticObjectif(caCurrent, panierCurrent, objectif)
    : buildDiagnostic(caPct, freqPct, panierPct, referenceLabel);

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

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Comparer à</p>
        <div className="flex flex-wrap gap-1">
          {COMPARISON_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setComparisonMode(opt.value)}
              disabled={opt.value === "objectif" && periode === "jour"}
              className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-30 ${
                comparisonMode === opt.value
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-border/40"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-faint-foreground">
          Comparaison active :{" "}
          {COMPARISON_OPTIONS.find((o) => o.value === comparisonMode)?.label}
        </p>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md border border-border p-4">
              <p className="text-xs text-muted-foreground">Chiffre d&apos;affaires</p>
              <p className="text-2xl font-medium text-foreground">
                {formatEuros(caCurrent)}
              </p>
              <p className="text-xs text-faint-foreground">
                {isObjectifMode
                  ? objectif
                    ? `Objectif : ${formatEuros(objectif.ca_cible)} (${caPctAtteint}% atteint)`
                    : "Aucun objectif défini pour cette période."
                  : `vs ${referenceShortLabel} : ${formatPct(caPct)}`}
              </p>
              {!isObjectifMode && objectif && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Objectif : {formatEuros(objectif.ca_cible)} (
                  {objectif.ca_cible > 0
                    ? Math.round((caCurrent / objectif.ca_cible) * 100)
                    : 0}
                  %)
                </p>
              )}
            </div>
            <div className="rounded-md border border-border p-4">
              <p className="text-xs text-muted-foreground">Panier moyen</p>
              <p className="text-2xl font-medium text-foreground">
                {panierCurrent !== null
                  ? formatEuros(panierCurrent)
                  : "n/a"}
              </p>
              <p className="text-xs text-faint-foreground">
                {isObjectifMode
                  ? objectif
                    ? `Objectif : ${formatEuros(objectif.panier_moyen_cible)}${
                        panierPctAtteint !== null ? ` (${panierPctAtteint}% atteint)` : ""
                      }`
                    : "Aucun objectif défini pour cette période."
                  : `vs ${referenceShortLabel} : ${formatPct(panierPct)}`}
              </p>
              {!isObjectifMode && objectif && (
                <p className="mt-1 text-xs text-muted-foreground">
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

          <p className="text-xs text-muted-foreground">
            Fréquentation : {freqCurrent} client
            {freqCurrent > 1 ? "s" : ""}
            {!isObjectifMode && ` (${formatPct(freqPct)} vs ${referenceShortLabel})`}
          </p>

          <div className="rounded-md bg-card p-4">
            <p className="text-sm text-foreground">{diagnostic}</p>
          </div>

          {periode !== "jour" && (
            <form
              onSubmit={handleSaveObjectif}
              className="flex flex-col gap-3 rounded-md border border-border p-4"
            >
              <p className="text-sm font-medium text-foreground">
                Objectif pour cette période
              </p>
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <label htmlFor="ca_cible" className="text-sm text-muted-foreground">
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
                    className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <label
                    htmlFor="panier_cible"
                    className="text-sm text-muted-foreground"
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
                    className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
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
