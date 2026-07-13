"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

interface DemandeRow {
  id: string;
  date_debut: string;
  date_fin: string;
  message: string | null;
  statut: "en_attente" | "validee" | "refusee";
  created_at: string;
}

const STATUT_LABEL: Record<DemandeRow["statut"], string> = {
  en_attente: "En attente",
  validee: "Validée",
  refusee: "Refusée",
};

const STATUT_STYLE: Record<DemandeRow["statut"], string> = {
  en_attente: "bg-border/30 text-muted-foreground",
  validee: "bg-green-100 text-green-700 dark:text-green-400",
  refusee: "bg-red-100 text-red-700",
};

function formatDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function joursInclusifs(debut: string, fin: string): number {
  const [y1, m1, d1] = debut.split("-").map(Number);
  const [y2, m2, d2] = fin.split("-").map(Number);
  const start = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

export function SalarieConges({ embedded = false }: { embedded?: boolean } = {}) {
  const profile = useUserProfile();
  const [demandes, setDemandes] = useState<DemandeRow[]>([]);
  const [soldeConges, setSoldeConges] = useState<number | null>(null);
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    const [{ data: profilData, error: profilError }, { data: demandesData, error: demandesError }] =
      await Promise.all([
        supabase
          .from("profils_salarie")
          .select("solde_conges_jours")
          .eq("utilisateur_id", profile.id)
          .maybeSingle(),
        supabase
          .from("demandes_conges")
          .select("id, date_debut, date_fin, message, statut, created_at")
          .eq("utilisateur_id", profile.id)
          .order("created_at", { ascending: false }),
      ]);

    if (profilError) {
      setError(profilError.message);
      setLoading(false);
      return;
    }
    if (demandesError) {
      setError(demandesError.message);
      setLoading(false);
      return;
    }

    const allDemandes = demandesData ?? [];

    if (profilData?.solde_conges_jours != null) {
      const currentYear = new Date().getFullYear();
      const joursUtilises = allDemandes
        .filter(
          (d) =>
            d.statut === "validee" &&
            new Date(d.date_debut).getFullYear() === currentYear
        )
        .reduce((sum, d) => sum + joursInclusifs(d.date_debut, d.date_fin), 0);
      setSoldeConges(profilData.solde_conges_jours - joursUtilises);
    } else {
      setSoldeConges(null);
    }

    setDemandes(allDemandes);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    if (new Date(dateFin) < new Date(dateDebut)) {
      setError("La date de fin doit être après la date de début.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from("demandes_conges").insert({
      utilisateur_id: profile.id,
      date_debut: dateDebut,
      date_fin: dateFin,
      message: message.trim() || null,
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setDateDebut("");
    setDateFin("");
    setMessage("");
    await load();
  }

  if (!profile) return null;

  const content = (
    <>
      {soldeConges !== null && (
        <p className="text-sm text-muted-foreground">
          Solde restant :{" "}
          <span className="font-medium text-foreground">{soldeConges} jours</span>
        </p>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="date_debut" className="text-sm text-muted-foreground">
              Du
            </label>
            <input
              id="date_debut"
              type="date"
              required
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="date_fin" className="text-sm text-muted-foreground">
              Au
            </label>
            <input
              id="date_fin"
              type="date"
              required
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="message" className="text-sm text-muted-foreground">
            Message (optionnel)
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {saving ? "Envoi..." : "Envoyer la demande"}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">Historique</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : demandes.length === 0 ? (
          <p className="text-sm text-faint-foreground">Aucune demande pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {demandes.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-foreground">
                    {formatDate(d.date_debut)} – {formatDate(d.date_fin)}
                  </p>
                  {d.message && (
                    <p className="text-xs text-muted-foreground">{d.message}</p>
                  )}
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUT_STYLE[d.statut]}`}
                >
                  {STATUT_LABEL[d.statut]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );

  if (embedded) {
    return <div className="flex flex-col gap-6">{content}</div>;
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-medium text-foreground">Congés</h1>
      {content}
    </main>
  );
}
