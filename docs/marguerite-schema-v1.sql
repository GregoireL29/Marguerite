-- Marguerite — Schéma V1 (module Planning)
create extension if not exists "uuid-ossp";

create table structures (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  created_at timestamptz not null default now()
);

-- horaires : objet jsonb avec une clé par jour ("lun".."dim"), chacune
-- contenant une liste de créneaux { "debut": "HH:MM", "fin": "HH:MM" }.
-- Liste vide = fermé ce jour-là. Plusieurs créneaux = fermeture le midi.
-- Exemple : {"lun": [{"debut":"09:00","fin":"12:30"},{"debut":"14:00","fin":"19:00"}], "dim": []}
create table boutiques (
  id uuid primary key default uuid_generate_v4(),
  structure_id uuid not null references structures(id) on delete cascade,
  nom text not null,
  adresse text,
  horaires jsonb not null default '{"lun":[],"mar":[],"mer":[],"jeu":[],"ven":[],"sam":[],"dim":[]}',
  -- Effectif minimum requis : effectif_min_ouverture pour la première
  -- heure de chaque créneau d'ouverture, effectif_min_fermeture pour la
  -- dernière heure, effectif_min_journee pour le reste de la plage.
  effectif_min_ouverture integer not null default 1,
  effectif_min_fermeture integer not null default 1,
  effectif_min_journee integer not null default 1,
  created_at timestamptz not null default now()
);

create type role_utilisateur as enum ('gerant', 'manager', 'salarie');

create table utilisateurs (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid unique,
  structure_id uuid not null references structures(id) on delete cascade,
  boutique_id uuid references boutiques(id) on delete set null,
  nom text not null,
  email text unique not null,
  role role_utilisateur not null default 'salarie',
  couleur text not null default '#6B8F5E',
  created_at timestamptz not null default now()
);

create table profils_salarie (
  id uuid primary key default uuid_generate_v4(),
  utilisateur_id uuid not null references utilisateurs(id) on delete cascade,
  type_contrat text not null default 'cdi_temps_plein',
  heures_hebdo numeric(4,1) not null default 35,
  jours_repos_fixes jsonb not null default '[]',
  disponibilites jsonb not null default '[]',
  -- Solde de congés en jours, optionnel : si non renseigné, l'écran
  -- salarié n'affiche pas de solde restant.
  solde_conges_jours integer,
  updated_at timestamptz not null default now()
);

create type statut_planning as enum ('brouillon', 'genere_ia', 'publie');

create table plannings (
  id uuid primary key default uuid_generate_v4(),
  boutique_id uuid not null references boutiques(id) on delete cascade,
  semaine_debut date not null,
  statut statut_planning not null default 'brouillon',
  created_at timestamptz not null default now(),
  unique (boutique_id, semaine_debut)
);

create table creneaux (
  id uuid primary key default uuid_generate_v4(),
  planning_id uuid not null references plannings(id) on delete cascade,
  utilisateur_id uuid not null references utilisateurs(id) on delete cascade,
  jour date not null,
  heure_debut time not null,
  heure_fin time not null,
  created_at timestamptz not null default now()
);

create index idx_creneaux_planning on creneaux(planning_id);
create index idx_creneaux_utilisateur on creneaux(utilisateur_id);
create index idx_utilisateurs_structure on utilisateurs(structure_id);
create index idx_boutiques_structure on boutiques(structure_id);

create type statut_demande_conges as enum ('en_attente', 'validee', 'refusee');

create table demandes_conges (
  id uuid primary key default uuid_generate_v4(),
  utilisateur_id uuid not null references utilisateurs(id) on delete cascade,
  date_debut date not null,
  date_fin date not null,
  message text,
  statut statut_demande_conges not null default 'en_attente',
  created_at timestamptz not null default now()
);

create index idx_demandes_conges_utilisateur on demandes_conges(utilisateur_id);

create type categorie_tache as enum ('ouverture', 'journee', 'fermeture');
create type statut_tache as enum ('a_faire', 'faite', 'reportee');

create table taches (
  id uuid primary key default uuid_generate_v4(),
  boutique_id uuid not null references boutiques(id) on delete cascade,
  titre text not null,
  categorie categorie_tache not null,
  assigne_a uuid references utilisateurs(id) on delete set null,
  date date not null,
  statut statut_tache not null default 'a_faire',
  created_at timestamptz not null default now()
);

create index idx_taches_boutique_date on taches(boutique_id, date);
create index idx_taches_assigne_a on taches(assigne_a);

create table ventes_quotidiennes (
  id uuid primary key default uuid_generate_v4(),
  boutique_id uuid not null references boutiques(id) on delete cascade,
  date date not null,
  chiffre_affaires numeric(10,2) not null,
  frequentation integer not null,
  created_at timestamptz not null default now(),
  unique (boutique_id, date)
);

create index idx_ventes_quotidiennes_boutique_date on ventes_quotidiennes(boutique_id, date);

create type periode_objectif as enum ('semaine', 'mois', 'annee');

create table objectifs (
  id uuid primary key default uuid_generate_v4(),
  boutique_id uuid not null references boutiques(id) on delete cascade,
  periode periode_objectif not null,
  date_debut date not null,
  ca_cible numeric(10,2) not null,
  panier_moyen_cible numeric(10,2) not null,
  created_at timestamptz not null default now(),
  unique (boutique_id, periode, date_debut)
);

create index idx_objectifs_boutique on objectifs(boutique_id);

create type type_document as enum ('contrat', 'avenant', 'justificatif');

-- fichier_url stocke le chemin de l'objet dans le bucket de stockage
-- "documents" (bucket privé), pas une URL publique : le téléchargement se
-- fait via une URL signée générée à la demande.
create table documents (
  id uuid primary key default uuid_generate_v4(),
  utilisateur_id uuid not null references utilisateurs(id) on delete cascade,
  boutique_id uuid not null references boutiques(id) on delete cascade,
  nom text not null,
  type type_document not null,
  uploaded_by uuid references utilisateurs(id) on delete set null,
  fichier_url text not null,
  created_at timestamptz not null default now()
);

create index idx_documents_utilisateur on documents(utilisateur_id);
create index idx_documents_boutique on documents(boutique_id);

create type statut_note_frais as enum ('en_attente', 'validee', 'refusee', 'remboursee');

-- ticket_url stocke le chemin de l'objet dans le bucket "documents"
-- (réutilisé, même logique d'URL signée que pour les documents RH).
create table notes_frais (
  id uuid primary key default uuid_generate_v4(),
  utilisateur_id uuid not null references utilisateurs(id) on delete cascade,
  boutique_id uuid not null references boutiques(id) on delete cascade,
  montant numeric(10,2) not null,
  categorie text not null,
  descriptif text not null,
  ticket_url text not null,
  statut statut_note_frais not null default 'en_attente',
  created_at timestamptz not null default now()
);

create index idx_notes_frais_utilisateur on notes_frais(utilisateur_id);
create index idx_notes_frais_boutique_statut on notes_frais(boutique_id, statut);

create table fournisseurs (
  id uuid primary key default uuid_generate_v4(),
  boutique_id uuid not null references boutiques(id) on delete cascade,
  nom text not null,
  siren text,
  adresse text,
  contact_commercial text,
  created_at timestamptz not null default now()
);

create index idx_fournisseurs_boutique on fournisseurs(boutique_id);

-- fichier_url stocke le chemin de l'objet dans le bucket "documents"
-- (réutilisé, même logique d'URL signée que pour les autres onglets).
create table factures_fournisseurs (
  id uuid primary key default uuid_generate_v4(),
  fournisseur_id uuid not null references fournisseurs(id) on delete cascade,
  boutique_id uuid not null references boutiques(id) on delete cascade,
  descriptif text not null,
  montant_ht numeric(10,2) not null,
  taux_tva numeric(5,2) not null,
  categorie text not null,
  fichier_url text not null,
  date_facture date not null,
  created_at timestamptz not null default now()
);

create index idx_factures_fournisseurs_fournisseur on factures_fournisseurs(fournisseur_id);
create index idx_factures_fournisseurs_boutique_date on factures_fournisseurs(boutique_id, date_facture);

create type cible_annonce as enum ('tous', 'managers_uniquement');

create table annonces (
  id uuid primary key default uuid_generate_v4(),
  boutique_id uuid not null references boutiques(id) on delete cascade,
  auteur_id uuid not null references utilisateurs(id) on delete cascade,
  titre text not null,
  message text not null,
  cible_role cible_annonce not null default 'tous',
  created_at timestamptz not null default now()
);

create index idx_annonces_boutique on annonces(boutique_id);

create table annonces_lectures (
  id uuid primary key default uuid_generate_v4(),
  annonce_id uuid not null references annonces(id) on delete cascade,
  utilisateur_id uuid not null references utilisateurs(id) on delete cascade,
  lu_at timestamptz not null default now(),
  unique (annonce_id, utilisateur_id)
);

create index idx_annonces_lectures_annonce on annonces_lectures(annonce_id);
create index idx_annonces_lectures_utilisateur on annonces_lectures(utilisateur_id);

-- support_url stocke le chemin de l'objet dans le bucket "documents"
-- (réutilisé), nullable tant qu'aucun support n'a été déposé.
create table modules_formation (
  id uuid primary key default uuid_generate_v4(),
  boutique_id uuid not null references boutiques(id) on delete cascade,
  titre text not null,
  ordre integer not null,
  support_url text,
  created_at timestamptz not null default now()
);

create index idx_modules_formation_boutique on modules_formation(boutique_id);

-- options : tableau jsonb de chaînes (les choix proposés).
-- reponse_correcte : index (0-based) du bon choix dans "options".
create table questions_qcm (
  id uuid primary key default uuid_generate_v4(),
  module_id uuid not null references modules_formation(id) on delete cascade,
  question text not null,
  options jsonb not null,
  reponse_correcte integer not null,
  ordre integer not null
);

create index idx_questions_qcm_module on questions_qcm(module_id);

create type statut_progression_formation as enum ('verrouille', 'en_cours', 'complete');

-- Table volontairement creuse : une ligne n'existe que pour un module
-- qu'un salarié a démarré ou terminé. L'absence de ligne pour un module
-- signifie "verrouillé" (jamais atteint).
create table progression_formation (
  id uuid primary key default uuid_generate_v4(),
  utilisateur_id uuid not null references utilisateurs(id) on delete cascade,
  module_id uuid not null references modules_formation(id) on delete cascade,
  statut statut_progression_formation not null default 'verrouille',
  score integer,
  completed_at timestamptz,
  unique (utilisateur_id, module_id)
);

create index idx_progression_formation_utilisateur on progression_formation(utilisateur_id);
create index idx_progression_formation_module on progression_formation(module_id);

create type delai_rappel_echeance as enum ('jour_meme', '1_semaine', '1_mois', 'personnalise');
create type statut_echeance as enum ('a_venir', 'en_retard', 'faite');

-- responsable_id nullable : en V1 une échéance n'est assignable qu'à
-- personne ou au manager lui-même (pas de rôle gérant actif). La colonne
-- reste une référence utilisateurs générique pour permettre l'assignation
-- croisée manager/gérant en V2 sans migration supplémentaire.
create table echeances (
  id uuid primary key default uuid_generate_v4(),
  boutique_id uuid not null references boutiques(id) on delete cascade,
  titre text not null,
  date_echeance date not null,
  responsable_id uuid references utilisateurs(id) on delete set null,
  delai_rappel delai_rappel_echeance not null default 'jour_meme',
  delai_personnalise_jours integer,
  statut statut_echeance not null default 'a_venir',
  created_at timestamptz not null default now()
);

create index idx_echeances_boutique on echeances(boutique_id);

create table conversations (
  id uuid primary key default uuid_generate_v4(),
  boutique_id uuid not null references boutiques(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_conversations_boutique on conversations(boutique_id);

create table conversations_participants (
  conversation_id uuid not null references conversations(id) on delete cascade,
  utilisateur_id uuid not null references utilisateurs(id) on delete cascade,
  primary key (conversation_id, utilisateur_id)
);

create index idx_conversations_participants_utilisateur on conversations_participants(utilisateur_id);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  auteur_id uuid not null references utilisateurs(id) on delete cascade,
  contenu text not null,
  created_at timestamptz not null default now()
);

create index idx_messages_conversation on messages(conversation_id, created_at);

-- Table volontairement creuse : une ligne par widget épinglé (pas par
-- widget disponible). Si un utilisateur n'a aucune ligne, l'écran
-- d'accueil affiche un jeu de widgets pré-épinglés par défaut.
create table widgets_epingles (
  id uuid primary key default uuid_generate_v4(),
  utilisateur_id uuid not null references utilisateurs(id) on delete cascade,
  widget_key text not null,
  ordre integer not null,
  created_at timestamptz not null default now(),
  unique (utilisateur_id, widget_key)
);

create index idx_widgets_epingles_utilisateur on widgets_epingles(utilisateur_id);

-- Row Level Security
-- V2 : isolation par structure/boutique. Un manager/salarié n'accède qu'à
-- sa propre boutique ; un gérant (rôle prévu, pas encore utilisé) accède à
-- toutes les boutiques de sa structure. Pas encore de distinction de droits
-- en écriture entre manager et salarié au sein d'une même boutique — ce
-- sera affiné quand les rôles seront réellement différenciés en usage.
alter table structures enable row level security;
alter table boutiques enable row level security;
alter table utilisateurs enable row level security;
alter table profils_salarie enable row level security;
alter table plannings enable row level security;
alter table creneaux enable row level security;
alter table demandes_conges enable row level security;
alter table taches enable row level security;
alter table ventes_quotidiennes enable row level security;
alter table objectifs enable row level security;
alter table documents enable row level security;
alter table notes_frais enable row level security;
alter table fournisseurs enable row level security;
alter table factures_fournisseurs enable row level security;
alter table annonces enable row level security;
alter table annonces_lectures enable row level security;
alter table modules_formation enable row level security;
alter table questions_qcm enable row level security;
alter table progression_formation enable row level security;
alter table echeances enable row level security;
alter table conversations enable row level security;
alter table conversations_participants enable row level security;
alter table messages enable row level security;
alter table widgets_epingles enable row level security;

-- Fonctions d'accès partagées (security definer : bypass RLS en interne
-- pour éviter toute récursion avec les policies qui les appellent).

create or replace function user_has_access_to_boutique(target_boutique_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from utilisateurs u
    where u.auth_id = auth.uid()
      and (
        u.boutique_id = target_boutique_id
        or (
          u.role = 'gerant'
          and exists (
            select 1 from boutiques b
            where b.id = target_boutique_id and b.structure_id = u.structure_id
          )
        )
      )
  );
$$;
revoke all on function user_has_access_to_boutique(uuid) from public;
grant execute on function user_has_access_to_boutique(uuid) to authenticated;

create or replace function user_is_conversation_participant(target_conversation_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from conversations_participants cp
    join utilisateurs u on u.id = cp.utilisateur_id
    where cp.conversation_id = target_conversation_id and u.auth_id = auth.uid()
  );
$$;
revoke all on function user_is_conversation_participant(uuid) from public;
grant execute on function user_is_conversation_participant(uuid) to authenticated;

create or replace function user_belongs_to_structure(target_structure_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from utilisateurs u
    where u.auth_id = auth.uid() and u.structure_id = target_structure_id
  );
$$;
revoke all on function user_belongs_to_structure(uuid) from public;
grant execute on function user_belongs_to_structure(uuid) to authenticated;

create or replace function current_utilisateur_id()
returns uuid
language sql security definer set search_path = public stable
as $$
  select id from utilisateurs where auth_id = auth.uid();
$$;
revoke all on function current_utilisateur_id() from public;
grant execute on function current_utilisateur_id() to authenticated;

-- Racines : structures, boutiques, utilisateurs.
-- Créer une structure/boutique est ouvert à tout authentifié (bootstrap de
-- l'onboarding self-service : personne n'appartient encore à la structure
-- au moment de sa création). Lecture/modification/suppression restreintes
-- à l'appartenance. utilisateurs gère aussi le cas transitoire d'une ligne
-- créée par un manager sans boutique_id/auth_id encore rattachés (ajout
-- d'un salarié depuis Équipe, liaison différée).

create policy "structures_lecture" on structures
  for select to authenticated using (user_belongs_to_structure(structures.id));
create policy "structures_creation" on structures
  for insert to authenticated with check (true);
create policy "structures_modification" on structures
  for update to authenticated
  using (user_belongs_to_structure(structures.id))
  with check (user_belongs_to_structure(structures.id));
create policy "structures_suppression" on structures
  for delete to authenticated using (user_belongs_to_structure(structures.id));

create policy "boutiques_lecture" on boutiques
  for select to authenticated using (user_has_access_to_boutique(boutiques.id));
create policy "boutiques_creation" on boutiques
  for insert to authenticated with check (true);
create policy "boutiques_modification" on boutiques
  for update to authenticated
  using (user_has_access_to_boutique(boutiques.id))
  with check (user_has_access_to_boutique(boutiques.id));
create policy "boutiques_suppression" on boutiques
  for delete to authenticated using (user_has_access_to_boutique(boutiques.id));

create policy "acces_utilisateurs" on utilisateurs
  for all to authenticated
  using (
    auth_id = auth.uid()
    or user_has_access_to_boutique(boutique_id)
    or (boutique_id is null and user_belongs_to_structure(structure_id))
  )
  with check (
    auth_id = auth.uid()
    or user_has_access_to_boutique(boutique_id)
    or (boutique_id is null and user_belongs_to_structure(structure_id))
  );

-- Scoping direct (boutique_id sur la table elle-même).

create policy "acces_par_boutique" on plannings for all to authenticated
  using (user_has_access_to_boutique(boutique_id)) with check (user_has_access_to_boutique(boutique_id));

create policy "acces_par_boutique" on taches for all to authenticated
  using (user_has_access_to_boutique(boutique_id)) with check (user_has_access_to_boutique(boutique_id));

create policy "acces_par_boutique" on ventes_quotidiennes for all to authenticated
  using (user_has_access_to_boutique(boutique_id)) with check (user_has_access_to_boutique(boutique_id));

create policy "acces_par_boutique" on objectifs for all to authenticated
  using (user_has_access_to_boutique(boutique_id)) with check (user_has_access_to_boutique(boutique_id));

create policy "acces_par_boutique" on documents for all to authenticated
  using (user_has_access_to_boutique(boutique_id)) with check (user_has_access_to_boutique(boutique_id));

create policy "acces_par_boutique" on notes_frais for all to authenticated
  using (user_has_access_to_boutique(boutique_id)) with check (user_has_access_to_boutique(boutique_id));

create policy "acces_par_boutique" on fournisseurs for all to authenticated
  using (user_has_access_to_boutique(boutique_id)) with check (user_has_access_to_boutique(boutique_id));

create policy "acces_par_boutique" on factures_fournisseurs for all to authenticated
  using (user_has_access_to_boutique(boutique_id)) with check (user_has_access_to_boutique(boutique_id));

create policy "acces_par_boutique" on modules_formation for all to authenticated
  using (user_has_access_to_boutique(boutique_id)) with check (user_has_access_to_boutique(boutique_id));

create policy "acces_par_boutique" on echeances for all to authenticated
  using (user_has_access_to_boutique(boutique_id)) with check (user_has_access_to_boutique(boutique_id));

-- annonces : condition dupliquée ici (pas de sous-requête) car directement
-- scopée boutique, comme les tables ci-dessus.
create policy "acces_par_boutique" on annonces for all to authenticated
  using (user_has_access_to_boutique(boutique_id)) with check (user_has_access_to_boutique(boutique_id));

-- conversations reste sciemment scopée boutique (pas participant) : upgrader
-- vers user_is_conversation_participant casse l'insert().select() utilisé à
-- la création (RETURNING exige que la policy SELECT passe, hors personne
-- n'est encore participant à cet instant). Conséquence acceptée : l'id, la
-- boutique_id et la date de création d'une conversation sont visibles par
-- toute la boutique — jamais son contenu ni la liste de ses participants,
-- verrouillés séparément par messages/conversations_participants ci-dessous.
create policy "acces_par_boutique" on conversations for all to authenticated
  using (user_has_access_to_boutique(boutique_id)) with check (user_has_access_to_boutique(boutique_id));

-- Scoping indirect générique (via une table parente).

create policy "acces_par_boutique" on creneaux for all to authenticated
  using (exists (select 1 from plannings p where p.id = creneaux.planning_id and user_has_access_to_boutique(p.boutique_id)))
  with check (exists (select 1 from plannings p where p.id = creneaux.planning_id and user_has_access_to_boutique(p.boutique_id)));

create policy "acces_par_boutique" on profils_salarie for all to authenticated
  using (exists (select 1 from utilisateurs u where u.id = profils_salarie.utilisateur_id and user_has_access_to_boutique(u.boutique_id)))
  with check (exists (select 1 from utilisateurs u where u.id = profils_salarie.utilisateur_id and user_has_access_to_boutique(u.boutique_id)));

create policy "acces_par_boutique" on demandes_conges for all to authenticated
  using (exists (select 1 from utilisateurs u where u.id = demandes_conges.utilisateur_id and user_has_access_to_boutique(u.boutique_id)))
  with check (exists (select 1 from utilisateurs u where u.id = demandes_conges.utilisateur_id and user_has_access_to_boutique(u.boutique_id)));

create policy "acces_par_boutique" on annonces_lectures for all to authenticated
  using (exists (select 1 from annonces a where a.id = annonces_lectures.annonce_id and user_has_access_to_boutique(a.boutique_id)))
  with check (exists (select 1 from annonces a where a.id = annonces_lectures.annonce_id and user_has_access_to_boutique(a.boutique_id)));

create policy "acces_par_boutique" on questions_qcm for all to authenticated
  using (exists (select 1 from modules_formation m where m.id = questions_qcm.module_id and user_has_access_to_boutique(m.boutique_id)))
  with check (exists (select 1 from modules_formation m where m.id = questions_qcm.module_id and user_has_access_to_boutique(m.boutique_id)));

create policy "acces_par_boutique" on progression_formation for all to authenticated
  using (exists (select 1 from modules_formation m where m.id = progression_formation.module_id and user_has_access_to_boutique(m.boutique_id)))
  with check (exists (select 1 from modules_formation m where m.id = progression_formation.module_id and user_has_access_to_boutique(m.boutique_id)));

-- Messagerie : scoping par participation (pas juste par boutique).

create policy "participants_lecture" on conversations_participants
  for select to authenticated using (user_is_conversation_participant(conversation_id));
create policy "participants_ajout" on conversations_participants
  for insert to authenticated
  with check (exists (select 1 from conversations c where c.id = conversations_participants.conversation_id and user_has_access_to_boutique(c.boutique_id)));
create policy "participants_suppression" on conversations_participants
  for delete to authenticated using (user_is_conversation_participant(conversation_id));

create policy "messages_participants" on messages
  for all to authenticated
  using (user_is_conversation_participant(conversation_id))
  with check (user_is_conversation_participant(conversation_id) and auteur_id = current_utilisateur_id());

-- Scoping personnel (pas boutique : uniquement ses propres lignes).

create policy "acces_widgets_personnels" on widgets_epingles
  for all to authenticated
  using (utilisateur_id = current_utilisateur_id())
  with check (utilisateur_id = current_utilisateur_id());

-- Stockage : bucket privé dédié aux documents (contrats, avenants,
-- justificatifs, tickets de notes de frais, factures fournisseurs...).
-- Le téléchargement passe par des URL signées générées côté client. Tous
-- les chemins commencent par boutique_id/... par convention, ce qui permet
-- de réutiliser directement user_has_access_to_boutique.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents_acces_par_boutique" on storage.objects
  for all to authenticated
  using (bucket_id = 'documents' and user_has_access_to_boutique((storage.foldername(name))[1]::uuid))
  with check (bucket_id = 'documents' and user_has_access_to_boutique((storage.foldername(name))[1]::uuid));

-- Invitation des salariés : le manager crée la ligne utilisateurs à
-- l'avance (sans auth_id) via "Gérer l'équipe", puis génère un lien à
-- usage unique qui permet au salarié de créer son propre compte Supabase
-- Auth et de se relier à cette ligne existante, sans passer par l'écran
-- "créer une nouvelle structure".

alter table utilisateurs
  add column invite_token uuid unique,
  add column invite_expires_at timestamptz;

-- Détails publics d'une invitation (accessible sans authentification, pour
-- affichage avant inscription). Ne renvoie rien si le token est
-- invalide, expiré, ou déjà utilisé (auth_id déjà renseigné) : on ne
-- fuite jamais l'ensemble des invitations en attente, seulement celle
-- correspondant exactement au token fourni.
create or replace function get_invite_details(p_token uuid)
returns table(nom text, email text, structure_nom text, boutique_nom text)
language sql
security definer
set search_path = public
stable
as $$
  select u.nom, u.email, s.nom, b.nom
  from utilisateurs u
  join structures s on s.id = u.structure_id
  left join boutiques b on b.id = u.boutique_id
  where u.invite_token = p_token
    and u.invite_expires_at > now()
    and u.auth_id is null;
$$;

revoke all on function get_invite_details(uuid) from public;
grant execute on function get_invite_details(uuid) to anon, authenticated;

-- Relie le compte actuellement authentifié (auth.uid()) à la ligne
-- utilisateurs correspondant au token, si celui-ci est valide, non expiré
-- et pas déjà utilisé. La contrainte unique sur auth_id empêche par
-- construction qu'un compte déjà relié à un autre profil ne s'approprie
-- une seconde ligne. Échoue (exception) plutôt que de renvoyer une ligne
-- partielle en cas de token invalide/expiré/déjà utilisé.
create or replace function claim_invite(p_token uuid)
returns table(structure_id uuid, boutique_id uuid, role role_utilisateur)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_structure_id uuid;
  v_boutique_id uuid;
  v_role role_utilisateur;
begin
  select u.id, u.structure_id, u.boutique_id, u.role
    into v_id, v_structure_id, v_boutique_id, v_role
  from utilisateurs u
  where u.invite_token = p_token
    and u.invite_expires_at > now()
    and u.auth_id is null
  limit 1;

  if v_id is null then
    raise exception 'invitation_invalide';
  end if;

  update utilisateurs
    set auth_id = auth.uid(),
        invite_token = null,
        invite_expires_at = null
    where id = v_id;

  return query select v_structure_id, v_boutique_id, v_role;
end;
$$;

revoke all on function claim_invite(uuid) from public;
grant execute on function claim_invite(uuid) to authenticated;
