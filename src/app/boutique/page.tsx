"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type JourKey = "lun" | "mar" | "mer" | "jeu" | "ven" | "sam" | "dim";

interface Creneau {
  debut: string;
  fin: string;
}

type Horaires = Record<JourKey, Creneau[]>;

const JOURS: { key: JourKey; label: string }[] = [
  { key: "lun", label: "Lundi" },
  { key: "mar", label: "Mardi" },
  { key: "mer", label: "Mercredi" },
  { key: "jeu", label: "Jeudi" },
  { key: "ven", label: "Vendredi" },
  { key: "sam", label: "Samedi" },
  { key: "dim", label: "Dimanche" },
];

const EMPTY_HORAIRES: Horaires = {
  lun: [],
  mar: [],
  mer: [],
  jeu: [],
  ven: [],
  sam: [],
  dim: [],
};

export default function BoutiquePage() {
  const [boutiqueId, setBoutiqueId] = useState<string | null>(null);
  const [nomBoutique, setNomBoutique] = useState("");
  const [horaires, setHoraires] = useState<Horaires>(EMPTY_HORAIRES);
  const [effectifOuverture, setEffectifOuverture] = useState("1");
  const [effectifFermeture, setEffectifFermeture] = useState("1");
  const [effectifJournee, setEffectifJournee] = useState("1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    const { data: currentUser, error: userError } = await supabase
      .from("utilisateurs")
      .select("boutique_id")
      .eq("auth_id", authUser?.id ?? "")
      .maybeSingle();

    if (userError || !currentUser?.boutique_id) {
      setError(
        userError?.message ?? "Aucune boutique associée à votre compte."
      );
      setLoading(false);
      return;
    }

    const { data: boutique, error: boutiqueError } = await supabase
      .from("boutiques")
      .select(
        "id, nom, horaires, effectif_min_ouverture, effectif_min_fermeture, effectif_min_journee"
      )
      .eq("id", currentUser.boutique_id)
      .single();

    if (boutiqueError || !boutique) {
      setError(boutiqueError?.message ?? "Boutique introuvable.");
      setLoading(false);
      return;
    }

    setBoutiqueId(boutique.id);
    setNomBoutique(boutique.nom);
    setHoraires({ ...EMPTY_HORAIRES, ...(boutique.horaires ?? {}) });
    setEffectifOuverture(String(boutique.effectif_min_ouverture));
    setEffectifFermeture(String(boutique.effectif_min_fermeture));
    setEffectifJournee(String(boutique.effectif_min_journee));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function addCreneau(jour: JourKey) {
    setHoraires((h) => ({
      ...h,
      [jour]: [...h[jour], { debut: "09:00", fin: "19:00" }],
    }));
  }

  function removeCreneau(jour: JourKey, index: number) {
    setHoraires((h) => ({
      ...h,
      [jour]: h[jour].filter((_, i) => i !== index),
    }));
  }

  function updateCreneau(
    jour: JourKey,
    index: number,
    field: "debut" | "fin",
    value: string
  ) {
    setHoraires((h) => ({
      ...h,
      [jour]: h[jour].map((c, i) =>
        i === index ? { ...c, [field]: value } : c
      ),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!boutiqueId) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const { error: updateError } = await supabase
      .from("boutiques")
      .update({
        horaires,
        effectif_min_ouverture: Number(effectifOuverture),
        effectif_min_fermeture: Number(effectifFermeture),
        effectif_min_journee: Number(effectifJournee),
      })
      .eq("id", boutiqueId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSaved(true);
  }

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <p className="text-sm text-zinc-500">Chargement...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/planning" className="text-sm text-zinc-500 hover:underline">
          &larr; Planning
        </Link>
        <h1 className="mt-1 text-xl font-medium text-zinc-900">
          Ma boutique{nomBoutique ? ` — ${nomBoutique}` : ""}
        </h1>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Enregistré.</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col divide-y divide-zinc-200">
          {JOURS.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-2 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-900">
                  {label}
                </span>
                <button
                  type="button"
                  onClick={() => addCreneau(key)}
                  className="text-xs text-zinc-600 hover:underline"
                >
                  + Ajouter un créneau
                </button>
              </div>

              {horaires[key].length === 0 && (
                <p className="text-xs text-zinc-400">Fermé</p>
              )}

              {horaires[key].map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={c.debut}
                    onChange={(e) =>
                      updateCreneau(key, i, "debut", e.target.value)
                    }
                    className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500"
                  />
                  <span className="text-sm text-zinc-400">&ndash;</span>
                  <input
                    type="time"
                    value={c.fin}
                    onChange={(e) =>
                      updateCreneau(key, i, "fin", e.target.value)
                    }
                    className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeCreneau(key, i)}
                    className="text-sm text-zinc-400 hover:text-red-600"
                    aria-label="Supprimer ce créneau"
                  >
                    &#10005;
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-1">
            <label
              htmlFor="effectif_ouverture"
              className="text-sm text-zinc-600"
            >
              Effectif minimum à l&apos;ouverture
            </label>
            <input
              id="effectif_ouverture"
              type="number"
              min="0"
              required
              value={effectifOuverture}
              onChange={(e) => setEffectifOuverture(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label
              htmlFor="effectif_fermeture"
              className="text-sm text-zinc-600"
            >
              Effectif minimum à la fermeture
            </label>
            <input
              id="effectif_fermeture"
              type="number"
              min="0"
              required
              value={effectifFermeture}
              onChange={(e) => setEffectifFermeture(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label
              htmlFor="effectif_journee"
              className="text-sm text-zinc-600"
            >
              Effectif minimum en journée
            </label>
            <input
              id="effectif_journee"
              type="number"
              min="0"
              required
              value={effectifJournee}
              onChange={(e) => setEffectifJournee(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="self-start rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>
    </main>
  );
}
