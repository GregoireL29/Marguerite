"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

const CATEGORIES = ["Marchandises", "Fournitures", "Services", "Loyer", "Autre"];

interface Fournisseur {
  id: string;
  nom: string;
  siren: string | null;
  adresse: string | null;
  contact_commercial: string | null;
}

interface Facture {
  id: string;
  fournisseur_id: string;
  fournisseur_nom: string;
  descriptif: string;
  montant_ht: number;
  taux_tva: number;
  categorie: string;
  fichier_url: string;
  date_facture: string;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function montantTtc(facture: { montant_ht: number; taux_tva: number }): number {
  return facture.montant_ht * (1 + facture.taux_tva / 100);
}

function formatEuros(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function FacturesFournisseurs() {
  const profile = useUserProfile();
  const [onglet, setOnglet] = useState<"deposer" | "consulter">("deposer");
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulaire de dépôt
  const [nouveauFournisseur, setNouveauFournisseur] = useState(false);
  const [fournisseurId, setFournisseurId] = useState("");
  const [nouveauNom, setNouveauNom] = useState("");
  const [nouveauSiren, setNouveauSiren] = useState("");
  const [nouveauAdresse, setNouveauAdresse] = useState("");
  const [nouveauContact, setNouveauContact] = useState("");
  const [descriptif, setDescriptif] = useState("");
  const [montantHt, setMontantHt] = useState("");
  const [tauxTva, setTauxTva] = useState("20");
  const [categorie, setCategorie] = useState(CATEGORIES[0]);
  const [dateFacture, setDateFacture] = useState(toISODate(new Date()));
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Consultation
  const [searchTerm, setSearchTerm] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);

    const [{ data: fournisseursData, error: fournisseursError }, { data: facturesData, error: facturesError }] =
      await Promise.all([
        supabase
          .from("fournisseurs")
          .select("id, nom, siren, adresse, contact_commercial")
          .eq("boutique_id", profile.boutique_id)
          .order("nom"),
        supabase
          .from("factures_fournisseurs")
          .select(
            "id, fournisseur_id, descriptif, montant_ht, taux_tva, categorie, fichier_url, date_facture, fournisseurs(nom)"
          )
          .eq("boutique_id", profile.boutique_id)
          .order("date_facture", { ascending: false }),
      ]);

    if (fournisseursError) {
      setError(fournisseursError.message);
      setLoading(false);
      return;
    }
    if (facturesError) {
      setError(facturesError.message);
      setLoading(false);
      return;
    }

    setFournisseurs(fournisseursData ?? []);

    const rows = (facturesData ?? []) as unknown as {
      id: string;
      fournisseur_id: string;
      descriptif: string;
      montant_ht: number;
      taux_tva: number;
      categorie: string;
      fichier_url: string;
      date_facture: string;
      fournisseurs: { nom: string } | { nom: string }[] | null;
    }[];

    setFactures(
      rows.map((r) => ({
        id: r.id,
        fournisseur_id: r.fournisseur_id,
        descriptif: r.descriptif,
        montant_ht: Number(r.montant_ht),
        taux_tva: Number(r.taux_tva),
        categorie: r.categorie,
        fichier_url: r.fichier_url,
        date_facture: r.date_facture,
        fournisseur_nom: Array.isArray(r.fournisseurs)
          ? (r.fournisseurs[0]?.nom ?? "?")
          : (r.fournisseurs?.nom ?? "?"),
      }))
    );

    if (!fournisseurId && fournisseursData && fournisseursData.length > 0) {
      setFournisseurId(fournisseursData[0].id);
    }

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !file) return;
    if (nouveauFournisseur && !nouveauNom.trim()) return;
    if (!nouveauFournisseur && !fournisseurId) return;

    setSaving(true);
    setError(null);

    let resolvedFournisseurId = fournisseurId;

    if (nouveauFournisseur) {
      const { data: newFournisseur, error: insertFournisseurError } = await supabase
        .from("fournisseurs")
        .insert({
          boutique_id: profile.boutique_id,
          nom: nouveauNom.trim(),
          siren: nouveauSiren.trim() || null,
          adresse: nouveauAdresse.trim() || null,
          contact_commercial: nouveauContact.trim() || null,
        })
        .select("id")
        .single();

      if (insertFournisseurError || !newFournisseur) {
        setError(insertFournisseurError?.message ?? "Erreur lors de la création du fournisseur.");
        setSaving(false);
        return;
      }
      resolvedFournisseurId = newFournisseur.id;
    }

    const path = `${profile.boutique_id}/factures-fournisseurs/${resolvedFournisseurId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);

    if (uploadError) {
      setError(uploadError.message);
      setSaving(false);
      return;
    }

    const { error: insertFactureError } = await supabase.from("factures_fournisseurs").insert({
      fournisseur_id: resolvedFournisseurId,
      boutique_id: profile.boutique_id,
      descriptif,
      montant_ht: Number(montantHt),
      taux_tva: Number(tauxTva),
      categorie,
      fichier_url: path,
      date_facture: dateFacture,
    });

    if (insertFactureError) {
      setError(insertFactureError.message);
      setSaving(false);
      return;
    }

    setNouveauFournisseur(false);
    setNouveauNom("");
    setNouveauSiren("");
    setNouveauAdresse("");
    setNouveauContact("");
    setDescriptif("");
    setMontantHt("");
    setTauxTva("20");
    setCategorie(CATEGORIES[0]);
    setDateFacture(toISODate(new Date()));
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSaving(false);
    await load();
  }

  async function handleVoirFacture(fichierUrl: string, id: string) {
    setDownloadingId(id);
    const { data, error: signedUrlError } = await supabase.storage
      .from("documents")
      .createSignedUrl(fichierUrl, 60);
    setDownloadingId(null);

    if (signedUrlError || !data) {
      setError(signedUrlError?.message ?? "Impossible de générer le lien de téléchargement.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  const totalMois = useMemo(() => {
    const now = new Date();
    const debutMois = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
    const finMois = toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const facturesDuMois = factures.filter(
      (f) => f.date_facture >= debutMois && f.date_facture <= finMois
    );
    const ht = facturesDuMois.reduce((s, f) => s + f.montant_ht, 0);
    const ttc = facturesDuMois.reduce((s, f) => s + montantTtc(f), 0);
    return { ht, ttc };
  }, [factures]);

  const pinnedFournisseur = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return null;
    return fournisseurs.find((f) => f.nom.toLowerCase() === term) ?? null;
  }, [fournisseurs, searchTerm]);

  const filteredFactures = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return factures;
    return factures.filter((f) => f.fournisseur_nom.toLowerCase().includes(term));
  }, [factures, searchTerm]);

  const totalFournisseur12Mois = useMemo(() => {
    if (!pinnedFournisseur) return null;
    const seuil = toISODate(new Date(Date.now() - 365 * 86400000));
    const recentes = factures.filter(
      (f) => f.fournisseur_id === pinnedFournisseur.id && f.date_facture >= seuil
    );
    if (recentes.length === 0) return null;
    return recentes.reduce((s, f) => s + montantTtc(f), 0);
  }, [factures, pinnedFournisseur]);

  function exporterCsv() {
    const header = ["Date", "Fournisseur", "Montant HT", "TVA (%)", "Montant TTC", "Catégorie"];
    const rows = filteredFactures.map((f) => [
      f.date_facture,
      f.fournisseur_nom,
      f.montant_ht.toFixed(2),
      f.taux_tva.toFixed(2),
      montantTtc(f).toFixed(2),
      f.categorie,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `factures-fournisseurs_${toISODate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!profile) return null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-medium text-foreground">Factures fournisseurs</h1>

      <div className="flex gap-1">
        <button
          onClick={() => setOnglet("deposer")}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            onglet === "deposer" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-border/40"
          }`}
        >
          Déposer
        </button>
        <button
          onClick={() => setOnglet("consulter")}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            onglet === "consulter" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-border/40"
          }`}
        >
          Consulter
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {onglet === "deposer" ? (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-lg border border-border p-4"
        >
          <p className="text-sm font-medium text-foreground">Nouvelle facture</p>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-muted-foreground">Fournisseur</label>
            {!nouveauFournisseur ? (
              <div className="flex items-center gap-2">
                <select
                  value={fournisseurId}
                  onChange={(e) => setFournisseurId(e.target.value)}
                  className="flex-1 rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                >
                  {fournisseurs.length === 0 && <option value="">Aucun fournisseur</option>}
                  {fournisseurs.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nom}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setNouveauFournisseur(true)}
                  className="shrink-0 text-sm text-muted-foreground hover:underline"
                >
                  + Nouveau
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Nouveau fournisseur</span>
                  <button
                    type="button"
                    onClick={() => setNouveauFournisseur(false)}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Annuler
                  </button>
                </div>
                <input
                  required
                  placeholder="Nom (obligatoire)"
                  value={nouveauNom}
                  onChange={(e) => setNouveauNom(e.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <input
                  placeholder="SIREN (optionnel)"
                  value={nouveauSiren}
                  onChange={(e) => setNouveauSiren(e.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <input
                  placeholder="Adresse (optionnel)"
                  value={nouveauAdresse}
                  onChange={(e) => setNouveauAdresse(e.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <input
                  placeholder="Contact commercial (optionnel)"
                  value={nouveauContact}
                  onChange={(e) => setNouveauContact(e.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="descriptif" className="text-sm text-muted-foreground">
              Descriptif
            </label>
            <textarea
              id="descriptif"
              required
              rows={2}
              value={descriptif}
              onChange={(e) => setDescriptif(e.target.value)}
              placeholder="ex. Livraison de marchandise du 05/07"
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="montant-ht" className="text-sm text-muted-foreground">
                Montant HT (€)
              </label>
              <input
                id="montant-ht"
                type="number"
                step="0.01"
                min="0"
                required
                value={montantHt}
                onChange={(e) => setMontantHt(e.target.value)}
                className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="taux-tva" className="text-sm text-muted-foreground">
                TVA (%)
              </label>
              <input
                id="taux-tva"
                type="number"
                step="0.1"
                min="0"
                required
                value={tauxTva}
                onChange={(e) => setTauxTva(e.target.value)}
                className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="categorie" className="text-sm text-muted-foreground">
                Catégorie
              </label>
              <select
                id="categorie"
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="date-facture" className="text-sm text-muted-foreground">
                Date de la facture
              </label>
              <input
                id="date-facture"
                type="date"
                required
                value={dateFacture}
                onChange={(e) => setDateFacture(e.target.value)}
                className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="facture-file" className="text-sm text-muted-foreground">
              Facture (photo ou PDF)
            </label>
            <input
              id="facture-file"
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-muted-foreground"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !file}
            className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            {saving ? "Envoi..." : "Déposer la facture"}
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm text-muted-foreground">Total du mois</p>
              <p className="text-lg font-medium text-foreground">
                {formatEuros(totalMois.ttc)} € TTC
              </p>
              <p className="text-xs text-muted-foreground">{formatEuros(totalMois.ht)} € HT</p>
            </div>
            <button
              onClick={exporterCsv}
              disabled={filteredFactures.length === 0}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground disabled:opacity-50"
            >
              Exporter en CSV
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="recherche-fournisseur" className="text-sm text-muted-foreground">
              Rechercher un fournisseur
            </label>
            <input
              id="recherche-fournisseur"
              list="fournisseurs-datalist"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nom du fournisseur..."
              className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <datalist id="fournisseurs-datalist">
              {fournisseurs.map((f) => (
                <option key={f.id} value={f.nom} />
              ))}
            </datalist>
          </div>

          {pinnedFournisseur && (
            <div className="flex flex-col gap-1 rounded-lg border border-accent p-4">
              <p className="text-sm font-medium text-foreground">{pinnedFournisseur.nom}</p>
              <p className="text-xs text-muted-foreground">
                SIREN : {pinnedFournisseur.siren ?? "Non renseigné"}
              </p>
              <p className="text-xs text-muted-foreground">
                Adresse : {pinnedFournisseur.adresse ?? "Non renseignée"}
              </p>
              <p className="text-xs text-muted-foreground">
                Contact commercial : {pinnedFournisseur.contact_commercial ?? "Non renseigné"}
              </p>
              <p className="mt-1 text-sm text-foreground">
                {totalFournisseur12Mois !== null
                  ? `Total facturé sur 12 mois : ${formatEuros(totalFournisseur12Mois)} € TTC`
                  : "Aucune facture sur les 12 derniers mois."}
              </p>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : filteredFactures.length === 0 ? (
            <p className="text-sm text-faint-foreground">Aucune facture pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {filteredFactures.map((f) => (
                <li key={f.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {f.fournisseur_nom} — {formatEuros(f.montant_ht)} € HT
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {f.categorie} · {formatDate(f.date_facture)} · TVA {f.taux_tva}% ·{" "}
                      {formatEuros(montantTtc(f))} € TTC
                    </p>
                    <p className="text-sm text-muted-foreground">{f.descriptif}</p>
                  </div>
                  <button
                    onClick={() => handleVoirFacture(f.fichier_url, f.id)}
                    disabled={downloadingId === f.id}
                    className="shrink-0 text-sm text-muted-foreground hover:underline disabled:opacity-50"
                  >
                    Voir la facture
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
