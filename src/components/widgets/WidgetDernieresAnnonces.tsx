"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";
import { WidgetCard, WidgetEmpty, WidgetLoading } from "@/components/widgets/WidgetCard";

interface AnnonceRow {
  id: string;
  titre: string;
  created_at: string;
  lu: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function WidgetDernieresAnnonces() {
  const profile = useUserProfile();
  const [annonces, setAnnonces] = useState<AnnonceRow[] | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    (async () => {
      let query = supabase
        .from("annonces")
        .select("id, titre, created_at")
        .eq("boutique_id", profile.boutique_id)
        .order("created_at", { ascending: false })
        .limit(3);

      if (profile.role === "salarie") {
        query = query.eq("cible_role", "tous");
      }

      const { data: annoncesData } = await query;
      const rows = annoncesData ?? [];
      const ids = rows.map((r) => r.id);

      const { data: lecturesData } = await supabase
        .from("annonces_lectures")
        .select("annonce_id")
        .eq("utilisateur_id", profile.id)
        .in("annonce_id", ids.length > 0 ? ids : [""]);

      const luIds = new Set((lecturesData ?? []).map((l) => l.annonce_id));

      if (!cancelled) {
        setAnnonces(rows.map((r) => ({ ...r, lu: luIds.has(r.id) })));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  return (
    <WidgetCard title="Dernières annonces" href="/annonces">
      {annonces === null ? (
        <WidgetLoading />
      ) : annonces.length === 0 ? (
        <WidgetEmpty text="Aucune annonce pour l'instant." />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {annonces.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
              <span className={a.lu ? "text-muted-foreground" : "font-medium text-foreground"}>
                {a.titre}
              </span>
              <span className="shrink-0 text-faint-foreground">{formatDate(a.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
