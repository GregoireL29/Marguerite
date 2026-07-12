"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

interface OnboardingScreenProps {
  authId: string;
  email: string;
  onComplete: () => Promise<void> | void;
}

export function OnboardingScreen({
  authId,
  email,
  onComplete,
}: OnboardingScreenProps) {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [nomStructure, setNomStructure] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // UUID généré côté client, sans .select() chaîné après l'insert : à la
    // création, aucune ligne utilisateurs ne référence encore cette
    // structure, donc la policy RLS de lecture (qui exige une appartenance)
    // bloquerait le RETURNING d'un insert().select().
    const structureId = crypto.randomUUID();
    const { error: structureError } = await supabase
      .from("structures")
      .insert({ id: structureId, nom: nomStructure });

    if (structureError) {
      setError(structureError.message);
      setSaving(false);
      return;
    }

    const { data: existing } = await supabase
      .from("utilisateurs")
      .select("id")
      .eq("auth_id", authId)
      .maybeSingle();

    // La personne qui crée une toute nouvelle structure en est la gérante
    // (vue transversale multi-boutiques), pas la manager d'une seule
    // boutique : elle crée sa première boutique juste après, via "Mes
    // boutiques".
    const payload = {
      structure_id: structureId,
      boutique_id: null,
      role: "gerant",
    };

    const { error: userError } = existing
      ? await supabase
          .from("utilisateurs")
          .update(payload)
          .eq("id", existing.id)
      : await supabase.from("utilisateurs").insert({
          auth_id: authId,
          nom,
          email,
          ...payload,
        });

    if (userError) {
      setError(userError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    await onComplete();
    router.push("/boutique");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <div>
          <h1 className="text-xl font-medium text-foreground">
            Bienvenue sur Marguerite
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configurons votre structure. Vous pourrez ensuite créer votre
            première boutique.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="nom" className="text-sm text-muted-foreground">
            Votre nom
          </label>
          <input
            id="nom"
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="nom_structure" className="text-sm text-muted-foreground">
            Nom de la structure
          </label>
          <input
            id="nom_structure"
            required
            value={nomStructure}
            onChange={(e) => setNomStructure(e.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {saving ? "Configuration..." : "Configurer mon espace"}
        </button>
      </form>
    </main>
  );
}
