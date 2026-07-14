"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";
import { BoutiqueSelector } from "@/components/BoutiqueSelector";
import { toISODate } from "@/lib/indicateurs";

function SaisieVentes({ boutiqueId }: { boutiqueId?: string }) {
  const profile = useUserProfile();
  const effectiveBoutiqueId = boutiqueId ?? profile?.boutique_id ?? null;
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [chiffreAffaires, setChiffreAffaires] = useState("");
  const [frequentation, setFrequentation] = useState("");
  const [nombreArticles, setNombreArticles] = useState("");
  const [nombreVisiteurs, setNombreVisiteurs] = useState("");
  const [nombreCartesFidelite, setNombreCartesFidelite] = useState("");
  const [panierArticleActif, setPanierArticleActif] = useState(false);
  const [tauxTransformationActif, setTauxTransformationActif] = useState(false);
  const [tauxEncartementActif, setTauxEncartementActif] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExisting = useCallback(
    async (d: string) => {
      if (!profile || !effectiveBoutiqueId) return;
      setLoading(true);
      setError(null);
      setSaved(false);

      const [boutiqueRes, venteRes] = await Promise.all([
        supabase
          .from("boutiques")
          .select(
            "indicateur_panier_article_actif, indicateur_taux_transformation_actif, indicateur_taux_encartement_actif"
          )
          .eq("id", effectiveBoutiqueId)
          .single(),
        supabase
          .from("ventes_quotidiennes")
          .select(
            "chiffre_affaires, frequentation, nombre_articles, nombre_visiteurs, nombre_cartes_fidelite"
          )
          .eq("boutique_id", effectiveBoutiqueId)
          .eq("date", d)
          .maybeSingle(),
      ]);

      if (boutiqueRes.error) {
        setError(boutiqueRes.error.message);
        setLoading(false);
        return;
      }
      if (venteRes.error) {
        setError(venteRes.error.message);
        setLoading(false);
        return;
      }

      setPanierArticleActif(boutiqueRes.data.indicateur_panier_article_actif);
      setTauxTransformationActif(
        boutiqueRes.data.indicateur_taux_transformation_actif
      );
      setTauxEncartementActif(boutiqueRes.data.indicateur_taux_encartement_actif);

      const data = venteRes.data;
      setChiffreAffaires(data ? String(data.chiffre_affaires) : "");
      setFrequentation(data ? String(data.frequentation) : "");
      setNombreArticles(data?.nombre_articles != null ? String(data.nombre_articles) : "");
      setNombreVisiteurs(
        data?.nombre_visiteurs != null ? String(data.nombre_visiteurs) : ""
      );
      setNombreCartesFidelite(
        data?.nombre_cartes_fidelite != null ? String(data.nombre_cartes_fidelite) : ""
      );
      setLoading(false);
    },
    [profile, effectiveBoutiqueId]
  );

  useEffect(() => {
    loadExisting(date);
  }, [date, loadExisting]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !effectiveBoutiqueId) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const { error: upsertError } = await supabase
      .from("ventes_quotidiennes")
      .upsert(
        {
          boutique_id: effectiveBoutiqueId,
          date,
          chiffre_affaires: Number(chiffreAffaires),
          frequentation: Number(frequentation),
          nombre_articles: panierArticleActif ? Number(nombreArticles) : null,
          nombre_visiteurs: tauxTransformationActif ? Number(nombreVisiteurs) : null,
          nombre_cartes_fidelite: tauxEncartementActif
            ? Number(nombreCartesFidelite)
            : null,
        },
        { onConflict: "boutique_id,date" }
      );

    setSaving(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    setSaved(true);
  }

  if (!profile) return null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link
          href="/indicateurs"
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Indicateurs
        </Link>
        <h1 className="mt-1 text-xl font-medium text-foreground">
          Saisie des ventes du jour
        </h1>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {saved && <p className="text-sm text-green-600 dark:text-green-400">Enregistré.</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="date" className="text-sm text-muted-foreground">
            Date
          </label>
          <input
            id="date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="chiffre_affaires"
            className="text-sm text-muted-foreground"
          >
            Chiffre d&apos;affaires (€)
          </label>
          <input
            id="chiffre_affaires"
            type="number"
            step="0.01"
            min="0"
            required
            disabled={loading}
            value={chiffreAffaires}
            onChange={(e) => setChiffreAffaires(e.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="frequentation" className="text-sm text-muted-foreground">
            Nombre de tickets
          </label>
          <input
            id="frequentation"
            type="number"
            step="1"
            min="0"
            required
            disabled={loading}
            value={frequentation}
            onChange={(e) => setFrequentation(e.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
          />
        </div>

        {panierArticleActif && (
          <div className="flex flex-col gap-1">
            <label
              htmlFor="nombre_articles"
              className="text-sm text-muted-foreground"
            >
              Nombre d&apos;articles vendus
            </label>
            <input
              id="nombre_articles"
              type="number"
              step="1"
              min="0"
              required
              disabled={loading}
              value={nombreArticles}
              onChange={(e) => setNombreArticles(e.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
            />
          </div>
        )}

        {tauxTransformationActif && (
          <div className="flex flex-col gap-1">
            <label
              htmlFor="nombre_visiteurs"
              className="text-sm text-muted-foreground"
            >
              Nombre de visiteurs
            </label>
            <input
              id="nombre_visiteurs"
              type="number"
              step="1"
              min="0"
              required
              disabled={loading}
              value={nombreVisiteurs}
              onChange={(e) => setNombreVisiteurs(e.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
            />
          </div>
        )}

        {tauxEncartementActif && (
          <div className="flex flex-col gap-1">
            <label
              htmlFor="nombre_cartes_fidelite"
              className="text-sm text-muted-foreground"
            >
              Nombre de cartes de fidélité créées
            </label>
            <input
              id="nombre_cartes_fidelite"
              type="number"
              step="1"
              min="0"
              required
              disabled={loading}
              value={nombreCartesFidelite}
              onChange={(e) => setNombreCartesFidelite(e.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={saving || loading}
          className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>
    </main>
  );
}

export default function SaisieVentesPage() {
  const profile = useUserProfile();
  const [selectedBoutiqueId, setSelectedBoutiqueId] = useState<string | null>(null);

  if (!profile) return null;

  if (profile.role === "gerant") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-8">
        <BoutiqueSelector value={selectedBoutiqueId} onChange={setSelectedBoutiqueId} />
        {selectedBoutiqueId && <SaisieVentes boutiqueId={selectedBoutiqueId} />}
      </div>
    );
  }

  return <SaisieVentes />;
}
