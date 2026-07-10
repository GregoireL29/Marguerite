"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

type DelaiRappel = "jour_meme" | "1_semaine" | "1_mois" | "personnalise";
type Statut = "a_venir" | "en_retard" | "faite";
type Responsable = "aucun" | "moi";

const DELAI_LABEL: Record<DelaiRappel, string> = {
  jour_meme: "Le jour même",
  "1_semaine": "1 semaine avant",
  "1_mois": "1 mois avant",
  personnalise: "Personnalisé",
};

const DELAI_JOURS: Record<DelaiRappel, number> = {
  jour_meme: 0,
  "1_semaine": 7,
  "1_mois": 30,
  personnalise: 0,
};

interface Echeance {
  id: string;
  titre: string;
  date_echeance: string;
  responsable_id: string | null;
  delai_rappel: DelaiRappel;
  delai_personnalise_jours: number | null;
  statut: Statut;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function joursRestants(dateEcheance: string, todayISO: string): number {
  const [y1, m1, d1] = todayISO.split("-").map(Number);
  const [y2, m2, d2] = dateEcheance.split("-").map(Number);
  const start = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function delaiEnJours(e: Pick<Echeance, "delai_rappel" | "delai_personnalise_jours">): number {
  if (e.delai_rappel === "personnalise") return e.delai_personnalise_jours ?? 0;
  return DELAI_JOURS[e.delai_rappel];
}

export function Echeances() {
  const profile = useUserProfile();
  const [echeances, setEcheances] = useState<Echeance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [titre, setTitre] = useState("");
  const [dateEcheance, setDateEcheance] = useState("");
  const [delaiRappel, setDelaiRappel] = useState<DelaiRappel>("jour_meme");
  const [delaiPersonnaliseJours, setDelaiPersonnaliseJours] = useState("7");
  const [responsable, setResponsable] = useState<Responsable>("aucun");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("echeances")
      .select(
        "id, titre, date_echeance, responsable_id, delai_rappel, delai_personnalise_jours, statut"
      )
      .eq("boutique_id", profile.boutique_id)
      .order("date_echeance", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const todayISO = toISODate(new Date());
    const rows = (data ?? []) as Echeance[];
    const aRepasser = rows.filter(
      (e) => e.statut === "a_venir" && e.date_echeance < todayISO
    );

    if (aRepasser.length > 0) {
      await Promise.all(
        aRepasser.map((e) =>
          supabase.from("echeances").update({ statut: "en_retard" }).eq("id", e.id)
        )
      );
    }

    setEcheances(
      rows.map((e) =>
        aRepasser.some((r) => r.id === e.id) ? { ...e, statut: "en_retard" as Statut } : e
      )
    );
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from("echeances").insert({
      boutique_id: profile.boutique_id,
      titre,
      date_echeance: dateEcheance,
      responsable_id: responsable === "moi" ? profile.id : null,
      delai_rappel: delaiRappel,
      delai_personnalise_jours:
        delaiRappel === "personnalise" ? Number(delaiPersonnaliseJours) : null,
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setTitre("");
    setDateEcheance("");
    setDelaiRappel("jour_meme");
    setDelaiPersonnaliseJours("7");
    setResponsable("aucun");
    await load();
  }

  async function marquerFaite(id: string) {
    setUpdatingId(id);
    setError(null);

    const { error: updateError } = await supabase
      .from("echeances")
      .update({ statut: "faite" })
      .eq("id", id);

    setUpdatingId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await load();
  }

  const todayISO = useMemo(() => toISODate(new Date()), []);

  if (!profile) return null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-medium text-zinc-900">Rappels et échéances</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4"
      >
        <p className="text-sm font-medium text-zinc-900">Nouvelle échéance</p>

        <div className="flex flex-col gap-1">
          <label htmlFor="titre" className="text-sm text-zinc-600">
            Titre
          </label>
          <input
            id="titre"
            required
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="ex. Renouvellement assurance"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="date-echeance" className="text-sm text-zinc-600">
              Date d&apos;échéance
            </label>
            <input
              id="date-echeance"
              type="date"
              required
              value={dateEcheance}
              onChange={(e) => setDateEcheance(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="responsable" className="text-sm text-zinc-600">
              Responsable
            </label>
            <select
              id="responsable"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value as Responsable)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            >
              <option value="aucun">Non assigné</option>
              <option value="moi">Moi ({profile.nom})</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="delai-rappel" className="text-sm text-zinc-600">
              Délai de rappel
            </label>
            <select
              id="delai-rappel"
              value={delaiRappel}
              onChange={(e) => setDelaiRappel(e.target.value as DelaiRappel)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            >
              {(Object.keys(DELAI_LABEL) as DelaiRappel[]).map((d) => (
                <option key={d} value={d}>
                  {DELAI_LABEL[d]}
                </option>
              ))}
            </select>
          </div>
          {delaiRappel === "personnalise" && (
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="delai-jours" className="text-sm text-zinc-600">
                Jours avant l&apos;échéance
              </label>
              <input
                id="delai-jours"
                type="number"
                min="0"
                required
                value={delaiPersonnaliseJours}
                onChange={(e) => setDelaiPersonnaliseJours(e.target.value)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="self-start rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Création..." : "Créer l'échéance"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-zinc-500">Chargement...</p>
      ) : echeances.length === 0 ? (
        <p className="text-sm text-zinc-400">Aucune échéance pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {echeances.map((e) => {
            const jours = joursRestants(e.date_echeance, todayISO);
            const imminent =
              e.statut === "a_venir" && jours >= 0 && jours <= delaiEnJours(e);
            const badgeStyle =
              e.statut === "faite"
                ? "bg-green-100 text-green-700"
                : e.statut === "en_retard"
                  ? "bg-red-100 text-red-700"
                  : imminent
                    ? "bg-amber-100 text-amber-700"
                    : "bg-zinc-100 text-zinc-600";
            const badgeLabel =
              e.statut === "faite" ? "Faite" : e.statut === "en_retard" ? "En retard" : "À venir";
            const cardStyle =
              e.statut === "en_retard"
                ? "border-red-200"
                : imminent
                  ? "border-amber-200"
                  : "border-zinc-200";

            return (
              <li
                key={e.id}
                className={`flex items-center justify-between gap-3 rounded-lg border p-4 ${cardStyle}`}
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900">{e.titre}</p>
                  <p className="text-xs text-zinc-500">
                    {formatDate(e.date_echeance)} ·{" "}
                    {e.responsable_id === profile.id
                      ? profile.nom
                      : e.responsable_id
                        ? "Assigné"
                        : "Non assigné"}{" "}
                    · Rappel {DELAI_LABEL[e.delai_rappel]}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeStyle}`}
                  >
                    {badgeLabel}
                  </span>
                  {e.statut !== "faite" && (
                    <button
                      onClick={() => marquerFaite(e.id)}
                      disabled={updatingId === e.id}
                      className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 disabled:opacity-50"
                    >
                      Marquer comme faite
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
