"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";
import { SalarieWeekView } from "@/components/SalarieWeekView";

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

interface Disponibilite {
  jour: JourKey;
  debut: string;
  fin: string;
}

interface ProfilRow {
  heures_hebdo: number;
  jours_repos_fixes: JourKey[];
  disponibilites: Disponibilite[];
}

interface SalarieGen {
  id: string;
  heuresHebdoMin: number;
  joursRepos: Set<JourKey>;
  disponibilites: Disponibilite[];
}

interface ShiftSlot {
  start: number;
  end: number;
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

// Une personne "de fond" par tranche effectif_min_journee couvre tout le
// bloc d'ouverture ; des renforts couvrent le surplus requis en début/fin
// de bloc (effectif_min_ouverture / effectif_min_fermeture), avec une durée
// minimale de 3h pour rester réaliste (pas de créneau d'1h).
const RENFORT_MIN_MINUTES = 180;

function computeDayShiftSlots(
  openBlocks: HoraireCreneau[],
  effOuverture: number,
  effJournee: number,
  effFermeture: number
): ShiftSlot[] {
  const slots: ShiftSlot[] = [];

  for (const block of openBlocks) {
    const start = timeToMinutes(block.debut);
    const end = timeToMinutes(block.fin);

    if (end - start <= 60) {
      const level = Math.max(effOuverture, effFermeture, effJournee);
      for (let i = 0; i < level; i++) slots.push({ start, end });
      continue;
    }

    for (let i = 0; i < effJournee; i++) slots.push({ start, end });

    const extraOuverture = Math.max(0, effOuverture - effJournee);
    if (extraOuverture > 0) {
      const renfortEnd = Math.min(start + RENFORT_MIN_MINUTES, end);
      for (let i = 0; i < extraOuverture; i++) {
        slots.push({ start, end: renfortEnd });
      }
    }

    const extraFermeture = Math.max(0, effFermeture - effJournee);
    if (extraFermeture > 0) {
      const renfortStart = Math.max(end - RENFORT_MIN_MINUTES, start);
      for (let i = 0; i < extraFermeture; i++) {
        slots.push({ start: renfortStart, end });
      }
    }
  }

  // Les créneaux les plus longs sont les plus contraignants à placer :
  // on les traite en premier tant que le plus de salariés sont éligibles.
  return slots.sort((a, b) => b.end - b.start - (a.end - a.start));
}

function isAvailable(
  sal: SalarieGen,
  jour: JourKey,
  start: number,
  end: number
): boolean {
  if (sal.disponibilites.length === 0) return true;
  const windowsForDay = sal.disponibilites.filter((d) => d.jour === jour);
  if (windowsForDay.length === 0) return false;
  return windowsForDay.some(
    (w) => timeToMinutes(w.debut) <= start && timeToMinutes(w.fin) >= end
  );
}

function hasElevenHoursRest(
  prevDayShift: ShiftSlot | undefined,
  candidateStart: number
): boolean {
  if (!prevDayShift) return true;
  const gap = 24 * 60 - prevDayShift.end + candidateStart;
  return gap >= 11 * 60;
}

function generateWeekCreneaux(
  salariesGen: SalarieGen[],
  horaires: Horaires,
  effOuverture: number,
  effJournee: number,
  effFermeture: number,
  weekStart: Date
): { utilisateur_id: string; jour: string; heure_debut: string; heure_fin: string }[] {
  const dayDemand = {} as Record<JourKey, number>;
  for (const { key } of JOURS) {
    const slots = computeDayShiftSlots(
      horaires[key] ?? [],
      effOuverture,
      effJournee,
      effFermeture
    );
    dayDemand[key] = slots.reduce((sum, s) => sum + (s.end - s.start), 0);
  }

  // Un salarié sans jour de repos fixe déclaré se voit quand même garantir
  // un jour de repos dans la semaine (règle légale incompressible),
  // choisi sur le jour où la boutique a le moins besoin de lui.
  const forcedRestDay = new Map<string, JourKey>();
  for (const sal of salariesGen) {
    if (sal.joursRepos.size === 0) {
      const sorted = [...JOURS].sort(
        (a, b) => dayDemand[a.key] - dayDemand[b.key]
      );
      forcedRestDay.set(sal.id, sorted[0].key);
    }
  }

  const remaining = new Map<string, number>();
  for (const sal of salariesGen) remaining.set(sal.id, sal.heuresHebdoMin);

  const lastShiftByDay = new Map<string, Map<JourKey, ShiftSlot>>();
  for (const sal of salariesGen) lastShiftByDay.set(sal.id, new Map());

  const assignedToday = new Map<string, Set<JourKey>>();
  for (const sal of salariesGen) assignedToday.set(sal.id, new Set());

  const results: {
    utilisateur_id: string;
    jour: string;
    heure_debut: string;
    heure_fin: string;
  }[] = [];

  JOURS.forEach(({ key, offset }) => {
    const dateISO = toISODate(addDays(weekStart, offset));
    const prevKey = offset > 0 ? JOURS[offset - 1].key : null;
    const slots = computeDayShiftSlots(
      horaires[key] ?? [],
      effOuverture,
      effJournee,
      effFermeture
    );

    for (const slot of slots) {
      const candidates = salariesGen.filter((sal) => {
        if (sal.joursRepos.has(key)) return false;
        if (forcedRestDay.get(sal.id) === key) return false;
        if (assignedToday.get(sal.id)!.has(key)) return false;
        if (!isAvailable(sal, key, slot.start, slot.end)) return false;
        if (prevKey) {
          const prevShift = lastShiftByDay.get(sal.id)!.get(prevKey);
          if (!hasElevenHoursRest(prevShift, slot.start)) return false;
        }
        return true;
      });

      if (candidates.length === 0) continue;

      candidates.sort(
        (a, b) => remaining.get(b.id)! - remaining.get(a.id)!
      );
      const chosen = candidates[0];

      results.push({
        utilisateur_id: chosen.id,
        jour: dateISO,
        heure_debut: minutesToTime(slot.start),
        heure_fin: minutesToTime(slot.end),
      });

      remaining.set(
        chosen.id,
        remaining.get(chosen.id)! - (slot.end - slot.start)
      );
      lastShiftByDay.get(chosen.id)!.set(key, slot);
      assignedToday.get(chosen.id)!.add(key);
    }
  });

  return results;
}

function ManagerPlanning() {
  const profile = useUserProfile();
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [viewMode, setViewMode] = useState<"semaine" | "jour">("semaine");
  const [selectedDayOffset, setSelectedDayOffset] = useState(() => {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1;
  });
  const [horaires, setHoraires] = useState<Horaires>(EMPTY_HORAIRES);
  const [effectifOuverture, setEffectifOuverture] = useState(1);
  const [effectifFermeture, setEffectifFermeture] = useState(1);
  const [effectifJournee, setEffectifJournee] = useState(1);
  const [salaries, setSalaries] = useState<Salarie[]>([]);
  const [planningId, setPlanningId] = useState<string | null>(null);
  const [planningStatut, setPlanningStatut] = useState<string | null>(null);
  const [creneaux, setCreneaux] = useState<CreneauRow[]>([]);
  const [mode, setMode] = useState<"grid" | "form">("grid");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
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
        .select("id, statut")
        .eq("boutique_id", currentUser.boutique_id)
        .eq("semaine_debut", semaineDebut)
        .maybeSingle();

    if (planningFetchError) {
      setError(planningFetchError.message);
      setLoading(false);
      return;
    }

    let currentPlanningId = existingPlanning?.id as string | undefined;
    let currentStatut = existingPlanning?.statut as string | undefined;

    if (!currentPlanningId) {
      const { data: createdPlanning, error: createError } = await supabase
        .from("plannings")
        .insert({
          boutique_id: currentUser.boutique_id,
          semaine_debut: semaineDebut,
        })
        .select("id, statut")
        .single();

      if (createError || !createdPlanning) {
        setError(
          createError?.message ?? "Erreur lors de la création du planning."
        );
        setLoading(false);
        return;
      }
      currentPlanningId = createdPlanning.id;
      currentStatut = createdPlanning.statut;
    }

    if (!currentPlanningId) {
      setError("Erreur lors de la création du planning.");
      setLoading(false);
      return;
    }

    setPlanningId(currentPlanningId);
    setPlanningStatut(currentStatut ?? null);

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

  async function handleDeleteCreneau() {
    if (!editingId) return;
    const confirmed = window.confirm("Supprimer ce créneau ?");
    if (!confirmed) return;

    setSaving(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from("creneaux")
      .delete()
      .eq("id", editingId);

    setSaving(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMode("grid");
    await loadAll(weekStart);
  }

  async function handleGenerate() {
    if (!planningId) return;

    if (creneaux.length > 0) {
      const confirmed = window.confirm(
        "Cette semaine contient déjà des créneaux. La génération va tous les remplacer. Continuer ?"
      );
      if (!confirmed) return;
    }

    setGenerating(true);
    setError(null);

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    const { data: currentUser, error: userError } = await supabase
      .from("utilisateurs")
      .select("structure_id")
      .eq("auth_id", authUser?.id ?? "")
      .maybeSingle();

    if (userError || !currentUser?.structure_id) {
      setError(
        userError?.message ?? "Impossible de déterminer votre structure."
      );
      setGenerating(false);
      return;
    }

    const { data: salariesData, error: salariesError } = await supabase
      .from("utilisateurs")
      .select("id, profils_salarie(heures_hebdo, jours_repos_fixes, disponibilites)")
      .eq("structure_id", currentUser.structure_id);

    if (salariesError) {
      setError(salariesError.message);
      setGenerating(false);
      return;
    }

    const salariesGen: SalarieGen[] = (salariesData ?? [])
      .map((s) => {
        const profil = (
          s.profils_salarie as unknown as ProfilRow[]
        )[0];
        if (!profil) return null;
        return {
          id: s.id as string,
          heuresHebdoMin: Math.round(profil.heures_hebdo * 60),
          joursRepos: new Set<JourKey>(profil.jours_repos_fixes ?? []),
          disponibilites: profil.disponibilites ?? [],
        };
      })
      .filter((s): s is SalarieGen => s !== null);

    const generated = generateWeekCreneaux(
      salariesGen,
      horaires,
      effectifOuverture,
      effectifJournee,
      effectifFermeture,
      weekStart
    );

    const { error: deleteError } = await supabase
      .from("creneaux")
      .delete()
      .eq("planning_id", planningId);

    if (deleteError) {
      setError(deleteError.message);
      setGenerating(false);
      return;
    }

    if (generated.length > 0) {
      const { error: insertError } = await supabase.from("creneaux").insert(
        generated.map((c) => ({ ...c, planning_id: planningId }))
      );

      if (insertError) {
        setError(insertError.message);
        setGenerating(false);
        return;
      }
    }

    const { error: statutError } = await supabase
      .from("plannings")
      .update({ statut: "genere_ia" })
      .eq("id", planningId);

    if (statutError) {
      setError(statutError.message);
      setGenerating(false);
      return;
    }

    setGenerating(false);
    await loadAll(weekStart);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="rounded-md border border-border px-2 py-1 text-sm text-muted-foreground hover:bg-border/40"
            aria-label="Semaine précédente"
          >
            &lsaquo;
          </button>
          <h1 className="text-lg font-medium text-foreground">
            Semaine du {formatDateLong(weekStart)}
          </h1>
          <button
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="rounded-md border border-border px-2 py-1 text-sm text-muted-foreground hover:bg-border/40"
            aria-label="Semaine suivante"
          >
            &rsaquo;
          </button>
          {planningStatut === "genere_ia" && (
            <span className="rounded-full bg-border/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Généré par IA
            </span>
          )}
          {planningStatut === "publie" && (
            <span className="rounded-full bg-border/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Publié
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleGenerate}
            disabled={generating || loading || mode === "form"}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-border/40 disabled:opacity-50"
          >
            {generating ? "Génération..." : "Générer le planning"}
          </button>
          <Link href="/equipe" className="text-sm text-muted-foreground hover:underline">
            Gérer l&apos;équipe
          </Link>
          <Link href="/boutique" className="text-sm text-muted-foreground hover:underline">
            {profile?.role === "gerant" ? "Mes boutiques" : "Ma boutique"}
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {mode === "grid" && (
        <div className="inline-flex w-fit gap-1 rounded-lg border border-border bg-card p-1">
          <button
            onClick={() => setViewMode("semaine")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === "semaine"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-border/40 hover:text-foreground"
            }`}
          >
            Semaine
          </button>
          <button
            onClick={() => setViewMode("jour")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === "jour"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-border/40 hover:text-foreground"
            }`}
          >
            Jour
          </button>
        </div>
      )}

      {mode === "grid" && viewMode === "jour" &&
        (loading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="inline-flex w-fit gap-1 rounded-lg border border-border bg-card p-1">
              {JOURS.map(({ key, label, offset }) => (
                <button
                  key={key}
                  onClick={() => setSelectedDayOffset(offset)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedDayOffset === offset
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-border/40 hover:text-foreground"
                  }`}
                >
                  {label.slice(0, 3)}
                </button>
              ))}
            </div>

            {(() => {
              const { key, label, offset } = JOURS[selectedDayOffset];
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
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-faint-foreground">{formatDateShort(date)}</p>
                  </div>

                  {buckets.length > 0 && (
                    <div
                      className="flex h-2 w-full max-w-md overflow-hidden rounded"
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
                    <p className="text-xs font-medium text-red-600 dark:text-red-400">
                      Sous-effectif
                    </p>
                  )}

                  <div className="flex max-w-md flex-col gap-2">
                    {dayCreneaux.length === 0 ? (
                      <p className="text-sm text-faint-foreground">
                        Aucun créneau ce jour-là.
                      </p>
                    ) : (
                      dayCreneaux.map((c) => {
                        const salarie = salariesById[c.utilisateur_id];
                        return (
                          <button
                            key={c.id}
                            onClick={() => startEdit(c)}
                            className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-white"
                            style={{ backgroundColor: salarie?.couleur ?? "#999" }}
                          >
                            {salarie?.nom ?? "?"} — {c.heure_debut.slice(0, 5)}–
                            {c.heure_fin.slice(0, 5)}
                          </button>
                        );
                      })
                    )}
                  </div>

                  <button
                    onClick={() => startCreate(offset)}
                    className="self-start text-sm text-faint-foreground hover:text-foreground"
                  >
                    + Ajouter
                  </button>
                </div>
              );
            })()}
          </div>
        ))}

      {mode === "grid" && viewMode === "semaine" &&
        (loading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
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
                    <p className="text-xs font-medium text-foreground">
                      {label}
                    </p>
                    <p className="text-[11px] text-faint-foreground">
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
                    <p className="text-[10px] font-medium text-red-600 dark:text-red-400">
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
                    className="text-[11px] text-faint-foreground hover:text-foreground"
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
            <label htmlFor="jour" className="text-sm text-muted-foreground">
              Jour
            </label>
            <select
              id="jour"
              value={form.jourOffset}
              onChange={(e) =>
                setForm((f) => ({ ...f, jourOffset: Number(e.target.value) }))
              }
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {JOURS.map((j) => (
                <option key={j.key} value={j.offset}>
                  {j.label} {formatDateShort(addDays(weekStart, j.offset))}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="utilisateur_id" className="text-sm text-muted-foreground">
              Salarié
            </label>
            <select
              id="utilisateur_id"
              required
              value={form.utilisateur_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, utilisateur_id: e.target.value }))
              }
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
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
              <label htmlFor="heure_debut" className="text-sm text-muted-foreground">
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
                className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="heure_fin" className="text-sm text-muted-foreground">
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
                className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => setMode("grid")}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground"
            >
              Annuler
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleDeleteCreneau}
                disabled={saving}
                className="rounded-md border border-red-600/40 px-3 py-2 text-sm text-red-600 hover:bg-red-600/10 disabled:opacity-50 dark:border-red-400/40 dark:text-red-400"
              >
                Supprimer
              </button>
            )}
          </div>
        </form>
      )}
    </main>
  );
}

export default function Home() {
  const profile = useUserProfile();

  if (!profile) return null;

  if (profile.role === "salarie") {
    return <SalarieWeekView />;
  }

  return <ManagerPlanning />;
}
