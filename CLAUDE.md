# Marguerite — Contexte projet

## Ce qu'est le projet

Marguerite est une application de gestion pensée pour les petites structures multi-boutiques (2 à 4 magasins, retail de centre-ville). Positionnement : simple et abordable, face à des concurrents comme Skello ou Combo qui visent des structures bien plus grandes.

## Stratégie de développement (important, ne pas dévier sans en discuter)

- On construit une V1 volontairement restreinte à un seul onglet : le Planning, mais dans sa version complète (voir plus bas), sans contrainte de temps.
- Cette V1 est utilisée en conditions réelles dans la boutique où le porteur de projet travaille comme manager (une seule structure activée pour l'instant).
- Principe d'architecture : le modèle de données et le code sont écrits comme pour un vrai produit multi-clients dès le départ (jamais rien codé en dur pour une boutique en particulier), même si une seule structure existe en base actuellement. Voir docs/marguerite-schema-v1.sql.
- Principe de navigation : l'application garde la structure complète à onglets dès le départ (menu avec toutes les fonctionnalités listées ci-dessous), même si un seul onglet est fonctionnel. Les autres onglets affichent "Bientôt disponible" plutôt que d'être absents.

## Les 11 fonctionnalités prévues à terme (1 seule active en V1)

Planning (V1 actif), Tâches du jour, Congés, Documents, Indicateurs commerciaux, Notes de frais, Factures fournisseurs, Annonces, Onboarding, Rappels et échéances, Messagerie.

## Les 3 rôles prévus à terme

- Vendeur : consulte son propre planning
- Manager : édite le planning de sa boutique (rôle du porteur de projet dans la vraie vie)
- Gérant : vue transversale multi-boutiques (pas encore utilisé en V1, une seule boutique existe)

## Le module Planning en détail (V1)

1. Profil salarié : contrat, heures hebdo, jours de repos fixes, disponibilités/préférences. Les règles légales de repos (11h quotidien, 24h hebdomadaire) doivent être respectées automatiquement, jamais laissées à la saisie manuelle.
2. Planning manuel : vue jour/semaine, un créneau par salarié avec une couleur qui lui est propre, ajout/édition de créneaux, signalement visuel des trous de couverture.
3. Planning assisté par IA : génération automatique à partir des profils salariés et des besoins de couverture de la boutique, dans le respect des règles légales.
4. Ajustement conversationnel : le manager peut corriger le planning généré en langage naturel (ex. "Pierre n'est pas dispo jeudi"), l'IA traduit la demande en contrainte structurée puis l'algorithme recalcule.
5. Vue salarié en lecture seule : chaque membre de l'équipe consulte sa propre semaine, sans droit d'édition.

## Stack technique

- Next.js (React + TypeScript), App Router
- Supabase (Postgres + Auth + Storage)
- Tailwind CSS
- Hébergement : Vercel (front) + Supabase Cloud (données)

## Identité visuelle

- Nom : Marguerite
- Palette épurée noir/blanc façon Apple, touches de couleur discrètes (vert olive #6B8F5E et jaune doré #E8B84B, repris du logo)
- Mode clair et mode sombre prévus
- Logo : une marguerite à six pétales blancs à contour vert olive, cœur jaune doré

## Conventions de nommage

Le projet et son code utilisent des noms de tables et de champs en français (ex. utilisateurs, boutiques, creneaux, heures_hebdo) — voir docs/marguerite-schema-v1.sql pour le schéma complet et exact à respecter.

## Documents de référence dans ce projet

- docs/marguerite-schema-v1.sql — schéma complet de la base de données
- docs/cahier-des-charges.md — spécification complète du produit (toutes les fonctionnalités, y compris celles pas encore construites)
