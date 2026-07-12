"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

interface Boutique {
  id: string;
  nom: string;
}

interface BoutiqueSelectorProps {
  value: string | null;
  onChange: (boutiqueId: string) => void;
}

export function BoutiqueSelector({ value, onChange }: BoutiqueSelectorProps) {
  const profile = useUserProfile();
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    supabase
      .from("boutiques")
      .select("id, nom")
      .eq("structure_id", profile.structure_id)
      .order("nom")
      .then(({ data }) => {
        setBoutiques(data ?? []);
        setLoading(false);
      });
  }, [profile]);

  useEffect(() => {
    if (!value && boutiques.length > 0) {
      onChange(boutiques[0].id);
    }
  }, [boutiques, value, onChange]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Chargement des boutiques...</p>;
  }

  if (boutiques.length === 0) {
    return (
      <p className="text-sm text-faint-foreground">
        Aucune boutique. Créez-en une depuis &laquo; Mes boutiques &raquo;.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="boutique-selector" className="text-sm text-muted-foreground">
        Boutique
      </label>
      <select
        id="boutique-selector"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-fit rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
      >
        {boutiques.map((b) => (
          <option key={b.id} value={b.id}>
            {b.nom}
          </option>
        ))}
      </select>
    </div>
  );
}
