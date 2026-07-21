# Marche à suivre — Demande d'accès à l'API Google Business Profile

Ce guide couvre uniquement les étapes de **demande d'accès**, à effectuer par vous depuis votre propre compte Google (celui gestionnaire/propriétaire de la fiche Google Business Profile de la boutique). Claude Code n'a pas accès à ce compte et ne peut pas soumettre cette demande à votre place — voir la note en fin de document sur la suite une fois l'accès obtenu.

Sources officielles utilisées pour ce guide : [Prerequisites — Google Business Profile APIs](https://developers.google.com/my-business/content/prereqs), [Basic setup](https://developers.google.com/my-business/content/basic-setup), [FAQ](https://developers.google.com/my-business/content/faq).

## 0. Vérifier les prérequis avant de commencer

Google impose des conditions strictes, vérifiées avant même d'examiner la demande :

- **La fiche Google Business Profile de la boutique doit être vérifiée et active depuis 60 jours ou plus.** Si la fiche a été créée récemment, il faut attendre ce délai avant de soumettre la demande — inutile de la soumettre plus tôt, elle sera rejetée.
- **Le compte Google Cloud doit avoir un site web renseigné sur la fiche Business Profile** (le site web de la boutique/structure, pas nécessairement Marguerite).
- **L'adresse email utilisée pour la demande doit être listée comme propriétaire ou gestionnaire de la fiche** dans Google Business Profile.
- ⚠️ **Point de vigilance identifié dans la documentation** : une cause fréquente de refus est un domaine d'adresse email qui ne correspond pas au domaine du site web déclaré. Si votre adresse de contact est une adresse générique (Gmail, iCloud...) plutôt qu'une adresse `@votredomaine.fr`, cela peut jouer en votre défaveur. À anticiper avant la soumission plutôt qu'à découvrir après un refus.

## 1. Créer (ou choisir) un projet Google Cloud

1. Aller sur la [Google Cloud Console](https://console.cloud.google.com/), connecté avec le compte Google qui gère la fiche Business Profile de la boutique.
2. Créer un nouveau projet (ou réutiliser un projet existant dédié à Marguerite) — nom suggéré : `Marguerite - [Nom de la structure]`.
3. Sur le tableau de bord du projet, relever le **numéro de projet** (indiqué dans la carte "Informations du projet") — il sera demandé dans le formulaire.

## 2. Soumettre la demande d'accès

1. Aller sur le [formulaire de contact API Google Business Profile](https://support.google.com/business/contact/api_default).
2. Dans le menu déroulant, sélectionner **"Application for Basic API Access"**.
3. Remplir les champs demandés avec vos informations réelles (nom de l'entreprise, site web, email, numéro de projet Google Cloud).
4. Dans le champ de description de l'usage prévu, utiliser le contenu préparé dans [`docs/google-business-profile-dossier.md`](./google-business-profile-dossier.md) — complétez d'abord les informations entre crochets dans ce document avant de le coller.
5. Envoyer le formulaire.

## 3. Attendre la réponse

- Le délai de traitement annoncé par Google est d'**environ 14 jours** (la fourchette de 3 à 10 jours mentionnée initialement était optimiste — la documentation officielle actuelle indique jusqu'à 2 semaines).
- Une réponse arrive par email à l'adresse utilisée pour la demande.
- **En cas de refus** : Google indique généralement la raison (site web/email non cohérents, description d'usage trop vague, projet ne ressemblant pas à un outil de gestion de fiche fonctionnel...). Un refus n'est pas définitif — il est possible de corriger le point signalé et de soumettre à nouveau.
- **Pour vérifier si l'accès a été accordé** sans attendre l'email : dans la Google Cloud Console, consulter les quotas des API Business Profile. Un quota à **0 QPM** (requêtes par minute) signifie que l'accès n'est pas encore approuvé ; un quota à **300 QPM** signifie que le projet est approuvé.

## 4. Une fois l'accès accordé

1. Dans la Google Cloud Console, activer les API nécessaires pour ce projet : **Google My Business API** (avis), **My Business Account Management API**, et éventuellement **My Business Notifications API** si les alertes en quasi temps réel (via Pub/Sub) sont souhaitées plutôt qu'une vérification périodique.
2. Configurer l'**écran de consentement OAuth** (type "Externe", puisque ce ne sont pas des comptes internes à une organisation Google Workspace).
3. Créer des **identifiants OAuth 2.0** (ID client + secret client) dans la Cloud Console, section "Identifiants".
4. **Ne pas configurer les URI de redirection seul** — transmettez-moi (Claude Code) l'ID client et le secret une fois obtenus : c'est à ce moment que je pourrai construire le flux de connexion OAuth côté application, configurer l'URI de redirection exacte vers Marguerite, et brancher la fonctionnalité pour de vrai.

## Ce que je ne peux pas faire à votre place

Toutes les étapes ci-dessus (création du projet Google Cloud, soumission du formulaire, suivi de la réponse, activation des API, création des identifiants OAuth) nécessitent votre propre compte Google, gestionnaire de la fiche Business Profile réelle de la boutique. Je n'y ai pas accès — comme pour Supabase ou Vercel, c'est à vous de les réaliser, puis de me transmettre uniquement les informations techniques nécessaires (ID client, secret) une fois obtenues, pour que je construise l'intégration.
