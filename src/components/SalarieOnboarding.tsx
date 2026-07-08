"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

type Statut = "verrouille" | "en_cours" | "complete";

interface Module {
  id: string;
  titre: string;
  ordre: number;
  support_url: string | null;
}

interface Question {
  id: string;
  module_id: string;
  question: string;
  options: string[];
  reponse_correcte: number;
  ordre: number;
}

interface ProgressionRow {
  module_id: string;
  statut: Statut;
  score: number | null;
}

export function SalarieOnboarding() {
  const profile = useUserProfile();
  const [modules, setModules] = useState<Module[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [progression, setProgression] = useState<ProgressionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [openingSupport, setOpeningSupport] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    const { data: modulesData, error: modulesError } = await supabase
      .from("modules_formation")
      .select("id, titre, ordre, support_url")
      .eq("boutique_id", profile.boutique_id)
      .order("ordre");

    if (modulesError) {
      setError(modulesError.message);
      setLoading(false);
      return;
    }

    const moduleIds = (modulesData ?? []).map((m) => m.id);

    const [
      { data: questionsData, error: questionsError },
      { data: progressionData, error: progressionError },
    ] = await Promise.all([
      supabase
        .from("questions_qcm")
        .select("id, module_id, question, options, reponse_correcte, ordre")
        .in("module_id", moduleIds.length > 0 ? moduleIds : [""])
        .order("ordre"),
      supabase
        .from("progression_formation")
        .select("module_id, statut, score")
        .eq("utilisateur_id", profile.id)
        .in("module_id", moduleIds.length > 0 ? moduleIds : [""]),
    ]);

    if (questionsError) {
      setError(questionsError.message);
      setLoading(false);
      return;
    }
    if (progressionError) {
      setError(progressionError.message);
      setLoading(false);
      return;
    }

    setModules(modulesData ?? []);
    setQuestions((questionsData ?? []) as Question[]);
    setProgression((progressionData ?? []) as ProgressionRow[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const sortedModules = useMemo(() => [...modules].sort((a, b) => a.ordre - b.ordre), [modules]);

  const activeModuleId = useMemo(() => {
    for (const m of sortedModules) {
      const row = progression.find((p) => p.module_id === m.id);
      if (!row || row.statut !== "complete") return m.id;
    }
    return null;
  }, [sortedModules, progression]);

  useEffect(() => {
    if (!profile || !activeModuleId) return;
    const hasRow = progression.some((p) => p.module_id === activeModuleId);
    if (hasRow) return;

    supabase
      .from("progression_formation")
      .insert({ utilisateur_id: profile.id, module_id: activeModuleId, statut: "en_cours" })
      .then(({ error: insertError }) => {
        if (!insertError) {
          setProgression((prev) => [
            ...prev,
            { module_id: activeModuleId, statut: "en_cours", score: null },
          ]);
        }
      });
  }, [profile, activeModuleId, progression]);

  async function handleVoirSupport(supportUrl: string) {
    setOpeningSupport(true);
    const { data, error: signedUrlError } = await supabase.storage
      .from("documents")
      .createSignedUrl(supportUrl, 300);
    setOpeningSupport(false);

    if (signedUrlError || !data) {
      setError(signedUrlError?.message ?? "Impossible d'ouvrir le support.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function handleValiderModule(moduleId: string, moduleQuestions: Question[]) {
    if (!profile) return;
    if (moduleQuestions.some((q) => answers[q.id] == null)) return;

    setSubmitting(true);
    setError(null);

    const correctCount = moduleQuestions.filter(
      (q) => answers[q.id] === q.reponse_correcte
    ).length;
    const score = Math.round((correctCount / moduleQuestions.length) * 100);

    const { error: upsertError } = await supabase.from("progression_formation").upsert(
      {
        utilisateur_id: profile.id,
        module_id: moduleId,
        statut: "complete",
        score,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "utilisateur_id,module_id" }
    );

    setSubmitting(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    setAnswers({});
    await load();
  }

  if (!profile) return null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-medium text-zinc-900">Onboarding</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Chargement...</p>
      ) : sortedModules.length === 0 ? (
        <p className="text-sm text-zinc-400">Aucun module de formation pour l&apos;instant.</p>
      ) : activeModuleId === null ? (
        <p className="text-sm text-green-700">
          Formation terminée — tous les modules ont été complétés. 🎉
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sortedModules.map((m, idx) => {
            const row = progression.find((p) => p.module_id === m.id);
            const statut: Statut = row?.statut ?? "verrouille";
            const isActive = m.id === activeModuleId;
            const isComplete = statut === "complete";
            const isLocked = !isActive && !isComplete;
            const moduleQuestions = questions
              .filter((q) => q.module_id === m.id)
              .sort((a, b) => a.ordre - b.ordre);
            const allAnswered = moduleQuestions.every((q) => answers[q.id] != null);

            return (
              <li
                key={m.id}
                className={`flex flex-col gap-2 rounded-lg border p-4 ${
                  isActive ? "border-zinc-900" : "border-zinc-200"
                } ${isLocked ? "opacity-50" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-900">
                    {idx + 1}. {m.titre}
                  </p>
                  {isComplete && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Terminé{row?.score != null ? ` · ${row.score}%` : ""}
                    </span>
                  )}
                  {isLocked && (
                    <span className="text-xs text-zinc-400">🔒 Verrouillé</span>
                  )}
                </div>

                {isActive && (
                  <div className="flex flex-col gap-4">
                    {m.support_url && (
                      <button
                        onClick={() => handleVoirSupport(m.support_url as string)}
                        disabled={openingSupport}
                        className="self-start rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 disabled:opacity-50"
                      >
                        Consulter le support
                      </button>
                    )}

                    {moduleQuestions.length > 0 && (
                      <div className="flex flex-col gap-4">
                        {moduleQuestions.map((q, qIdx) => (
                          <div key={q.id} className="flex flex-col gap-2">
                            <p className="text-sm font-medium text-zinc-900">
                              {qIdx + 1}. {q.question}
                            </p>
                            <div className="flex flex-col gap-1">
                              {q.options.map((opt, oIdx) => (
                                <label
                                  key={oIdx}
                                  className="flex items-center gap-2 text-sm text-zinc-700"
                                >
                                  <input
                                    type="radio"
                                    name={`q-${q.id}`}
                                    checked={answers[q.id] === oIdx}
                                    onChange={() =>
                                      setAnswers((prev) => ({ ...prev, [q.id]: oIdx }))
                                    }
                                  />
                                  {opt}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}

                        <button
                          onClick={() => handleValiderModule(m.id, moduleQuestions)}
                          disabled={!allAnswered || submitting}
                          className="self-start rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {submitting ? "Validation..." : "Valider le module"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
