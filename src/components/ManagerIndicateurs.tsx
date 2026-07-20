"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";
import { VariationPct } from "@/components/VariationPct";
import { IconChevronDown } from "@/components/icons/MenuIcons";
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
  addDays,
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
      body = `CA en hausse (${caStr}) mais porté uniquement par le nombre de tickets (${freqStr}) : le panier moyen recule (${panierStr}).`;
    } else if (freqDir === "down" && panierDir === "up") {
      body = `CA en hausse (${caStr}) malgré un nombre de tickets en baisse (${freqStr}), porté par un panier moyen plus élevé (${panierStr}).`;
    } else if (freqDir === "up" && panierDir === "up") {
      body = `CA en hausse (${caStr}), porté à la fois par le nombre de tickets (${freqStr}) et par le panier moyen (${panierStr}).`;
    } else if (freqDir === "up" && panierDir === "stable") {
      body = `CA en hausse (${caStr}), porté par le nombre de tickets (${freqStr}) ; le panier moyen reste stable.`;
    } else if (freqDir === "stable" && panierDir === "up") {
      body = `CA en hausse (${caStr}), porté par le panier moyen (${panierStr}) ; le nombre de tickets reste stable.`;
    } else {
      body = `CA en hausse (${caStr}).`;
    }
  } else if (caDir === "down") {
    if (freqDir === "down" && panierDir === "up") {
      body = `CA en baisse (${caStr}) à cause d'un recul du nombre de tickets (${freqStr}), partiellement compensé par un panier moyen plus élevé (${panierStr}).`;
    } else if (freqDir === "up" && panierDir === "down") {
      body = `CA en baisse (${caStr}) malgré un nombre de tickets en hausse (${freqStr}) : le panier moyen recule fortement (${panierStr}).`;
    } else if (freqDir === "down" && panierDir === "down") {
      body = `CA en baisse (${caStr}) : le nombre de tickets (${freqStr}) et le panier moyen (${panierStr}) reculent tous les deux.`;
    } else if (freqDir === "down" && panierDir === "stable") {
      body = `CA en baisse (${caStr}), porté par le recul du nombre de tickets (${freqStr}) ; le panier moyen reste stable.`;
    } else if (freqDir === "stable" && panierDir === "down") {
      body = `CA en baisse (${caStr}), porté par le recul du panier moyen (${panierStr}) ; le nombre de tickets reste stable.`;
    } else {
      body = `CA en baisse (${caStr}).`;
    }
  } else if (freqDir === "up" && panierDir === "down") {
    body = `CA stable (${caStr}) : la hausse du nombre de tickets (${freqStr}) compense un panier moyen en recul (${panierStr}).`;
  } else if (freqDir === "down" && panierDir === "up") {
    body = `CA stable (${caStr}) : la baisse du nombre de tickets (${freqStr}) est compensée par un panier moyen plus élevé (${panierStr}).`;
  } else {
    body = `CA stable (${caStr}), nombre de tickets et panier moyen également stables.`;
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
      : "panier moyen non calculable (aucun ticket enregistré)";

  return `Par rapport à l'objectif personnalisé : ${caPart} ; ${panierPart}.`;
}

interface Objectif {
  id: string;
  ca_cible: number;
  panier_moyen_cible: number;
}

interface VenteJournaliere {
  date: string;
  chiffre_affaires: number;
  frequentation: number;
  nombre_articles: number | null;
  nombre_visiteurs: number | null;
  nombre_cartes_fidelite: number | null;
}

// Met en couleur les pourcentages signés du bilan (générés par formatPct)
// pour que hausses et baisses ressortent au même code visuel que les cartes
// chiffrées, sans toucher à la construction du texte lui-même.
function renderDiagnostic(text: string): React.ReactNode[] {
  return text.split(/([+-]\d+(?:\.\d+)?%)/g).map((part, i) => {
    const match = /^([+-]\d+(?:\.\d+)?)%$/.exec(part);
    if (!match) return part;
    const value = Number(match[1]);
    const cls =
      value > 0
        ? "font-medium text-green-600 dark:text-green-400"
        : value < 0
          ? "font-medium text-red-600 dark:text-red-400"
          : "text-muted-foreground";
    return (
      <span key={i} className={cls}>
        {part}
      </span>
    );
  });
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
  const [articlesCurrent, setArticlesCurrent] = useState(0);
  const [visiteursCurrent, setVisiteursCurrent] = useState(0);
  const [cartesCurrent, setCartesCurrent] = useState(0);
  const [articlesReference, setArticlesReference] = useState(0);
  const [visiteursReference, setVisiteursReference] = useState(0);
  const [cartesReference, setCartesReference] = useState(0);
  const [panierArticleActif, setPanierArticleActif] = useState(false);
  const [tauxTransformationActif, setTauxTransformationActif] = useState(false);
  const [tauxEncartementActif, setTauxEncartementActif] = useState(false);
  const [ventesJournalieres, setVentesJournalieres] = useState<VenteJournaliere[]>([]);
  const [objectif, setObjectif] = useState<Objectif | null>(null);
  const [caCible, setCaCible] = useState("");
  const [panierCible, setPanierCible] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingReglages, setSavingReglages] = useState(false);
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

    const [currentRes, referenceRes, objectifRes, boutiqueRes] = await Promise.all([
      supabase
        .from("ventes_quotidiennes")
        .select(
          "date, chiffre_affaires, frequentation, nombre_articles, nombre_visiteurs, nombre_cartes_fidelite"
        )
        .eq("boutique_id", effectiveBoutiqueId)
        .gte("date", toISODate(start))
        .lte("date", toISODate(end)),
      comparisonMode === "objectif"
        ? Promise.resolve({ data: null, error: null })
        : supabase
            .from("ventes_quotidiennes")
            .select(
              "chiffre_affaires, frequentation, nombre_articles, nombre_visiteurs, nombre_cartes_fidelite"
            )
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
      supabase
        .from("boutiques")
        .select(
          "indicateur_panier_article_actif, indicateur_taux_transformation_actif, indicateur_taux_encartement_actif"
        )
        .eq("id", effectiveBoutiqueId)
        .single(),
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
    if (boutiqueRes.error) {
      setError(boutiqueRes.error.message);
      setLoading(false);
      return;
    }

    const current = currentRes.data ?? [];
    setVentesJournalieres(current as VenteJournaliere[]);
    const reference = referenceRes.data ?? [];

    setCaCurrent(current.reduce((s, v) => s + Number(v.chiffre_affaires), 0));
    setFreqCurrent(current.reduce((s, v) => s + v.frequentation, 0));
    setCaReference(reference.reduce((s, v) => s + Number(v.chiffre_affaires), 0));
    setFreqReference(reference.reduce((s, v) => s + v.frequentation, 0));
    setArticlesCurrent(current.reduce((s, v) => s + (v.nombre_articles ?? 0), 0));
    setVisiteursCurrent(current.reduce((s, v) => s + (v.nombre_visiteurs ?? 0), 0));
    setCartesCurrent(current.reduce((s, v) => s + (v.nombre_cartes_fidelite ?? 0), 0));
    setArticlesReference(reference.reduce((s, v) => s + (v.nombre_articles ?? 0), 0));
    setVisiteursReference(reference.reduce((s, v) => s + (v.nombre_visiteurs ?? 0), 0));
    setCartesReference(
      reference.reduce((s, v) => s + (v.nombre_cartes_fidelite ?? 0), 0)
    );

    setPanierArticleActif(boutiqueRes.data.indicateur_panier_article_actif);
    setTauxTransformationActif(boutiqueRes.data.indicateur_taux_transformation_actif);
    setTauxEncartementActif(boutiqueRes.data.indicateur_taux_encartement_actif);

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

  async function handleToggleIndicateurOptionnel(
    champ:
      | "indicateur_panier_article_actif"
      | "indicateur_taux_transformation_actif"
      | "indicateur_taux_encartement_actif",
    checked: boolean
  ) {
    if (!effectiveBoutiqueId) return;
    setSavingReglages(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("boutiques")
      .update({ [champ]: checked })
      .eq("id", effectiveBoutiqueId);

    setSavingReglages(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (champ === "indicateur_panier_article_actif") setPanierArticleActif(checked);
    if (champ === "indicateur_taux_transformation_actif") setTauxTransformationActif(checked);
    if (champ === "indicateur_taux_encartement_actif") setTauxEncartementActif(checked);
  }

  // Une ligne par jour de la période affichée, quelle que soit la vente
  // du jour saisie ou non (0 si absente) — même logique/format que
  // l'export CSV déjà construit sur Factures fournisseurs.
  function exporterExcel() {
    const { start, end } = getRange(periode, anchor);
    const parJour = new Map(ventesJournalieres.map((v) => [v.date, v]));

    const header = ["Date", "Chiffre d'affaires (€)", "Nombre de tickets", "Panier moyen (€)"];
    if (panierArticleActif) header.push("Panier article");
    if (tauxTransformationActif) header.push("Taux de transformation (%)");
    if (tauxEncartementActif) header.push("Taux d'encartement (%)");

    const rows: string[][] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const iso = toISODate(d);
      const v = parJour.get(iso);
      const ca = v ? Number(v.chiffre_affaires) : 0;
      const tickets = v?.frequentation ?? 0;
      const panierMoyen = tickets > 0 ? ca / tickets : 0;

      const row = [iso, ca.toFixed(2), String(tickets), panierMoyen.toFixed(2)];
      if (panierArticleActif) {
        const articles = v?.nombre_articles ?? null;
        row.push(articles != null && tickets > 0 ? (articles / tickets).toFixed(1) : "");
      }
      if (tauxTransformationActif) {
        const visiteurs = v?.nombre_visiteurs ?? null;
        row.push(visiteurs != null && visiteurs > 0 ? ((tickets / visiteurs) * 100).toFixed(1) : "");
      }
      if (tauxEncartementActif) {
        const cartes = v?.nombre_cartes_fidelite ?? null;
        row.push(cartes != null && tickets > 0 ? ((cartes / tickets) * 100).toFixed(1) : "");
      }
      rows.push(row);
    }

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `indicateurs_${toISODate(start)}_${toISODate(end)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!profile) return null;

  const { start, end } = getRange(periode, anchor);
  const panierCurrent = freqCurrent > 0 ? caCurrent / freqCurrent : null;
  const panierReference = freqReference > 0 ? caReference / freqReference : null;
  const panierArticle = freqCurrent > 0 ? articlesCurrent / freqCurrent : null;
  const tauxTransformation =
    visiteursCurrent > 0 ? (freqCurrent / visiteursCurrent) * 100 : null;
  const tauxEncartement = freqCurrent > 0 ? (cartesCurrent / freqCurrent) * 100 : null;
  const panierArticleReference =
    freqReference > 0 ? articlesReference / freqReference : null;
  const tauxTransformationReference =
    visiteursReference > 0 ? (freqReference / visiteursReference) * 100 : null;
  const tauxEncartementReference =
    freqReference > 0 ? (cartesReference / freqReference) * 100 : null;

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
  const panierArticlePct =
    !isObjectifMode && panierArticle !== null && panierArticleReference !== null
      ? pct(panierArticle, panierArticleReference)
      : null;
  const tauxTransformationPct =
    !isObjectifMode &&
    tauxTransformation !== null &&
    tauxTransformationReference !== null
      ? pct(tauxTransformation, tauxTransformationReference)
      : null;
  const tauxEncartementPct =
    !isObjectifMode && tauxEncartement !== null && tauxEncartementReference !== null
      ? pct(tauxEncartement, tauxEncartementReference)
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

  // Tendance du CA pour teinter le bilan : en mode objectif, seul un
  // objectif atteint est signalé (pas de rouge en cours de période, le
  // retard n'est pas une baisse).
  const caTendance = isObjectifMode
    ? caPctAtteint !== null && caPctAtteint >= 100
      ? "up"
      : null
    : classify(caPct);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-medium text-foreground">Indicateurs</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={exporterExcel}
            disabled={loading}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-border/40 disabled:opacity-50"
          >
            Exporter en Excel
          </button>
          <Link
            href="/indicateurs/saisie"
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-border/40"
          >
            Saisir les ventes du jour
          </Link>
        </div>
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
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Chiffre d&apos;affaires</p>
              <p className="text-3xl font-semibold text-foreground">
                {formatEuros(caCurrent)}
              </p>
              {isObjectifMode ? (
                <p className="text-xs text-faint-foreground">
                  {objectif ? (
                    <>
                      Objectif : {formatEuros(objectif.ca_cible)}{" "}
                      <span
                        className={
                          caPctAtteint !== null && caPctAtteint >= 100
                            ? "font-medium text-green-600 dark:text-green-400"
                            : ""
                        }
                      >
                        ({caPctAtteint}% atteint)
                      </span>
                    </>
                  ) : (
                    "Aucun objectif défini pour cette période."
                  )}
                </p>
              ) : (
                <p className="text-xs">
                  <VariationPct value={caPct} suffix={`vs ${referenceShortLabel}`} />
                </p>
              )}
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
            <div>
              <p className="text-xs text-muted-foreground">Panier moyen</p>
              <p className="text-3xl font-semibold text-foreground">
                {panierCurrent !== null
                  ? formatEuros(panierCurrent)
                  : "n/a"}
              </p>
              {isObjectifMode ? (
                <p className="text-xs text-faint-foreground">
                  {objectif ? (
                    <>
                      Objectif : {formatEuros(objectif.panier_moyen_cible)}
                      {panierPctAtteint !== null && (
                        <span
                          className={
                            panierPctAtteint >= 100
                              ? "font-medium text-green-600 dark:text-green-400"
                              : ""
                          }
                        >
                          {" "}
                          ({panierPctAtteint}% atteint)
                        </span>
                      )}
                    </>
                  ) : (
                    "Aucun objectif défini pour cette période."
                  )}
                </p>
              ) : (
                <p className="text-xs">
                  <VariationPct
                    value={panierPct}
                    suffix={`vs ${referenceShortLabel}`}
                  />
                </p>
              )}
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
            <div>
              <p className="text-xs text-muted-foreground">Nombre de tickets</p>
              <p className="text-3xl font-semibold text-foreground">{freqCurrent}</p>
              {!isObjectifMode && (
                <p className="text-xs">
                  <VariationPct
                    value={freqPct}
                    suffix={`vs ${referenceShortLabel}`}
                  />
                </p>
              )}
            </div>
          </div>

          {(panierArticleActif || tauxTransformationActif || tauxEncartementActif) && (
            <div className="flex flex-col gap-3 border-t border-border pt-6">
              <p className="text-xs font-medium uppercase tracking-wide text-faint-foreground">
                Indicateurs optionnels
              </p>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
                {panierArticleActif && (
                  <div>
                    <p className="text-xs text-muted-foreground">Panier article</p>
                    <p className="text-xl font-medium text-foreground">
                      {panierArticle !== null ? panierArticle.toFixed(1) : "n/a"}
                    </p>
                    {!isObjectifMode && (
                      <p className="text-xs">
                        <VariationPct
                          value={panierArticlePct}
                          suffix={`vs ${referenceShortLabel}`}
                        />
                      </p>
                    )}
                    <p className="text-xs text-faint-foreground">articles / ticket</p>
                  </div>
                )}
                {tauxTransformationActif && (
                  <div>
                    <p className="text-xs text-muted-foreground">Taux de transformation</p>
                    <p className="text-xl font-medium text-foreground">
                      {tauxTransformation !== null
                        ? `${tauxTransformation.toFixed(1)}%`
                        : "n/a"}
                    </p>
                    {!isObjectifMode && (
                      <p className="text-xs">
                        <VariationPct
                          value={tauxTransformationPct}
                          suffix={`vs ${referenceShortLabel}`}
                        />
                      </p>
                    )}
                    <p className="text-xs text-faint-foreground">tickets / visiteurs</p>
                  </div>
                )}
                {tauxEncartementActif && (
                  <div>
                    <p className="text-xs text-muted-foreground">Taux d&apos;encartement</p>
                    <p className="text-xl font-medium text-foreground">
                      {tauxEncartement !== null ? `${tauxEncartement.toFixed(1)}%` : "n/a"}
                    </p>
                    {!isObjectifMode && (
                      <p className="text-xs">
                        <VariationPct
                          value={tauxEncartementPct}
                          suffix={`vs ${referenceShortLabel}`}
                        />
                      </p>
                    )}
                    <p className="text-xs text-faint-foreground">cartes créées / ticket</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div
            className={`rounded-md border-l-4 bg-card p-5 ${
              caTendance === "up"
                ? "border-green-600 dark:border-green-400"
                : caTendance === "down"
                  ? "border-red-600 dark:border-red-400"
                  : "border-border"
            }`}
          >
            <p className="text-xs font-medium text-muted-foreground">Bilan</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">
              {renderDiagnostic(diagnostic)}
            </p>
          </div>

          <details className="group border-t border-border pt-4">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
              Réglages
              <IconChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>

            <div className="mt-4 flex flex-col gap-6">
              {periode !== "jour" && (
                <form onSubmit={handleSaveObjectif} className="flex flex-col gap-3">
                  <p className="text-sm font-medium text-foreground">
                    Objectif pour cette période
                  </p>
                  <div className="flex gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
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
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
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

              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-foreground">
                  Indicateurs optionnels
                </p>
                <label className="flex items-start gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={panierArticleActif}
                    disabled={savingReglages}
                    onChange={(e) =>
                      handleToggleIndicateurOptionnel(
                        "indicateur_panier_article_actif",
                        e.target.checked
                      )
                    }
                    className="mt-0.5"
                  />
                  <span>
                    Panier article
                    <span className="block text-xs text-muted-foreground">
                      Nombre moyen d&apos;articles par ticket.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={tauxTransformationActif}
                    disabled={savingReglages}
                    onChange={(e) =>
                      handleToggleIndicateurOptionnel(
                        "indicateur_taux_transformation_actif",
                        e.target.checked
                      )
                    }
                    className="mt-0.5"
                  />
                  <span>
                    Taux de transformation
                    <span className="block text-xs text-muted-foreground">
                      Part des visiteurs qui achètent (tickets / visiteurs).
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={tauxEncartementActif}
                    disabled={savingReglages}
                    onChange={(e) =>
                      handleToggleIndicateurOptionnel(
                        "indicateur_taux_encartement_actif",
                        e.target.checked
                      )
                    }
                    className="mt-0.5"
                  />
                  <span>
                    Taux d&apos;encartement
                    <span className="block text-xs text-muted-foreground">
                      Part des tickets avec création d&apos;une carte de fidélité.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </details>
        </>
      )}
    </main>
  );
}
