"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

type Onglet = "modules" | "suivi";
type Statut = "verrouille" | "en_cours" | "complete";

const STATUT_LABEL: Record<Statut, string> = {
  verrouille: "Verrouillé",
  en_cours: "En cours",
  complete: "Terminé",
};

const STATUT_STYLE: Record<Statut, string> = {
  verrouille: "bg-zinc-100 text-zinc-400",
  en_cours: "bg-amber-100 text-amber-700",
  complete: "bg-green-100 text-green-700",
};

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

interface Salarie {
  id: string;
  nom: string;
}

interface ProgressionRow {
  utilisateur_id: string;
  module_id: string;
  statut: Statut;
  score: number | null;
}

export function ManagerOnboarding() {
  const profile = useUserProfile();
  const [onglet, setOnglet] = useState<Onglet>("modules");
  const [modules, setModules] = useState<Module[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [salaries, setSalaries] = useState<Salarie[]>([]);
  const [progression, setProgression] = useState<ProgressionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Création de module
  const [nouveauTitre, setNouveauTitre] = useState("");
  const [nouveauFile, setNouveauFile] = useState<File | null>(null);
  const [creatingModule, setCreatingModule] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Module développé (questions + remplacement support)
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [replacingSupportId, setReplacingSupportId] = useState<string | null>(null);

  // Ajout de question
  const [qQuestion, setQQuestion] = useState("");
  const [qOptions, setQOptions] = useState<string[]>(["", ""]);
  const [qCorrecte, setQCorrecte] = useState(0);
  const [savingQuestion, setSavingQuestion] = useState(false);

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
      { data: salariesData, error: salariesError },
      { data: progressionData, error: progressionError },
    ] = await Promise.all([
      supabase
        .from("questions_qcm")
        .select("id, module_id, question, options, reponse_correcte, ordre")
        .in("module_id", moduleIds.length > 0 ? moduleIds : [""])
        .order("ordre"),
      supabase
        .from("utilisateurs")
        .select("id, nom")
        .eq("boutique_id", profile.boutique_id)
        .eq("role", "salarie")
        .order("nom"),
      supabase
        .from("progression_formation")
        .select("utilisateur_id, module_id, statut, score")
        .in("module_id", moduleIds.length > 0 ? moduleIds : [""]),
    ]);

    if (questionsError) {
      setError(questionsError.message);
      setLoading(false);
      return;
    }
    if (salariesError) {
      setError(salariesError.message);
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
    setSalaries(salariesData ?? []);
    setProgression((progressionData ?? []) as ProgressionRow[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreateModule(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !nouveauTitre.trim()) return;

    setCreatingModule(true);
    setError(null);

    const ordre = modules.length > 0 ? Math.max(...modules.map((m) => m.ordre)) + 1 : 1;

    const { data: newModule, error: insertError } = await supabase
      .from("modules_formation")
      .insert({ boutique_id: profile.boutique_id, titre: nouveauTitre.trim(), ordre })
      .select("id")
      .single();

    if (insertError || !newModule) {
      setError(insertError?.message ?? "Erreur lors de la création du module.");
      setCreatingModule(false);
      return;
    }

    if (nouveauFile) {
      const path = `${profile.boutique_id}/onboarding/${newModule.id}/${Date.now()}_${nouveauFile.name}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(path, nouveauFile);
      if (!uploadError) {
        await supabase.from("modules_formation").update({ support_url: path }).eq("id", newModule.id);
      }
    }

    setNouveauTitre("");
    setNouveauFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setCreatingModule(false);
    await load();
  }

  async function handleReplaceSupport(moduleId: string, file: File) {
    if (!profile) return;
    setReplacingSupportId(moduleId);
    setError(null);

    const path = `${profile.boutique_id}/onboarding/${moduleId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);

    if (uploadError) {
      setError(uploadError.message);
      setReplacingSupportId(null);
      return;
    }

    const { error: updateError } = await supabase
      .from("modules_formation")
      .update({ support_url: path })
      .eq("id", moduleId);

    setReplacingSupportId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    await load();
  }

  async function moveModule(module: Module, direction: "up" | "down") {
    const sorted = [...modules].sort((a, b) => a.ordre - b.ordre);
    const idx = sorted.findIndex((m) => m.id === module.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const other = sorted[swapIdx];
    setReordering(true);
    setError(null);

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("modules_formation").update({ ordre: other.ordre }).eq("id", module.id),
      supabase.from("modules_formation").update({ ordre: module.ordre }).eq("id", other.id),
    ]);

    setReordering(false);

    if (e1 || e2) {
      setError(e1?.message ?? e2?.message ?? "Erreur lors du réordonnancement.");
      return;
    }
    await load();
  }

  function toggleExpanded(moduleId: string) {
    setExpandedModuleId(expandedModuleId === moduleId ? null : moduleId);
    setQQuestion("");
    setQOptions(["", ""]);
    setQCorrecte(0);
  }

  function updateOption(idx: number, value: string) {
    setQOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  }

  function addOptionField() {
    setQOptions((prev) => (prev.length < 6 ? [...prev, ""] : prev));
  }

  function removeOptionField(idx: number) {
    setQOptions((prev) => {
      if (prev.length <= 2) return prev;
      const next = prev.filter((_, i) => i !== idx);
      if (qCorrecte >= next.length) setQCorrecte(0);
      return next;
    });
  }

  async function handleAddQuestion(e: React.FormEvent, moduleId: string) {
    e.preventDefault();
    const cleanOptions = qOptions.map((o) => o.trim()).filter((o) => o.length > 0);
    if (!qQuestion.trim() || cleanOptions.length < 2) return;

    setSavingQuestion(true);
    setError(null);

    const ordre = questions.filter((q) => q.module_id === moduleId).length + 1;

    const { error: insertError } = await supabase.from("questions_qcm").insert({
      module_id: moduleId,
      question: qQuestion.trim(),
      options: cleanOptions,
      reponse_correcte: qCorrecte,
      ordre,
    });

    setSavingQuestion(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setQQuestion("");
    setQOptions(["", ""]);
    setQCorrecte(0);
    await load();
  }

  if (!profile) return null;

  const sortedModules = [...modules].sort((a, b) => a.ordre - b.ordre);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-medium text-zinc-900">Onboarding nouveaux vendeurs</h1>

      <div className="flex gap-1">
        <button
          onClick={() => setOnglet("modules")}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            onglet === "modules" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          Modules
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

      {onglet === "modules" ? (
        <div className="flex flex-col gap-6">
          <form
            onSubmit={handleCreateModule}
            className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4"
          >
            <p className="text-sm font-medium text-zinc-900">Nouveau module</p>
            <input
              required
              placeholder="Titre du module"
              value={nouveauTitre}
              onChange={(e) => setNouveauTitre(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
            <div className="flex flex-col gap-1">
              <label htmlFor="module-file" className="text-sm text-zinc-600">
                Support (PDF/PPT, optionnel)
              </label>
              <input
                id="module-file"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.ppt,.pptx"
                onChange={(e) => setNouveauFile(e.target.files?.[0] ?? null)}
                className="text-sm text-zinc-600"
              />
            </div>
            <button
              type="submit"
              disabled={creatingModule || !nouveauTitre.trim()}
              className="self-start rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {creatingModule ? "Création..." : "Créer le module"}
            </button>
          </form>

          {loading ? (
            <p className="text-sm text-zinc-500">Chargement...</p>
          ) : sortedModules.length === 0 ? (
            <p className="text-sm text-zinc-400">Aucun module pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {sortedModules.map((m, idx) => {
                const moduleQuestions = questions
                  .filter((q) => q.module_id === m.id)
                  .sort((a, b) => a.ordre - b.ordre);
                const expanded = expandedModuleId === m.id;

                return (
                  <li key={m.id} className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-zinc-900">
                        {idx + 1}. {m.titre}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => moveModule(m, "up")}
                          disabled={idx === 0 || reordering}
                          className="text-xs text-zinc-500 hover:underline disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveModule(m, "down")}
                          disabled={idx === sortedModules.length - 1 || reordering}
                          className="text-xs text-zinc-500 hover:underline disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-500">
                      {m.support_url ? "Support déposé" : "Aucun support"} ·{" "}
                      {moduleQuestions.length} question{moduleQuestions.length > 1 ? "s" : ""}
                    </p>

                    <div className="flex items-center gap-3">
                      <label className="text-xs text-zinc-500 hover:underline cursor-pointer">
                        {replacingSupportId === m.id
                          ? "Envoi..."
                          : m.support_url
                            ? "Remplacer le support"
                            : "Ajouter un support"}
                        <input
                          type="file"
                          accept=".pdf,.ppt,.pptx"
                          className="hidden"
                          disabled={replacingSupportId === m.id}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleReplaceSupport(m.id, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        onClick={() => toggleExpanded(m.id)}
                        className="text-xs text-zinc-500 hover:underline"
                      >
                        {expanded ? "Masquer les questions" : "Gérer les questions"}
                      </button>
                    </div>

                    {expanded && (
                      <div className="mt-2 flex flex-col gap-3 border-t border-zinc-100 pt-3">
                        {moduleQuestions.length > 0 && (
                          <ul className="flex flex-col gap-2">
                            {moduleQuestions.map((q, qIdx) => (
                              <li key={q.id} className="text-sm text-zinc-700">
                                <p className="font-medium">
                                  {qIdx + 1}. {q.question}
                                </p>
                                <ul className="ml-4 list-disc text-xs text-zinc-500">
                                  {q.options.map((o, oIdx) => (
                                    <li
                                      key={oIdx}
                                      className={
                                        oIdx === q.reponse_correcte ? "font-medium text-green-700" : ""
                                      }
                                    >
                                      {o}
                                      {oIdx === q.reponse_correcte ? " (bonne réponse)" : ""}
                                    </li>
                                  ))}
                                </ul>
                              </li>
                            ))}
                          </ul>
                        )}

                        <form
                          onSubmit={(e) => handleAddQuestion(e, m.id)}
                          className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3"
                        >
                          <p className="text-xs font-medium text-zinc-900">Ajouter une question</p>
                          <input
                            required
                            placeholder="Intitulé de la question"
                            value={qQuestion}
                            onChange={(e) => setQQuestion(e.target.value)}
                            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                          />
                          {qOptions.map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correcte-${m.id}`}
                                checked={qCorrecte === oIdx}
                                onChange={() => setQCorrecte(oIdx)}
                              />
                              <input
                                required
                                placeholder={`Choix ${oIdx + 1}`}
                                value={opt}
                                onChange={(e) => updateOption(oIdx, e.target.value)}
                                className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                              />
                              {qOptions.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => removeOptionField(oIdx)}
                                  className="text-xs text-zinc-400 hover:text-zinc-600"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={addOptionField}
                            disabled={qOptions.length >= 6}
                            className="self-start text-xs text-zinc-500 hover:underline disabled:opacity-30"
                          >
                            + Ajouter un choix
                          </button>
                          <button
                            type="submit"
                            disabled={savingQuestion}
                            className="self-start rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {savingQuestion ? "Ajout..." : "Ajouter la question"}
                          </button>
                        </form>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : loading ? (
        <p className="text-sm text-zinc-500">Chargement...</p>
      ) : salaries.length === 0 ? (
        <p className="text-sm text-zinc-400">Aucun salarié pour l&apos;instant.</p>
      ) : sortedModules.length === 0 ? (
        <p className="text-sm text-zinc-400">Aucun module pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {salaries.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4">
              <p className="text-sm font-medium text-zinc-900">{s.nom}</p>
              <ul className="flex flex-col divide-y divide-zinc-100">
                {sortedModules.map((m) => {
                  const row = progression.find(
                    (p) => p.utilisateur_id === s.id && p.module_id === m.id
                  );
                  const statut: Statut = row?.statut ?? "verrouille";
                  return (
                    <li key={m.id} className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-zinc-700">{m.titre}</span>
                      <div className="flex items-center gap-2">
                        {row?.score != null && (
                          <span className="text-xs text-zinc-500">{row.score}%</span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUT_STYLE[statut]}`}
                        >
                          {STATUT_LABEL[statut]}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
