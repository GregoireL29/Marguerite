"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/components/AppShell";

interface Collegue {
  id: string;
  nom: string;
  boutique_id: string | null;
}

interface ConversationSummary {
  id: string;
  participantNoms: string[];
  dernierMessage: string | null;
  dernierMessageAt: string;
}

interface Message {
  id: string;
  auteur_id: string;
  auteur_nom: string;
  contenu: string;
  created_at: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Messagerie() {
  const profile = useUserProfile();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [nouveauMessage, setNouveauMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [creating, setCreating] = useState(false);
  const [collegues, setCollegues] = useState<Collegue[]>([]);
  const [collegueIds, setCollegueIds] = useState<string[]>([]);
  const [creatingConversation, setCreatingConversation] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!profile) return;
    setLoadingList(true);
    setError(null);

    const { data: mine, error: mineError } = await supabase
      .from("conversations_participants")
      .select("conversation_id")
      .eq("utilisateur_id", profile.id);

    if (mineError) {
      setError(mineError.message);
      setLoadingList(false);
      return;
    }

    const convIds = (mine ?? []).map((r) => r.conversation_id);

    if (convIds.length === 0) {
      setConversations([]);
      setLoadingList(false);
      return;
    }

    const [
      { data: participantsData, error: participantsError },
      { data: messagesData, error: messagesError },
      { data: conversationsData, error: conversationsError },
    ] = await Promise.all([
      supabase
        .from("conversations_participants")
        .select("conversation_id, utilisateurs(id, nom)")
        .in("conversation_id", convIds),
      supabase
        .from("messages")
        .select("conversation_id, contenu, created_at")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false }),
      supabase.from("conversations").select("id, created_at").in("id", convIds),
    ]);

    if (participantsError) {
      setError(participantsError.message);
      setLoadingList(false);
      return;
    }
    if (messagesError) {
      setError(messagesError.message);
      setLoadingList(false);
      return;
    }
    if (conversationsError) {
      setError(conversationsError.message);
      setLoadingList(false);
      return;
    }

    const participantsRows = (participantsData ?? []) as unknown as {
      conversation_id: string;
      utilisateurs: { id: string; nom: string } | { id: string; nom: string }[] | null;
    }[];

    const summaries: ConversationSummary[] = convIds.map((id) => {
      const noms = participantsRows
        .filter((p) => p.conversation_id === id)
        .flatMap((p) => (Array.isArray(p.utilisateurs) ? p.utilisateurs : p.utilisateurs ? [p.utilisateurs] : []))
        .filter((u) => u.id !== profile.id)
        .map((u) => u.nom);

      const dernier = (messagesData ?? []).find((m) => m.conversation_id === id);
      const conv = (conversationsData ?? []).find((c) => c.id === id);

      return {
        id,
        participantNoms: noms,
        dernierMessage: dernier?.contenu ?? null,
        dernierMessageAt: dernier?.created_at ?? conv?.created_at ?? "",
      };
    });

    summaries.sort((a, b) => (a.dernierMessageAt < b.dernierMessageAt ? 1 : -1));

    setConversations(summaries);
    setLoadingList(false);
  }, [profile]);

  const loadCollegues = useCallback(async () => {
    if (!profile) return;

    // Le gérant voit tous les collègues de sa structure (toutes boutiques) ;
    // manager et salarié restent scopés à leur propre boutique.
    let query = supabase
      .from("utilisateurs")
      .select("id, nom, boutique_id")
      .neq("id", profile.id)
      .order("nom");

    query =
      profile.role === "gerant"
        ? query.eq("structure_id", profile.structure_id)
        : query.eq("boutique_id", profile.boutique_id);

    const { data, error: collegueError } = await query;

    if (!collegueError) setCollegues(data ?? []);
  }, [profile]);

  useEffect(() => {
    loadConversations();
    loadCollegues();
  }, [loadConversations, loadCollegues]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      setLoadingMessages(true);
      setError(null);

      const [{ data: messagesData, error: messagesError }, { data: participantsData }] =
        await Promise.all([
          supabase
            .from("messages")
            .select("id, auteur_id, contenu, created_at, utilisateurs(nom)")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true }),
          supabase
            .from("conversations_participants")
            .select("utilisateurs(id, nom)")
            .eq("conversation_id", conversationId),
        ]);

      if (messagesError) {
        setError(messagesError.message);
        setLoadingMessages(false);
        return;
      }

      const rows = (messagesData ?? []) as unknown as {
        id: string;
        auteur_id: string;
        contenu: string;
        created_at: string;
        utilisateurs: { nom: string } | { nom: string }[] | null;
      }[];

      setMessages(
        rows.map((r) => ({
          id: r.id,
          auteur_id: r.auteur_id,
          contenu: r.contenu,
          created_at: r.created_at,
          auteur_nom: Array.isArray(r.utilisateurs)
            ? (r.utilisateurs[0]?.nom ?? "?")
            : (r.utilisateurs?.nom ?? "?"),
        }))
      );

      const pRows = (participantsData ?? []) as unknown as {
        utilisateurs: { id: string; nom: string } | { id: string; nom: string }[] | null;
      }[];
      const noms = pRows
        .flatMap((p) => (Array.isArray(p.utilisateurs) ? p.utilisateurs : p.utilisateurs ? [p.utilisateurs] : []))
        .filter((u) => u.id !== profile?.id)
        .map((u) => u.nom);
      setSelectedParticipants(noms);

      setLoadingMessages(false);
    },
    [profile]
  );

  function ouvrirConversation(id: string) {
    setSelectedId(id);
    loadMessages(id);
  }

  function retourListe() {
    setSelectedId(null);
    setMessages([]);
    setNouveauMessage("");
    loadConversations();
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !selectedId || !nouveauMessage.trim()) return;

    setSending(true);
    setError(null);

    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: selectedId,
      auteur_id: profile.id,
      contenu: nouveauMessage.trim(),
    });

    setSending(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setNouveauMessage("");
    await loadMessages(selectedId);
  }

  function toggleCollegue(id: string) {
    setCollegueIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleCreateConversation() {
    if (!profile || collegueIds.length === 0) return;

    // profile.boutique_id est toujours null pour un gérant : la table
    // conversations impose une boutique_id non nulle, on prend donc celle
    // du premier collègue sélectionné (le gérant a accès à toutes les
    // boutiques de sa structure, donc à celle-ci aussi).
    const conversationBoutiqueId =
      profile.boutique_id ?? collegues.find((c) => c.id === collegueIds[0])?.boutique_id ?? null;

    if (!conversationBoutiqueId) {
      setError("Impossible de déterminer la boutique de cette conversation.");
      return;
    }

    setCreatingConversation(true);
    setError(null);

    const { data: newConv, error: insertConvError } = await supabase
      .from("conversations")
      .insert({ boutique_id: conversationBoutiqueId })
      .select("id")
      .single();

    if (insertConvError || !newConv) {
      setError(insertConvError?.message ?? "Erreur lors de la création de la conversation.");
      setCreatingConversation(false);
      return;
    }

    const participants = [profile.id, ...collegueIds].map((utilisateur_id) => ({
      conversation_id: newConv.id,
      utilisateur_id,
    }));

    const { error: insertParticipantsError } = await supabase
      .from("conversations_participants")
      .insert(participants);

    setCreatingConversation(false);

    if (insertParticipantsError) {
      setError(insertParticipantsError.message);
      return;
    }

    setCreating(false);
    setCollegueIds([]);
    ouvrirConversation(newConv.id);
  }

  if (!profile) return null;

  if (selectedId) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8">
        <div className="flex items-center gap-3">
          <button onClick={retourListe} className="text-sm text-muted-foreground hover:underline">
            &larr; Conversations
          </button>
          <h1 className="text-sm font-medium text-foreground">
            {selectedParticipants.length > 0 ? selectedParticipants.join(", ") : "Conversation"}
          </h1>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-border p-4">
          {loadingMessages ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-faint-foreground">Aucun message pour l&apos;instant.</p>
          ) : (
            messages.map((m) => {
              const isMine = m.auteur_id === profile.id;
              return (
                <div key={m.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                      isMine ? "bg-accent text-accent-foreground" : "bg-border/30 text-foreground"
                    }`}
                  >
                    {!isMine && (
                      <p className="mb-0.5 text-xs font-medium text-muted-foreground">{m.auteur_nom}</p>
                    )}
                    <p className="whitespace-pre-wrap">{m.contenu}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-faint-foreground">{formatDateTime(m.created_at)}</p>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            value={nouveauMessage}
            onChange={(e) => setNouveauMessage(e.target.value)}
            placeholder="Écrire un message..."
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={sending || !nouveauMessage.trim()}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            Envoyer
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium text-foreground">Messagerie</h1>
        <button
          onClick={() => setCreating((c) => !c)}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
        >
          + Nouvelle conversation
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {creating && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-foreground">Choisir un ou plusieurs collègues</p>
          {collegues.length === 0 ? (
            <p className="text-sm text-faint-foreground">Aucun collègue pour l&apos;instant.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {collegues.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={collegueIds.includes(c.id)}
                    onChange={() => toggleCollegue(c.id)}
                  />
                  {c.nom}
                </label>
              ))}
            </div>
          )}
          <button
            onClick={handleCreateConversation}
            disabled={collegueIds.length === 0 || creatingConversation}
            className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            {creatingConversation ? "Création..." : "Démarrer la conversation"}
          </button>
        </div>
      )}

      {loadingList ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : conversations.length === 0 ? (
        <p className="text-sm text-faint-foreground">Aucune conversation pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => ouvrirConversation(c.id)}
                className="flex w-full flex-col items-start gap-0.5 py-3 text-left hover:bg-border/40"
              >
                <div className="flex w-full items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {c.participantNoms.length > 0 ? c.participantNoms.join(", ") : "Conversation"}
                  </p>
                  {c.dernierMessageAt && (
                    <p className="text-xs text-faint-foreground">{formatDateTime(c.dernierMessageAt)}</p>
                  )}
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {c.dernierMessage ?? "Aucun message pour l'instant."}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
