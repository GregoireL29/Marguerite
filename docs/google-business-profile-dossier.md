# Dossier de justification — Demande d'accès à l'API Google Business Profile

*Document préparé pour appuyer la soumission du formulaire officiel Google. Les passages entre crochets `[...]` doivent être complétés par vous avant l'envoi — ce sont des informations liées à votre compte Google Business réel, auquel Claude Code n'a pas accès.*

Ce texte est rédigé pour être collé (en tout ou partie) dans le champ de description du formulaire de demande d'accès, ou envoyé en pièce jointe si le formulaire le permet.

---

## Présentation du demandeur et de l'outil

[NOM DE LA STRUCTURE] gère [NOMBRE DE BOUTIQUES] boutique(s) de retail de centre-ville. Pour piloter son activité au quotidien (planning d'équipe, indicateurs commerciaux, factures fournisseurs, communication interne), la structure utilise **Marguerite**, une application de gestion développée en interne, actuellement en usage réel dans notre propre boutique pilote, avec pour vocation d'être ensuite proposée à d'autres petites structures multi-boutiques comparables (2 à 4 magasins).

Marguerite n'est pas un outil isolé dédié aux avis Google : c'est une application de gestion complète (planning, tâches, congés, indicateurs commerciaux, notes de frais, factures fournisseurs, annonces internes, échéances administratives, messagerie d'équipe), dans laquelle le suivi des avis clients Google constitue un module parmi d'autres, au même titre que les autres flux d'information déjà gérés par l'outil.

## Cas d'usage

**Objectif** : permettre à chaque boutique connectée de recevoir, au sein de Marguerite, une notification lorsqu'un nouvel avis client est publié sur sa fiche Google Business Profile, afin que le manager de la boutique concernée puisse en prendre connaissance rapidement et y répondre dans de bons délais.

**Pourquoi ce besoin** : dans une petite structure multi-boutiques, personne n'a pour mission dédiée de surveiller les avis Google de chaque boutique. Un nouvel avis (positif ou négatif) passe facilement inaperçu plusieurs jours, ce qui retarde la réponse du commerçant et nuit à la relation client. Centraliser cette alerte dans l'outil de gestion quotidien déjà utilisé par l'équipe (plutôt que de demander à chaque manager de consulter une application Google séparément) résout ce problème simplement.

**Fonctionnement prévu** :
1. Chaque boutique connecte sa propre fiche Google Business Profile à Marguerite via OAuth 2.0 (consentement explicite donné par le titulaire/gestionnaire de la fiche, boutique par boutique).
2. Marguerite consulte en lecture seule les nouveaux avis reçus sur la fiche connectée.
3. Une notification apparaît dans l'application, visible uniquement par les membres de l'équipe de la boutique concernée (le modèle de permissions de Marguerite restreint déjà l'accès aux données par boutique).
4. Marguerite ne publie rien, ne répond à aucun avis et ne modifie aucune information de la fiche : l'usage est strictement en lecture, pour la seule finalité de notification.

**Portée actuelle et évolution** : à ce stade, une seule structure (la nôtre) utilise Marguerite en conditions réelles — c'est la phase pilote du projet. L'intégration Google Business Profile est développée pour ce même usage interne dans un premier temps, avec l'intention, si elle fonctionne bien, de l'étendre aux autres structures qui utiliseront Marguerite par la suite, chacune connectant ses propres fiches Google Business Profile avec son propre consentement OAuth.

## Portée technique de l'accès demandé

- **API concernée** : Google My Business API (ressource `reviews`, lecture seule) pour la récupération des avis ; éventuellement My Business Notifications API si la notification en quasi temps réel (Pub/Sub) est mise en place plutôt qu'une vérification périodique.
- **Scope OAuth** : `https://www.googleapis.com/auth/business.manage` (aucun scope plus large n'est nécessaire — nous ne demandons pas d'accès à la gestion de fiche, aux posts, aux Q&A ou aux informations d'établissement).
- **Fréquence d'appel** : usage faible volume, quelques boutiques connectées, vérification périodique (pas de temps réel critique) — bien en dessous des quotas standards.
- **Données consultées** : contenu des avis (note, texte, date, nom de l'auteur tel qu'affiché publiquement par Google) — aucune donnée personnelle supplémentaire n'est collectée.
- **Stockage et confidentialité** : les jetons d'authentification OAuth sont stockés de façon chiffrée côté serveur (base Supabase/Postgres avec sécurité au niveau ligne), jamais exposés côté client ni à un tiers. Les avis eux-mêmes ne sont pas dupliqués au-delà de ce qui est nécessaire à l'affichage de la notification. Aucune donnée n'est revendue, partagée avec un tiers ou utilisée à des fins publicitaires.
- **Accès révocable** : chaque boutique peut déconnecter sa fiche Google Business Profile à tout moment depuis Marguerite, ce qui révoque l'accès.

## Informations à renseigner par vous dans le formulaire

- Nom de l'entreprise : [NOM DE LA STRUCTURE]
- Site web de l'entreprise (celui associé à votre fiche Google Business Profile) : [URL DU SITE]
- Adresse email utilisée pour la demande (doit être listée comme propriétaire/gestionnaire de la fiche Google Business Profile) : [EMAIL]
- Numéro du projet Google Cloud : [NUMÉRO DE PROJET]
- Lien vers la fiche Google Business Profile gérée (celle utilisée pour justifier la demande) : [LIEN DE LA FICHE]
