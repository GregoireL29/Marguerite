"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";
import { WidgetCard, WidgetEmpty, WidgetLoading } from "@/components/widgets/WidgetCard";

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

function formatEuros(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
}

// --- CA du jour ---------------------------------------------------------

export function WidgetCaDuJour() {
  const profile = useUserProfile();
  const [data, setData] = useState<{ ca: number; caHier: number; freq: number } | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      const today = toISODate(new Date());
      const hier = toISODate(addDays(new Date(), -1));

      const { data: rows } = await supabase
        .from("ventes_quotidiennes")
        .select("date, chiffre_affaires, frequentation")
        .eq("boutique_id", profile.boutique_id)
        .in("date", [today, hier]);

      const todayRow = (rows ?? []).find((r) => r.date === today);
      const hierRow = (rows ?? []).find((r) => r.date === hier);

      if (!cancelled) {
        setData({
          ca: todayRow ? Number(todayRow.chiffre_affaires) : 0,
          caHier: hierRow ? Number(hierRow.chiffre_affaires) : 0,
          freq: todayRow ? todayRow.frequentation : 0,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  return (
    <WidgetCard title="CA du jour" href="/indicateurs">
      {data === null ? (
        <WidgetLoading />
      ) : (
        <div>
          <p className="text-2xl font-medium text-zinc-900">{formatEuros(data.ca)}</p>
          <p className="text-xs text-zinc-500">
            {data.freq} client{data.freq > 1 ? "s" : ""}
            {data.caHier > 0 &&
              ` · hier : ${formatEuros(data.caHier)}`}
          </p>
        </div>
      )}
    </WidgetCard>
  );
}

// --- Équipe présente aujourd'hui -----------------------------------------

interface PresenceRow {
  utilisateur_id: string;
  nom: string;
  couleur: string;
  heure_debut: string;
  heure_fin: string;
}

export function WidgetEquipePresente() {
  const profile = useUserProfile();
  const [presences, setPresences] = useState<PresenceRow[] | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      const monday = getMonday(new Date());
      const { data: planning } = await supabase
        .from("plannings")
        .select("id")
        .eq("boutique_id", profile.boutique_id)
        .eq("semaine_debut", toISODate(monday))
        .maybeSingle();

      if (!planning) {
        if (!cancelled) setPresences([]);
        return;
      }

      const { data: creneaux } = await supabase
        .from("creneaux")
        .select("utilisateur_id, heure_debut, heure_fin, utilisateurs(nom, couleur)")
        .eq("planning_id", planning.id)
        .eq("jour", toISODate(new Date()))
        .order("heure_debut");

      const rows = (creneaux ?? []) as unknown as {
        utilisateur_id: string;
        heure_debut: string;
        heure_fin: string;
        utilisateurs: { nom: string; couleur: string } | { nom: string; couleur: string }[] | null;
      }[];

      if (!cancelled) {
        setPresences(
          rows.map((r) => {
            const u = Array.isArray(r.utilisateurs) ? r.utilisateurs[0] : r.utilisateurs;
            return {
              utilisateur_id: r.utilisateur_id,
              nom: u?.nom ?? "?",
              couleur: u?.couleur ?? "#999",
              heure_debut: r.heure_debut,
              heure_fin: r.heure_fin,
            };
          })
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  return (
    <WidgetCard title="Équipe présente aujourd'hui" href="/planning">
      {presences === null ? (
        <WidgetLoading />
      ) : presences.length === 0 ? (
        <WidgetEmpty text="Personne de planifié aujourd'hui." />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {presences.map((p, i) => (
            <li key={`${p.utilisateur_id}-${i}`} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: p.couleur }}
              />
              <span className="text-zinc-900">{p.nom}</span>
              <span className="text-zinc-400">
                {p.heure_debut.slice(0, 5)}–{p.heure_fin.slice(0, 5)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

// --- Progression des tâches ------------------------------------------

export function WidgetProgressionTaches() {
  const profile = useUserProfile();
  const [data, setData] = useState<{ total: number; faites: number } | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      const { data: rows } = await supabase
        .from("taches")
        .select("statut")
        .eq("boutique_id", profile.boutique_id)
        .eq("date", toISODate(new Date()));

      if (!cancelled) {
        const all = rows ?? [];
        setData({
          total: all.length,
          faites: all.filter((t) => t.statut === "faite").length,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  return (
    <WidgetCard title="Progression des tâches" href="/taches">
      {data === null ? (
        <WidgetLoading />
      ) : data.total === 0 ? (
        <WidgetEmpty text="Aucune tâche aujourd'hui." />
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-zinc-900"
              style={{ width: `${Math.round((data.faites / data.total) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            {data.faites}/{data.total} tâches faites
          </p>
        </div>
      )}
    </WidgetCard>
  );
}

// --- Demandes de congés en attente ---------------------------------------

export function WidgetCongesEnAttente() {
  const profile = useUserProfile();
  const [demandes, setDemandes] = useState<{ id: string; nom: string }[] | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      const { data: rows } = await supabase
        .from("demandes_conges")
        .select("id, utilisateurs(nom)")
        .eq("statut", "en_attente")
        .order("created_at", { ascending: true })
        .limit(5);

      const list = (rows ?? []) as unknown as {
        id: string;
        utilisateurs: { nom: string } | { nom: string }[] | null;
      }[];

      if (!cancelled) {
        setDemandes(
          list.map((r) => ({
            id: r.id,
            nom: Array.isArray(r.utilisateurs) ? (r.utilisateurs[0]?.nom ?? "?") : (r.utilisateurs?.nom ?? "?"),
          }))
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  return (
    <WidgetCard title="Congés en attente" href="/conges">
      {demandes === null ? (
        <WidgetLoading />
      ) : demandes.length === 0 ? (
        <WidgetEmpty text="Aucune demande en attente." />
      ) : (
        <ul className="flex flex-col gap-1 text-xs text-zinc-700">
          {demandes.map((d) => (
            <li key={d.id}>{d.nom}</li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

// --- Échéances proches -----------------------------------------------

type DelaiRappel = "jour_meme" | "1_semaine" | "1_mois" | "personnalise";

const DELAI_JOURS: Record<DelaiRappel, number> = {
  jour_meme: 0,
  "1_semaine": 7,
  "1_mois": 30,
  personnalise: 0,
};

interface EcheanceRow {
  id: string;
  titre: string;
  date_echeance: string;
  statut: "a_venir" | "en_retard" | "faite";
}

function formatDateCourt(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function WidgetEcheancesProches() {
  const profile = useUserProfile();
  const [echeances, setEcheances] = useState<EcheanceRow[] | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      const { data: rows } = await supabase
        .from("echeances")
        .select("id, titre, date_echeance, statut")
        .eq("boutique_id", profile.boutique_id)
        .neq("statut", "faite")
        .order("date_echeance", { ascending: true })
        .limit(3);

      if (!cancelled) setEcheances((rows ?? []) as EcheanceRow[]);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  return (
    <WidgetCard title="Échéances proches" href="/echeances">
      {echeances === null ? (
        <WidgetLoading />
      ) : echeances.length === 0 ? (
        <WidgetEmpty text="Aucune échéance en cours." />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {echeances.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-zinc-900">{e.titre}</span>
              <span
                className={
                  e.statut === "en_retard"
                    ? "font-medium text-red-600"
                    : "text-zinc-400"
                }
              >
                {formatDateCourt(e.date_echeance)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

// --- Notes de frais en attente -----------------------------------------

export function WidgetNotesFraisEnAttente() {
  const profile = useUserProfile();
  const [notes, setNotes] = useState<{ id: string; nom: string; montant: number }[] | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      const { data: rows } = await supabase
        .from("notes_frais")
        .select("id, montant, utilisateurs(nom)")
        .eq("boutique_id", profile.boutique_id)
        .eq("statut", "en_attente")
        .order("created_at", { ascending: true })
        .limit(5);

      const list = (rows ?? []) as unknown as {
        id: string;
        montant: number;
        utilisateurs: { nom: string } | { nom: string }[] | null;
      }[];

      if (!cancelled) {
        setNotes(
          list.map((r) => ({
            id: r.id,
            montant: Number(r.montant),
            nom: Array.isArray(r.utilisateurs) ? (r.utilisateurs[0]?.nom ?? "?") : (r.utilisateurs?.nom ?? "?"),
          }))
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  return (
    <WidgetCard title="Notes de frais en attente" href="/notes-frais">
      {notes === null ? (
        <WidgetLoading />
      ) : notes.length === 0 ? (
        <WidgetEmpty text="Aucune note en attente." />
      ) : (
        <ul className="flex flex-col gap-1 text-xs text-zinc-700">
          {notes.map((n) => (
            <li key={n.id} className="flex items-center justify-between gap-2">
              <span>{n.nom}</span>
              <span className="text-zinc-400">{formatEuros(n.montant)}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

// --- Total factures du mois --------------------------------------------

export function WidgetTotalFacturesMois() {
  const profile = useUserProfile();
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      const now = new Date();
      const debutMois = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
      const finMois = toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

      const { data: rows } = await supabase
        .from("factures_fournisseurs")
        .select("montant_ht, taux_tva")
        .eq("boutique_id", profile.boutique_id)
        .gte("date_facture", debutMois)
        .lte("date_facture", finMois);

      if (!cancelled) {
        const ttc = (rows ?? []).reduce(
          (s, f) => s + Number(f.montant_ht) * (1 + Number(f.taux_tva) / 100),
          0
        );
        setTotal(ttc);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  return (
    <WidgetCard title="Factures du mois" href="/factures-fournisseurs">
      {total === null ? (
        <WidgetLoading />
      ) : (
        <p className="text-2xl font-medium text-zinc-900">{formatEuros(total)} TTC</p>
      )}
    </WidgetCard>
  );
}

// --- Progression onboarding de l'équipe -------------------------------

export function WidgetProgressionOnboardingEquipe() {
  const profile = useUserProfile();
  const [data, setData] = useState<{ total: number; complete: number } | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      const [{ data: modules }, { data: salaries }] = await Promise.all([
        supabase
          .from("modules_formation")
          .select("id")
          .eq("boutique_id", profile.boutique_id),
        supabase
          .from("utilisateurs")
          .select("id")
          .eq("boutique_id", profile.boutique_id)
          .eq("role", "salarie"),
      ]);

      const moduleIds = (modules ?? []).map((m) => m.id);
      const total = moduleIds.length * (salaries ?? []).length;

      if (total === 0) {
        if (!cancelled) setData({ total: 0, complete: 0 });
        return;
      }

      const { data: progression } = await supabase
        .from("progression_formation")
        .select("statut")
        .in("module_id", moduleIds)
        .eq("statut", "complete");

      if (!cancelled) {
        setData({ total, complete: (progression ?? []).length });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  return (
    <WidgetCard title="Onboarding de l'équipe" href="/onboarding">
      {data === null ? (
        <WidgetLoading />
      ) : data.total === 0 ? (
        <WidgetEmpty text="Aucun module ou aucun salarié pour l'instant." />
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-zinc-900"
              style={{ width: `${Math.round((data.complete / data.total) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            {data.complete}/{data.total} modules complétés au total
          </p>
        </div>
      )}
    </WidgetCard>
  );
}
