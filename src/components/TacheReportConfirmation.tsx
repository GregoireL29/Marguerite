"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export interface TacheStale {
  id: string;
  titre: string;
  categorie: string;
  boutique_id: string;
  assigne_a: string | null;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Une tâche non cochée à la date prévue n'est jamais reportée
// automatiquement : on demande confirmation tâche par tâche pour éviter
// qu'un oubli de case à cocher ne déclenche un report à tort.
export function TacheReportConfirmation({
  taches,
  onDone,
}: {
  taches: TacheStale[];
  onDone: () => void;
}) {
  const [remaining, setRemaining] = useState(taches);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(t: TacheStale, faite: boolean) {
    setProcessingId(t.id);
    setError(null);

    if (faite) {
      const { error: updateError } = await supabase
        .from("taches")
        .update({ statut: "faite" })
        .eq("id", t.id);

      if (updateError) {
        setError(updateError.message);
        setProcessingId(null);
        return;
      }
    } else {
      const { error: updateError } = await supabase
        .from("taches")
        .update({ statut: "reportee" })
        .eq("id", t.id);

      if (updateError) {
        setError(updateError.message);
        setProcessingId(null);
        return;
      }

      const { error: insertError } = await supabase.from("taches").insert({
        boutique_id: t.boutique_id,
        titre: t.titre,
        categorie: t.categorie,
        assigne_a: t.assigne_a,
        date: toISODate(new Date()),
      });

      if (insertError) {
        setError(insertError.message);
        setProcessingId(null);
        return;
      }
    }

    const next = remaining.filter((r) => r.id !== t.id);
    setRemaining(next);
    setProcessingId(null);
    if (next.length === 0) onDone();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-medium text-zinc-900">
          Tâches non cochées
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Ces tâches n&apos;ont pas été cochées comme faites. Ont-elles
          vraiment été réalisées ?
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="flex flex-col divide-y divide-zinc-200">
        {remaining.map((t) => (
          <li key={t.id} className="flex items-center justify-between py-3">
            <span className="text-sm text-zinc-900">{t.titre}</span>
            <div className="flex gap-2">
              <button
                onClick={() => resolve(t, true)}
                disabled={processingId === t.id}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Faite
              </button>
              <button
                onClick={() => resolve(t, false)}
                disabled={processingId === t.id}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 disabled:opacity-50"
              >
                Pas faite
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
