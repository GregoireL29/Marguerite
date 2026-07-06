"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type JourKey = "lun" | "mar" | "mer" | "jeu" | "ven" | "sam" | "dim";

interface HoraireCreneau {
  debut: string;
  fin: string;
}

type Horaires = Record<JourKey, HoraireCreneau[]>;

interface Salarie {
  id: string;
  nom: string;
  couleur: string;
}

interface CreneauRow {
  id: string;
  utilisateur_id: string;
  jour: string;
  heure_debut: string;
  heure_fin: string;
}

interface FormState {
  jourOffset: number;
  utilisateur_id: string;
  heure_debut: string;
  heure_fin: string;
}

const JOURS: { key: JourKey; label: string; offset: number }[] = [
  { key: "lun", label: "Lundi", offset: 0 },
  { key: "mar", label: "Mardi", offset: 1 },
  { key: "mer", label: "Mercredi", offset: 2 },
  { key: "jeu", label: "Jeudi", offset: 3 },
  { key: "ven", label: "Vendredi", offset: 4 },
  { key: "sam", label: "Samedi", offset: 5 },
  { key: "dim", label: "Dimanche", offset: 6 },
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

const EMPTY_FORM: FormState = {
  jourOffset: 0,
  utilisateur_id: "",
  heure_debut: "09:00",
  heure_fin: "13:00",
};

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

function getMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function formatDateLong(d: Date): string {
  const end = addDays(d, 6);
  return `${d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
  })} – ${end.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60)
    .toString()
    .padStart(2, "0");
  const mm = (m % 60).toString().padStart(2, "0");
  return `${h}:${mm}`;
}

interface Bucket {
  start: number;
  end: number;
  required: number;
  actual: number;
}

// Chaque jour ouvert peut avoir plusieurs créneaux d'ouverture (coupure
// méridienne). Pour chacun, on découpe en tranches d'une heure :
// effectif_min_ouverture s'applique sur la première heure, effectif_min_fermeture
// sur la dernière, et effectif_min_journee sur tout le reste. Si le créneau
// ne fait qu'une heure, on retient le plus exigeant des deux seuils bord à bord.
function computeBuckets(
  openBlocks: HoraireCreneau[],
  dayCreneaux: CreneauRow[],
  effOuverture: number,
  effJournee: number,
  effFermeture: number
): Bucket[] {
  const buckets: Bucket[] = [];

  for (const block of openBlocks) {
    const start = timeToMinutes(block.debut);
    const end = timeToMinutes(block.fin);

    const slots: { start: number; end: number }[] = [];
    for (let t = start; t < end; t += 60) {
      slots.push({ start: t, end: Math.min(t + 60, end) });
    }

    slots.forEach((slot, index) => {
      let required: number;
      if (slots.length === 1) {
        required = Math.max(effOuverture, effFermeture);
      } else if (index === 0) {
        required = effOuverture;
      } else if (index === slots.length - 1) {
        required = effFermeture;
      } else {
        required = effJournee;
      }

      const actual = dayCreneaux.filter(
        (c) =>
          timeToMinutes(c.heure_debut) <= slot.start &&
          timeToMinutes(c.heure_fin) >= slot.end
      ).length;

      buckets.push({ start: slot.start, end: slot.end, required, actual });
    });
  }

  return buckets;
}

export default function Home() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [horaires, setHoraires] = useState<Horaires>(EMPTY_HORAIRES);
  const [effectifOuverture, setEffectifOuverture] = useState(1);
  const [effectifFermeture, setEffectifFermeture] = useState(1);
  const [effectifJournee, setEffectifJournee] = useState(1);
  const [salaries, setSalaries] = useState<Salarie[]>([]);
  const [planningId, setPlanningId] = useState<string | null>(null);
  const [creneaux, setCreneaux] = useState<CreneauRow[]>([]);
  const [mode, setMode] = useState<"grid" | "form">("grid");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async (week: Date) => {
    setLoading(true);
    setError(null);

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    const { data: currentUser, error: userError } = await supabase
      .from("utilisateurs")
      .select("structure_id, boutique_id")
      .eq("auth_id", authUser?.id ?? "")
      .maybeSingle();

    if (userError || !currentUser?.boutique_id || !currentUser?.structure_id) {
      setError(
        userError?.message ?? "Aucune boutique associée à votre compte."
      );
      setLoading(false);
      return;
    }

    const [{ data: boutique, error: boutiqueError }, { data: salariesData, error: salariesError }] =
      await Promise.all([
        supabase
          .from("boutiques")
          .select(
            "horaires, effectif_min_ouverture, effectif_min_fermeture, effectif_min_journee"
          )
          .eq("id", currentUser.boutique_id)
          .single(),
        supabase
          .from("utilisateurs")
          .select("id, nom, couleur")
          .eq("structure_id", currentUser.structure_id)
          .order("nom"),
      ]);

    if (boutiqueError || !boutique) {
      setError(boutiqueError?.message ?? "Boutique introuvable.");
      setLoading(false);
      return;
    }
    if (salariesError) {
      setError(salariesError.message);
      setLoading(false);
      return;
    }

    setHoraires({ ...EMPTY_HORAIRES, ...(boutique.horaires ?? {}) });
    setEffectifOuverture(boutique.effectif_min_ouverture);
    setEffectifFermeture(boutique.effectif_min_fermeture);
    setEffectifJournee(boutique.effectif_min_journee);
    setSalaries(salariesData ?? []);

    const semaineDebut = toISODate(week);

    const { data: existingPlanning, error: planningFetchError } =
      await supabase
        .from("plannings")
        .select("id")
        .eq("boutique_id", currentUser.boutique_id)
        .eq("semaine_debut", semaineDebut)
        .maybeSingle();

    if (planningFetchError) {
      setError(planningFetchError.message);
      setLoading(false);
      return;
    }

    let currentPlanningId = existingPlanning?.id as string | undefined;

    if (!currentPlanningId) {
      const { data: createdPlanning, error: createError } = await supabase
        .from("plannings")
        .insert({
          boutique_id: currentUser.boutique_id,
          semaine_debut: semaineDebut,
        })
        .select("id")
        .single();

      if (createError || !createdPlanning) {
        setError(
          createError?.message ?? "Erreur lors de la création du planning."
        );
        setLoading(false);
        return;
      }
      currentPlanningId = createdPlanning.id;
    }

    setPlanningId(currentPlanningId);

    const { data: creneauxData, error: creneauxError } = await supabase
      .from("creneaux")
      .select("*")
      .eq("planning_id", currentPlanningId)
      .order("jour")
      .order("heure_debut");

    if (creneauxError) {
      setError(creneauxError.message);
      setLoading(false);
      return;
    }

    setCreneaux(creneauxData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll(weekStart);
  }, [weekStart, loadAll]);

  const salariesById = useMemo(
    () => Object.fromEntries(salaries.map((s) => [s.id, s])),
    [salaries]
  );

  const creneauxByDay = useMemo(() => {
    const map: Record<string, CreneauRow[]> = {};
    for (const c of creneaux) {
      (map[c.jour] ??= []).push(c);
    }
    return map;
  }, [creneaux]);

  function startCreate(offset: number) {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      jourOffset: offset,
      utilisateur_id: salaries[0]?.id ?? "",
    });
    setError(null);
    setMode("form");
  }

  function startEdit(c: CreneauRow) {
    const offset =
      JOURS.find((j) => toISODate(addDays(weekStart, j.offset)) === c.jour)
        ?.offset ?? 0;
    setEditingId(c.id);
    setForm({
      jourOffset: offset,
      utilisateur_id: c.utilisateur_id,
      heure_debut: c.heure_debut.slice(0, 5),
      heure_fin: c.heure_fin.slice(0, 5),
    });
    setError(null);
    setMode("form");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!planningId || !form.utilisateur_id) return;

    if (timeToMinutes(form.heure_fin) <= timeToMinutes(form.heure_debut)) {
      setError("L'heure de fin doit être après l'heure de début.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      planning_id: planningId,
      utilisateur_id: form.utilisateur_id,
      jour: toISODate(addDays(weekStart, form.jourOffset)),
      heure_debut: form.heure_debut,
      heure_fin: form.heure_fin,
    };

    const { error: submitError } = editingId
      ? await supabase.from("creneaux").update(payload).eq("id", editingId)
      : await supabase.from("creneaux").insert(payload);

    setSaving(false);

    if (submitError) {
      setError(submitError.message);
      return;
    }

    setMode("grid");
    await loadAll(weekStart);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
            aria-label="Semaine précédente"
          >
            &lsaquo;
          </button>
          <h1 className="text-lg font-medium text-zinc-900">
            Semaine du {formatDateLong(weekStart)}
          </h1>
          <button
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
            aria-label="Semaine suivante"
          >
            &rsaquo;
          </button>
        </div>
        <div className="flex gap-4">
          <Link href="/equipe" className="text-sm text-zinc-600 hover:underline">
            Gérer l&apos;équipe
          </Link>
          <Link href="/boutique" className="text-sm text-zinc-600 hover:underline">
            Ma boutique
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {mode === "grid" &&
        (loading ? (
          <p className="text-sm text-zinc-500">Chargement...</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {JOURS.map(({ key, label, offset }) => {
              const date = addDays(weekStart, offset);
              const dateISO = toISODate(date);
              const dayCreneaux = creneauxByDay[dateISO] ?? [];
              const openBlocks = horaires[key] ?? [];
              const buckets = computeBuckets(
                openBlocks,
                dayCreneaux,
                effectifOuverture,
                effectifJournee,
                effectifFermeture
              );
              const hasGap = buckets.some((b) => b.actual < b.required);

              return (
                <div key={key} className="flex w-40 shrink-0 flex-col gap-2">
                  <div>
                    <p className="text-xs font-medium text-zinc-900">
                      {label}
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      {formatDateShort(date)}
                    </p>
                  </div>

                  {buckets.length > 0 && (
                    <div
                      className="flex h-2 w-full overflow-hidden rounded"
                      title="Couverture par rapport aux effectifs minimums"
                    >
                      {buckets.map((b, i) => (
                        <div
                          key={i}
                          title={`${minutesToTime(b.start)}–${minutesToTime(
                            b.end
                          )} : ${b.actual}/${b.required}`}
                          className={`flex-1 ${
                            b.actual < b.required ? "bg-red-400" : "bg-green-200"
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  {hasGap && (
                    <p className="text-[10px] font-medium text-red-600">
                      Sous-effectif
                    </p>
                  )}

                  <div className="flex flex-col gap-1">
                    {dayCreneaux.map((c) => {
                      const salarie = salariesById[c.utilisateur_id];
                      return (
                        <button
                          key={c.id}
                          onClick={() => startEdit(c)}
                          className="w-full rounded-md px-2 py-1 text-left text-[11px] font-medium text-white"
                          style={{ backgroundColor: salarie?.couleur ?? "#999" }}
                        >
                          {salarie?.nom ?? "?"}
                          <br />
                          {c.heure_debut.slice(0, 5)}–{c.heure_fin.slice(0, 5)}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => startCreate(offset)}
                    className="text-[11px] text-zinc-400 hover:text-zinc-700"
                  >
                    + Ajouter
                  </button>
                </div>
              );
            })}
          </div>
        ))}

      {mode === "form" && (
        <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="jour" className="text-sm text-zinc-600">
              Jour
            </label>
            <select
              id="jour"
              value={form.jourOffset}
              onChange={(e) =>
                setForm((f) => ({ ...f, jourOffset: Number(e.target.value) }))
              }
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            >
              {JOURS.map((j) => (
                <option key={j.key} value={j.offset}>
                  {j.label} {formatDateShort(addDays(weekStart, j.offset))}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="utilisateur_id" className="text-sm text-zinc-600">
              Salarié
            </label>
            <select
              id="utilisateur_id"
              required
              value={form.utilisateur_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, utilisateur_id: e.target.value }))
              }
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            >
              <option value="" disabled>
                Choisir un salarié
              </option>
              {salaries.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="heure_debut" className="text-sm text-zinc-600">
                Début
              </label>
              <input
                id="heure_debut"
                type="time"
                required
                value={form.heure_debut}
                onChange={(e) =>
                  setForm((f) => ({ ...f, heure_debut: e.target.value }))
                }
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="heure_fin" className="text-sm text-zinc-600">
                Fin
              </label>
              <input
                id="heure_fin"
                type="time"
                required
                value={form.heure_fin}
                onChange={(e) =>
                  setForm((f) => ({ ...f, heure_fin: e.target.value }))
                }
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => setMode("grid")}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700"
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
