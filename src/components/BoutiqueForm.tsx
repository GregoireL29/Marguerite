"use client";

import { useCallback, useEffect, useState } from "react";
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

interface BoutiqueFormProps {
  boutiqueId: string;
  onSaved?: () => void;
}

export function BoutiqueForm({ boutiqueId, onSaved }: BoutiqueFormProps) {
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

    const { data: boutique, error: boutiqueError } = await supabase
      .from("boutiques")
      .select(
        "id, nom, horaires, effectif_min_ouverture, effectif_min_fermeture, effectif_min_journee"
      )
      .eq("id", boutiqueId)
      .single();

    if (boutiqueError || !boutique) {
      setError(boutiqueError?.message ?? "Boutique introuvable.");
      setLoading(false);
      return;
    }

    setNomBoutique(boutique.nom);
    setHoraires({ ...EMPTY_HORAIRES, ...(boutique.horaires ?? {}) });
    setEffectifOuverture(String(boutique.effectif_min_ouverture));
    setEffectifFermeture(String(boutique.effectif_min_fermeture));
    setEffectifJournee(String(boutique.effectif_min_journee));
    setLoading(false);
  }, [boutiqueId]);

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
    onSaved?.();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Chargement...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {nomBoutique && (
        <h2 className="text-lg font-medium text-foreground">{nomBoutique}</h2>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {saved && <p className="text-sm text-green-600 dark:text-green-400">Enregistré.</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col divide-y divide-border">
          {JOURS.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-2 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  {label}
                </span>
                <button
                  type="button"
                  onClick={() => addCreneau(key)}
                  className="-m-2 shrink-0 p-2 text-xs text-muted-foreground hover:underline"
                >
                  + Ajouter un créneau
                </button>
              </div>

              {horaires[key].length === 0 && (
                <p className="text-xs text-faint-foreground">Fermé</p>
              )}

              {horaires[key].map((c, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    type="time"
                    value={c.debut}
                    onChange={(e) =>
                      updateCreneau(key, i, "debut", e.target.value)
                    }
                    className="min-w-0 rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-accent"
                  />
                  <span className="text-sm text-faint-foreground">&ndash;</span>
                  <input
                    type="time"
                    value={c.fin}
                    onChange={(e) =>
                      updateCreneau(key, i, "fin", e.target.value)
                    }
                    className="min-w-0 rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => removeCreneau(key, i)}
                    className="-m-2 shrink-0 p-2 text-sm text-faint-foreground hover:text-red-600 dark:text-red-400 dark:hover:text-red-400"
                    aria-label="Supprimer ce créneau"
                  >
                    &#10005;
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex flex-1 flex-col gap-1">
            <label
              htmlFor={`effectif_ouverture_${boutiqueId}`}
              className="text-sm text-muted-foreground"
            >
              Effectif minimum à l&apos;ouverture
            </label>
            <input
              id={`effectif_ouverture_${boutiqueId}`}
              type="number"
              min="0"
              required
              value={effectifOuverture}
              onChange={(e) => setEffectifOuverture(e.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label
              htmlFor={`effectif_fermeture_${boutiqueId}`}
              className="text-sm text-muted-foreground"
            >
              Effectif minimum à la fermeture
            </label>
            <input
              id={`effectif_fermeture_${boutiqueId}`}
              type="number"
              min="0"
              required
              value={effectifFermeture}
              onChange={(e) => setEffectifFermeture(e.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label
              htmlFor={`effectif_journee_${boutiqueId}`}
              className="text-sm text-muted-foreground"
            >
              Effectif minimum en journée
            </label>
            <input
              id={`effectif_journee_${boutiqueId}`}
              type="number"
              min="0"
              required
              value={effectifJournee}
              onChange={(e) => setEffectifJournee(e.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
