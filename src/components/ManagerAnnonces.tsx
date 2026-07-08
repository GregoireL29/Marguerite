"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

type CibleRole = "tous" | "managers_uniquement";
type Onglet = "creer" | "recues" | "suivi";

const CIBLE_LABEL: Record<CibleRole, string> = {
  tous: "Toute l'équipe",
  managers_uniquement: "Managers uniquement",
};

interface AnnonceRecue {
  id: string;
  titre: string;
  message: string;
  created_at: string;
  auteur_nom: string;
  lu: boolean;
}

interface Recipient {
  id: string;
  nom: string;
  lu: boolean;
  luAt: string | null;
}

interface AnnonceSuivi {
  id: string;
  titre: string;
  created_at: string;
  cible_role: CibleRole;
  recipients: Recipient[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ManagerAnnonces() {
  const profile = useUserProfile();
  const [onglet, setOnglet] = useState<Onglet>("creer");
  const [error, setError] = useState<string | null>(null);

  // Création
  const [titre, setTitre] = useState("");
  const [message, setMessage] = useState("");
  const [cibleRole, setCibleRole] = useState<CibleRole>("tous");
  const [saving, setSaving] = useState(false);

  // Reçues
  const [recues, setRecues] = useState<AnnonceRecue[]>([]);
  const [loadingRecues, setLoadingRecues] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  // Suivi
  const [suivi, setSuivi] = useState<AnnonceSuivi[]>([]);
  const [loadingSuivi, setLoadingSuivi] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadRecues = useCallback(async () => {
    if (!profile) return;
    setLoadingRecues(true);

    const { data: annoncesData, error: annoncesError } = await supabase
      .from("annonces")
      .select("id, titre, message, created_at, utilisateurs(nom)")
      .eq("boutique_id", profile.boutique_id)
      .order("created_at", { ascending: false });

    if (annoncesError) {
      setError(annoncesError.message);
      setLoadingRecues(false);
      return;
    }

    const rows = (annoncesData ?? []) as unknown as {
      id: string;
      titre: string;
      message: string;
      created_at: string;
      utilisateurs: { nom: string } | { nom: string }[] | null;
    }[];

    const ids = rows.map((r) => r.id);
    const { data: lecturesData, error: lecturesError } = await supabase
      .from("annonces_lectures")
      .select("annonce_id")
      .eq("utilisateur_id", profile.id)
      .in("annonce_id", ids.length > 0 ? ids : [""]);

    if (lecturesError) {
      setError(lecturesError.message);
      setLoadingRecues(false);
      return;
    }

    const luIds = new Set((lecturesData ?? []).map((l) => l.annonce_id));

    setRecues(
      rows.map((r) => ({
        id: r.id,
        titre: r.titre,
        message: r.message,
        created_at: r.created_at,
        auteur_nom: Array.isArray(r.utilisateurs)
          ? (r.utilisateurs[0]?.nom ?? "?")
          : (r.utilisateurs?.nom ?? "?"),
        lu: luIds.has(r.id),
      }))
    );

    setLoadingRecues(false);
  }, [profile]);

  const loadSuivi = useCallback(async () => {
    if (!profile) return;
    setLoadingSuivi(true);

    const [
      { data: annoncesData, error: annoncesError },
      { data: utilisateursData, error: utilisateursError },
    ] = await Promise.all([
      supabase
        .from("annonces")
        .select("id, titre, created_at, cible_role")
        .eq("boutique_id", profile.boutique_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("utilisateurs")
        .select("id, nom, role")
        .eq("boutique_id", profile.boutique_id),
    ]);

    if (annoncesError) {
      setError(annoncesError.message);
      setLoadingSuivi(false);
      return;
    }
    if (utilisateursError) {
      setError(utilisateursError.message);
      setLoadingSuivi(false);
      return;
    }

    const annonceIds = (annoncesData ?? []).map((a) => a.id);
    const { data: lecturesData, error: lecturesError } = await supabase
      .from("annonces_lectures")
      .select("annonce_id, utilisateur_id, lu_at")
      .in("annonce_id", annonceIds.length > 0 ? annonceIds : [""]);

    if (lecturesError) {
      setError(lecturesError.message);
      setLoadingSuivi(false);
      return;
    }

    const utilisateurs = utilisateursData ?? [];

    setSuivi(
      (annoncesData ?? []).map((a) => {
        const cible = a.cible_role as CibleRole;
        const eligibles =
          cible === "tous"
            ? utilisateurs
            : utilisateurs.filter((u) => u.role === "manager" || u.role === "gerant");

        const lecturesAnnonce = (lecturesData ?? []).filter(
          (l) => l.annonce_id === a.id
        );

        return {
          id: a.id,
          titre: a.titre,
          created_at: a.created_at,
          cible_role: cible,
          recipients: eligibles.map((u) => {
            const lecture = lecturesAnnonce.find((l) => l.utilisateur_id === u.id);
            return {
              id: u.id,
              nom: u.nom,
              lu: !!lecture,
              luAt: lecture?.lu_at ?? null,
            };
          }),
        };
      })
    );

    setLoadingSuivi(false);
  }, [profile]);

  useEffect(() => {
    if (onglet === "recues") loadRecues();
    if (onglet === "suivi") loadSuivi();
  }, [onglet, loadRecues, loadSuivi]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from("annonces").insert({
      boutique_id: profile.boutique_id,
      auteur_id: profile.id,
      titre,
      message,
      cible_role: cibleRole,
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setTitre("");
    setMessage("");
    setCibleRole("tous");
    setOnglet("suivi");
  }

  async function marquerLu(annonceId: string) {
    if (!profile) return;
    setMarkingId(annonceId);
    setError(null);

    const { error: upsertError } = await supabase
      .from("annonces_lectures")
      .upsert(
        { annonce_id: annonceId, utilisateur_id: profile.id },
        { onConflict: "annonce_id,utilisateur_id" }
      );

    setMarkingId(null);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    setRecues((prev) =>
      prev.map((a) => (a.id === annonceId ? { ...a, lu: true } : a))
    );
  }

  if (!profile) return null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-medium text-zinc-900">Annonces</h1>

      <div className="flex gap-1">
        <button
          onClick={() => setOnglet("creer")}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            onglet === "creer" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          Créer
        </button>
        <button
          onClick={() => setOnglet("recues")}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            onglet === "recues" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          Reçues
        </button>
        <button
          onClick={() => setOnglet("suivi")}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            onglet === "suivi" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          Suivi
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {onglet === "creer" && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4"
        >
          <p className="text-sm font-medium text-zinc-900">Nouvelle annonce</p>

          <div className="flex flex-col gap-1">
            <label htmlFor="titre" className="text-sm text-zinc-600">
              Titre
            </label>
            <input
              id="titre"
              required
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="message" className="text-sm text-zinc-600">
              Message
            </label>
            <textarea
              id="message"
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="cible" className="text-sm text-zinc-600">
              Destinataires
            </label>
            <select
              id="cible"
              value={cibleRole}
              onChange={(e) => setCibleRole(e.target.value as CibleRole)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            >
              <option value="tous">Toute l&apos;équipe</option>
              <option value="managers_uniquement">Managers uniquement</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="self-start rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Publication..." : "Publier l'annonce"}
          </button>
        </form>
      )}

      {onglet === "recues" &&
        (loadingRecues ? (
          <p className="text-sm text-zinc-500">Chargement...</p>
        ) : recues.length === 0 ? (
          <p className="text-sm text-zinc-400">Aucune annonce pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-200">
            {recues.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-900">{a.titre}</p>
                  <p className="text-xs text-zinc-400">{formatDate(a.created_at)}</p>
                </div>
                <p className="text-xs text-zinc-500">Par {a.auteur_nom}</p>
                <p className="text-sm text-zinc-600 whitespace-pre-wrap">{a.message}</p>
                {a.lu ? (
                  <span className="self-start rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Lu
                  </span>
                ) : (
                  <button
                    onClick={() => marquerLu(a.id)}
                    disabled={markingId === a.id}
                    className="self-start rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    J&apos;ai pris connaissance
                  </button>
                )}
              </li>
            ))}
          </ul>
        ))}

      {onglet === "suivi" &&
        (loadingSuivi ? (
          <p className="text-sm text-zinc-500">Chargement...</p>
        ) : suivi.length === 0 ? (
          <p className="text-sm text-zinc-400">Aucune annonce envoyée pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {suivi.map((a) => {
              const total = a.recipients.length;
              const luCount = a.recipients.filter((r) => r.lu).length;
              const percent = total > 0 ? Math.round((luCount / total) * 100) : 0;
              const expanded = expandedId === a.id;

              return (
                <li key={a.id} className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-900">{a.titre}</p>
                    <p className="text-xs text-zinc-400">{formatDate(a.created_at)}</p>
                  </div>
                  <p className="text-xs text-zinc-500">{CIBLE_LABEL[a.cible_role]}</p>

                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-zinc-900 transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="shrink-0 text-xs text-zinc-500">
                      {luCount}/{total} lu ({percent}%)
                    </p>
                  </div>

                  <button
                    onClick={() => setExpandedId(expanded ? null : a.id)}
                    className="self-start text-xs text-zinc-500 hover:underline"
                  >
                    {expanded ? "Masquer le détail" : "Voir le détail"}
                  </button>

                  {expanded && (
                    <ul className="mt-1 flex flex-col divide-y divide-zinc-100">
                      {a.recipients.map((r) => (
                        <li key={r.id} className="flex items-center justify-between py-1.5">
                          <span className="text-sm text-zinc-700">{r.nom}</span>
                          {r.lu ? (
                            <span className="text-xs text-green-700">Lu</span>
                          ) : (
                            <span className="text-xs text-zinc-400">Non lu</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
    </main>
  );
}
