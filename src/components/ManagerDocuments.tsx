"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

type TypeDocument = "contrat" | "avenant" | "justificatif";

const TYPE_LABEL: Record<TypeDocument, string> = {
  contrat: "Contrat",
  avenant: "Avenant",
  justificatif: "Justificatif",
};

const TYPE_STYLE: Record<TypeDocument, string> = {
  contrat: "bg-accent text-accent-foreground",
  avenant: "bg-amber-100 text-amber-700",
  justificatif: "bg-border/30 text-muted-foreground",
};

interface Salarie {
  id: string;
  nom: string;
}

interface DocumentRow {
  id: string;
  utilisateur_id: string;
  nom: string;
  type: TypeDocument;
  fichier_url: string;
  created_at: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ManagerDocuments({ boutiqueId }: { boutiqueId?: string }) {
  const profile = useUserProfile();
  const effectiveBoutiqueId = boutiqueId ?? profile?.boutique_id ?? null;
  const [salaries, setSalaries] = useState<Salarie[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [utilisateurId, setUtilisateurId] = useState("");
  const [type, setType] = useState<"contrat" | "avenant">("contrat");
  const [nom, setNom] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    if (!profile || !effectiveBoutiqueId) return;
    setLoading(true);
    setError(null);

    const [{ data: salariesData, error: salariesError }, { data: docsData, error: docsError }] =
      await Promise.all([
        supabase
          .from("utilisateurs")
          .select("id, nom")
          .eq("boutique_id", effectiveBoutiqueId)
          .eq("role", "salarie")
          .order("nom"),
        supabase
          .from("documents")
          .select("id, utilisateur_id, nom, type, fichier_url, created_at")
          .eq("boutique_id", effectiveBoutiqueId)
          .order("created_at", { ascending: false }),
      ]);

    if (salariesError) {
      setError(salariesError.message);
      setLoading(false);
      return;
    }
    if (docsError) {
      setError(docsError.message);
      setLoading(false);
      return;
    }

    setSalaries(salariesData ?? []);
    setDocuments((docsData ?? []) as DocumentRow[]);
    if (!utilisateurId && salariesData && salariesData.length > 0) {
      setUtilisateurId(salariesData[0].id);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, effectiveBoutiqueId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !effectiveBoutiqueId || !file || !utilisateurId) return;

    setUploading(true);
    setError(null);

    const path = `${effectiveBoutiqueId}/${utilisateurId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(path, file);

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from("documents").insert({
      utilisateur_id: utilisateurId,
      boutique_id: effectiveBoutiqueId,
      nom: nom.trim() || file.name,
      type,
      uploaded_by: profile.id,
      fichier_url: path,
    });

    if (insertError) {
      setError(insertError.message);
      setUploading(false);
      return;
    }

    setNom("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading(false);
    await load();
  }

  async function handleDownload(doc: DocumentRow) {
    setDownloadingId(doc.id);
    const { data, error: signedUrlError } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.fichier_url, 60);
    setDownloadingId(null);

    if (signedUrlError || !data) {
      setError(signedUrlError?.message ?? "Impossible de générer le lien de téléchargement.");
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  if (!profile) return null;

  const salarieName = (id: string) => salaries.find((s) => s.id === id)?.nom ?? "?";
  const grouped = salaries
    .map((s) => ({
      salarie: s,
      docs: documents.filter((d) => d.utilisateur_id === s.id),
    }))
    .filter((g) => g.docs.length > 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-medium text-foreground">Documents</h1>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <form
        onSubmit={handleUpload}
        className="flex flex-col gap-4 rounded-lg border border-border p-4"
      >
        <p className="text-sm font-medium text-foreground">
          Déposer un document pour un salarié
        </p>

        <div className="flex flex-col gap-1">
          <label htmlFor="doc-salarie" className="text-sm text-muted-foreground">
            Salarié
          </label>
          <select
            id="doc-salarie"
            value={utilisateurId}
            onChange={(e) => setUtilisateurId(e.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {salaries.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="doc-type" className="text-sm text-muted-foreground">
            Type
          </label>
          <select
            id="doc-type"
            value={type}
            onChange={(e) => setType(e.target.value as "contrat" | "avenant")}
            className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="contrat">Contrat</option>
            <option value="avenant">Avenant</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="doc-nom" className="text-sm text-muted-foreground">
            Nom du document
          </label>
          <input
            id="doc-nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="ex. Contrat CDI"
            className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="manager-doc-file" className="text-sm text-muted-foreground">
            Fichier
          </label>
          <input
            id="manager-doc-file"
            ref={fileInputRef}
            type="file"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-muted-foreground"
          />
        </div>

        <button
          type="submit"
          disabled={uploading || !file || !utilisateurId}
          className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {uploading ? "Envoi..." : "Déposer le document"}
        </button>
      </form>

      <div className="flex flex-col gap-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-faint-foreground">Aucun document pour l&apos;instant.</p>
        ) : (
          grouped.map((g) => (
            <div key={g.salarie.id} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-foreground">
                {salarieName(g.salarie.id)}
              </h2>
              <ul className="flex flex-col divide-y divide-border">
                {g.docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLE[d.type]}`}
                      >
                        {TYPE_LABEL[d.type]}
                      </span>
                      <div>
                        <p className="text-sm text-foreground">{d.nom}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(d.created_at)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(d)}
                      disabled={downloadingId === d.id}
                      className="text-sm text-muted-foreground hover:underline disabled:opacity-50"
                    >
                      Télécharger
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
