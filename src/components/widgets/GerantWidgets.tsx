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

function formatEuros(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
}

// --- Comparatif boutiques ------------------------------------------------

interface BoutiqueCa {
  id: string;
  nom: string;
  ca: number;
}

export function WidgetComparatifBoutiques() {
  const profile = useUserProfile();
  const [data, setData] = useState<BoutiqueCa[] | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      const { data: boutiques } = await supabase
        .from("boutiques")
        .select("id, nom")
        .eq("structure_id", profile.structure_id)
        .order("nom");

      if (!boutiques || boutiques.length === 0) {
        if (!cancelled) setData([]);
        return;
      }

      const now = new Date();
      const debutMois = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
      const finMois = toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

      const { data: ventes } = await supabase
        .from("ventes_quotidiennes")
        .select("boutique_id, chiffre_affaires")
        .in(
          "boutique_id",
          boutiques.map((b) => b.id)
        )
        .gte("date", debutMois)
        .lte("date", finMois);

      const parBoutique = new Map<string, number>();
      for (const b of boutiques) parBoutique.set(b.id, 0);
      for (const v of ventes ?? []) {
        parBoutique.set(v.boutique_id, (parBoutique.get(v.boutique_id) ?? 0) + Number(v.chiffre_affaires));
      }

      const computed = boutiques
        .map((b) => ({ id: b.id, nom: b.nom, ca: parBoutique.get(b.id) ?? 0 }))
        .sort((a, b) => b.ca - a.ca);

      if (!cancelled) setData(computed);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  return (
    <WidgetCard title="Comparatif boutiques (mois en cours)" href="/indicateurs">
      {data === null ? (
        <WidgetLoading />
      ) : data.length === 0 ? (
        <WidgetEmpty text="Aucune boutique." />
      ) : (
        <ul className="flex flex-col gap-1 text-xs text-foreground">
          {data.map((b, i) => (
            <li key={b.id} className="flex items-center justify-between gap-2">
              <span>
                {i + 1}. {b.nom}
              </span>
              <span className="text-faint-foreground">{formatEuros(b.ca)}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

// --- CA du jour par boutique ----------------------------------------------

export function WidgetCaDuJourStructure() {
  const profile = useUserProfile();
  const [data, setData] = useState<BoutiqueCa[] | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      const { data: boutiques } = await supabase
        .from("boutiques")
        .select("id, nom")
        .eq("structure_id", profile.structure_id)
        .order("nom");

      if (!boutiques || boutiques.length === 0) {
        if (!cancelled) setData([]);
        return;
      }

      const today = toISODate(new Date());

      const { data: ventes } = await supabase
        .from("ventes_quotidiennes")
        .select("boutique_id, chiffre_affaires")
        .in(
          "boutique_id",
          boutiques.map((b) => b.id)
        )
        .eq("date", today);

      const parBoutique = new Map<string, number>();
      for (const b of boutiques) parBoutique.set(b.id, 0);
      for (const v of ventes ?? []) {
        parBoutique.set(v.boutique_id, Number(v.chiffre_affaires));
      }

      const computed = boutiques.map((b) => ({ id: b.id, nom: b.nom, ca: parBoutique.get(b.id) ?? 0 }));

      if (!cancelled) setData(computed);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const total = data?.reduce((s, b) => s + b.ca, 0) ?? 0;

  return (
    <WidgetCard title="CA du jour par boutique" href="/indicateurs">
      {data === null ? (
        <WidgetLoading />
      ) : data.length === 0 ? (
        <WidgetEmpty text="Aucune boutique." />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-4xl font-semibold text-foreground">{formatEuros(total)}</p>
          <ul className="flex flex-col gap-1 text-xs text-foreground">
            {data.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2">
                <span>{b.nom}</span>
                <span className="text-faint-foreground">{formatEuros(b.ca)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </WidgetCard>
  );
}

// --- Notes de frais en attente (structure) --------------------------------

interface NoteFraisRow {
  id: string;
  nom: string;
  montant: number;
  boutiqueNom: string;
}

export function WidgetNotesFraisEnAttenteStructure() {
  const profile = useUserProfile();
  const [notes, setNotes] = useState<NoteFraisRow[] | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      // Pas de filtre boutique_id : la RLS restreint déjà aux notes de
      // frais de toutes les boutiques de la structure.
      const { data: rows } = await supabase
        .from("notes_frais")
        .select("id, montant, utilisateurs(nom), boutiques(nom)")
        .eq("statut", "en_attente")
        .order("created_at", { ascending: true })
        .limit(5);

      const list = (rows ?? []) as unknown as {
        id: string;
        montant: number;
        utilisateurs: { nom: string } | { nom: string }[] | null;
        boutiques: { nom: string } | { nom: string }[] | null;
      }[];

      if (!cancelled) {
        setNotes(
          list.map((r) => {
            const utilisateur = Array.isArray(r.utilisateurs) ? r.utilisateurs[0] : r.utilisateurs;
            const boutique = Array.isArray(r.boutiques) ? r.boutiques[0] : r.boutiques;
            return {
              id: r.id,
              montant: Number(r.montant),
              nom: utilisateur?.nom ?? "?",
              boutiqueNom: boutique?.nom ?? "?",
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
    <WidgetCard title="Notes de frais en attente" href="/notes-frais">
      {notes === null ? (
        <WidgetLoading />
      ) : notes.length === 0 ? (
        <WidgetEmpty text="Aucune note en attente." />
      ) : (
        <ul className="flex flex-col gap-1 text-xs text-foreground">
          {notes.map((n) => (
            <li key={n.id} className="flex items-center justify-between gap-2">
              <span>
                {n.nom} <span className="text-faint-foreground">· {n.boutiqueNom}</span>
              </span>
              <span className="text-faint-foreground">{formatEuros(n.montant)}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

// --- Total factures du mois (structure) -----------------------------------

export function WidgetTotalFacturesMoisStructure() {
  const profile = useUserProfile();
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      const now = new Date();
      const debutMois = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
      const finMois = toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

      // Pas de filtre boutique_id : la RLS restreint déjà aux factures de
      // toutes les boutiques de la structure.
      const { data: rows } = await supabase
        .from("factures_fournisseurs")
        .select("montant_ht, taux_tva")
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
    <WidgetCard title="Factures du mois (toutes boutiques)" href="/factures-fournisseurs">
      {total === null ? (
        <WidgetLoading />
      ) : (
        <p className="text-4xl font-semibold text-foreground">{formatEuros(total)} TTC</p>
      )}
    </WidgetCard>
  );
}
