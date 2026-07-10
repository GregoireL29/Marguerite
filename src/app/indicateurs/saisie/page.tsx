"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function SaisieVentesPage() {
  const profile = useUserProfile();
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [chiffreAffaires, setChiffreAffaires] = useState("");
  const [frequentation, setFrequentation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExisting = useCallback(
    async (d: string) => {
      if (!profile) return;
      setLoading(true);
      setError(null);
      setSaved(false);

      const { data, error: fetchError } = await supabase
        .from("ventes_quotidiennes")
        .select("chiffre_affaires, frequentation")
        .eq("boutique_id", profile.boutique_id)
        .eq("date", d)
        .maybeSingle();

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      setChiffreAffaires(
        data ? String(data.chiffre_affaires) : ""
      );
      setFrequentation(data ? String(data.frequentation) : "");
      setLoading(false);
    },
    [profile]
  );

  useEffect(() => {
    loadExisting(date);
  }, [date, loadExisting]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const { error: upsertError } = await supabase
      .from("ventes_quotidiennes")
      .upsert(
        {
          boutique_id: profile.boutique_id,
          date,
          chiffre_affaires: Number(chiffreAffaires),
          frequentation: Number(frequentation),
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
            Fréquentation (nombre de clients)
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
