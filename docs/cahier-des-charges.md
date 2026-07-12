# Marguerite — Cahier des charges

*Application de gestion pour petites structures multi-boutiques*

*Document vivant, mis à jour au fil des sessions.*

## Le projet en une phrase

Une application tout-en-un, simple et abordable, pour aider les gérants de petites structures multi-boutiques (2-4 magasins, retail de centre-ville) à piloter leur activité sans complexité ni prix excessif.

## Stratégie resserrée : V1 interne → V2 commerciale

**Décision de méthode** : plutôt que de construire les 11 fonctionnalités avant tout premier retour terrain, on démarre par une V1 volontairement restreinte en périmètre (une seule brique : le Planning), mais construite à fond et sans contrainte de temps — jusqu'à un an si nécessaire, sans compromis sur la qualité. Cette V1 est utilisée en conditions réelles dans la boutique où le porteur de projet travaille actuellement (manager), et sert de test grandeur nature ET de futur argument marketing ("on l'utilise nous-mêmes, tous les jours, en vraie boutique") pour démarcher les gérants professionnels avec la V2 complète.

**Principe d'architecture** : la V1 est construite comme un vrai produit générique dès le départ — modèle de données pensé pour n'importe quelle entreprise (structure → boutiques → salariés → profils → planning), jamais rien codé en dur spécifiquement pour la boutique du porteur de projet. Une seule structure réelle est activée pour l'instant (l'employeur actuel du porteur de projet), qui sert de premier test grandeur nature. Ce qui reste propre à la V2 commerciale, ce ne sont pas les fondations techniques mais les fonctionnalités liées à la vente à plusieurs clients : inscription en ligne, facturation/abonnement, tableau de bord gérant multi-boutique, onboarding de nouvelles structures. Cette distinction évite une reconstruction complète au moment de passer à la V2.

**Décision technique** : Next.js (React + TypeScript) pour le frontend et le backend (API routes), Supabase pour la base de données Postgres, l'authentification et le stockage de fichiers, Tailwind CSS pour le style, hébergement Vercel + Supabase Cloud. Schéma de données généré : voir `marguerite-schema-v1.sql` — modèle générique structure → boutiques → utilisateurs → profils salariés → plannings → créneaux, une seule structure activée en V1 mais aucune donnée codée en dur.

**Principe d'architecture applicative** : la V1 n'est pas une application mono-fonction. Elle reprend dès le départ la structure complète à onglets validée dans les maquettes (menu global donnant accès aux 11 fonctionnalités), mais seul l'onglet **Planning** est pleinement fonctionnel au lancement — les autres onglets apparaissent dans le menu (éventuellement en "bientôt disponible") et seront activés un par un par la suite, dans cette même application, sans reconstruction. Ça évite de devoir retravailler la navigation à chaque nouvelle fonctionnalité ajoutée.

**Périmètre V1** (une seule structure activée, mais modèle générique multi-structure) — on commence par le Planning dans sa **version complète et aboutie**, puis on enchaîne sur les autres onglets un par un (liste ci-dessous) :
1. Profil salarié (contrat, heures hebdo, jours de repos fixes, disponibilités/préférences ; règles légales de repos appliquées automatiquement)
2. Planning manuel (vue jour/semaine, code couleur par salarié, ajout/édition de créneaux, signalement des trous de couverture)
3. **Planning assisté par IA** (génération automatique à partir des profils salariés et des besoins de couverture) et **ajustement conversationnel** (langage naturel pour corriger le planning proposé) — repris en V1 plutôt que reportés, puisque le temps n'est plus une contrainte
4. Vue salarié en lecture seule (chaque membre de l'équipe consulte sa propre semaine)
5. **Onboarding structure/boutique** : écran générique qui crée la structure et la boutique (nom, adresse) et rattache l'utilisateur connecté comme manager — évite toute donnée codée en dur, cohérent avec le principe d'architecture générique
6. **Ma boutique** : configuration des horaires d'ouverture par jour (avec créneaux multiples pour gérer une fermeture le midi) et des effectifs minimums requis à l'ouverture et à la fermeture — sert de référence à la détection des trous de couverture dans le planning

**Reporté à la V2** (ce qui reste propre à la vente à plusieurs clients, pas les fonctionnalités elles-mêmes) : rôle gérant et vue multi-boutique (une seule boutique existe pour l'instant), notifications ciblées, mode vacances automatique, personnalisation des écrans, tarification BETA/Standard, inscription en ligne de nouvelles structures.

**File d'attente V1 — les onglets restants à construire, dans l'ordre :** *(complétée — les 10 onglets suivant le Planning sont tous construits)*
1. ~~Congés~~ ✅
2. ~~Tâches du jour~~ ✅
3. ~~Indicateurs commerciaux~~ ✅ (vue manager + vue salarié)
4. ~~Documents~~ ✅
5. ~~Notes de frais~~ ✅
6. ~~Factures fournisseurs~~ ✅
7. ~~Annonces~~ ✅
8. ~~Onboarding nouveaux vendeurs~~ ✅
9. ~~Rappels et échéances~~ ✅
10. ~~Messagerie~~ ✅

*Ordre indicatif, ajustable à tout moment selon les besoins réels rencontrés.*

**Point de vigilance** : la V1 fera tourner de vraies données du lieu de travail actuel (planning de l'équipe, potentiellement des chiffres). Avant tout déploiement en usage réel avec les collègues (pas seulement un prototype personnel), il faudra a minima en informer le gérant actuel — cela protège aussi le porteur de projet et renforce l'argument de vente (un gérant qui valide l'usage dès le départ vaut plus qu'un outil utilisé en douce). Décision actuelle : construire d'abord, en parler ensuite.

## Cible

- Gérants de petites structures multi-boutiques (2 à 4 magasins), retail de centre-ville
- Très attentifs aux dépenses et aux marges, contrairement aux grands groupes
- Souvent peu à l'aise avec l'informatique, tous âges confondus
- Responsables de magasin comme utilisateurs terrain de l'application

## Les 3 espaces / rôles

L'application est utilisée par 3 profils distincts, avec un compte unique par utilisateur mais un contenu et des permissions différents selon le rôle :

- **Vendeur** — membre de l'équipe commerciale en boutique. Consulte et agit sur son propre périmètre (son planning, ses congés, ses documents, ses notes de frais).
- **Manager** — responsable d'une boutique (le poste actuel du porteur de projet). Pilote sa boutique et son équipe : édite le planning, valide en première ligne, assigne les tâches.
- **Gérant** — dirigeant de la structure multi-boutiques. Vue transversale sur toutes les boutiques, décisions finales (validations, argent, communication officielle).

### Répartition des fonctionnalités par rôle

| Fonctionnalité | Vendeur | Manager | Gérant |
|---|---|---|---|
| Messagerie | Oui | Oui | Oui |
| Planning | Vue perso (lecture) | Vue + édition de sa boutique | Vue globale toutes boutiques |
| Tâches du jour | Vue/exécution | Création et assignation | Vue d'ensemble (option) |
| Demande de congés | Demande | Validation niveau boutique | Vue d'ensemble / arbitrage si besoin |
| Documents | Consultation + ajout de ses propres documents (arrêt maladie...) | Docs de son équipe | Tous les documents |
| Indicateurs commerciaux | Objectif d'équipe visible par défaut (motivation) ; reste optionnel et paramétrable par le gérant : vue globale toutes boutiques activable ou non | Vue de sa boutique par défaut ; vue des autres boutiques activable par le gérant ; fixe les objectifs de sa boutique | Vue globale comparée entre boutiques |
| Notes de frais | Soumission avec descriptif de l'achat | Validation première ligne (légitimité) | Action financière uniquement : marquer comme remboursé |
| Factures fournisseurs | Pas d'accès | Dépôt possible | Vue d'ensemble + export comptable |
| Annonces du siège | Réception + accusé | Réception + relais à l'équipe | Émission |
| Onboarding nouveaux vendeurs | Suit son parcours | Assigne et suit | Vue d'ensemble |
| Rappels et échéances | Pas d'accès | Vue + gestion de sa boutique | Vue d'ensemble toutes boutiques |

*Répartition proposée, à ajuster selon les retours terrain et les préférences du porteur de projet.*

## Positionnement face à la concurrence

Le marché (Combo, Skello, Factorial...) est déjà occupé par des acteurs solides, pensés pour scaler de 5 à 1000 salariés. Notre créneau : une version volontairement minimaliste, avec les fonctionnalités essentielles bien faites, à un prix dérisoire pour les toutes petites structures — pas un concurrent frontal sur la complétude, un concurrent sur la simplicité et le prix.

## Principe stratégique clé : orchestrer plutôt que réinventer

Pour toute brique réglementée ou à forte responsabilité juridique (paie, TVA/comptabilité, coffre-fort numérique de documents), on ne construit pas nous-mêmes : on s'interface avec des partenaires déjà certifiés (ex. coffre-fort numérique type Digiposte pour les fiches de paie, export vers logiciel comptable pour la TVA). Notre valeur ajoutée est la couche d'organisation et de simplicité, pas la conformité réglementaire elle-même.

## Fonctionnalités

### Cœur (v1, développées en priorité)
1. **Messagerie**
2. **Planning** — cœur du produit. Inclut le **planning assisté par algorithme** (repositionné en V1, argument de vente principal) : le manager/gérant remplit une fois un **profil salarié** à l'embauche ou à chaque modification de contrat (type de contrat, volume d'heures hebdo, jours de repos fixes, disponibilités/préférences ; les contraintes légales — repos quotidien 11h, repos hebdo 24h — sont appliquées automatiquement par l'outil, sans saisie). Le générateur croise ensuite ces profils déjà enregistrés avec les besoins de couverture par boutique (heures d'ouverture, effectif minimum par créneau, à définir une fois par boutique) pour proposer un planning type, que le manager ajuste ensuite. Simplification clé : les contraintes sont saisies une seule fois (à l'embauche), pas redemandées à chaque génération — rend le chantier réaliste pour un développement à deux. Différenciant fort face à Skello qui réserve cette fonctionnalité à des abonnements premium (~89€/mois/établissement) visant de plus grandes structures. **Ajustement conversationnel** : après la proposition de planning, le manager peut demander des corrections en langage naturel (ex. "Pierre n'est pas disponible jeudi, réadapte le planning") ; l'IA traduit la demande en contrainte structurée, puis l'algorithme de planning (déterministe) recalcule en respectant toujours les règles légales incompressibles — l'IA générative sert à comprendre le langage humain, jamais à décider seule du planning final. **Évolution (généralisation)** : ce même chat sert aussi à *configurer les règles métier propres à chaque boutique avant génération*, pas seulement à corriger après coup. Plutôt que d'ajouter un champ de base de données et une branche d'algorithme pour chaque nouvelle règle découverte (approche suivie jusqu'ici), le manager décrit sa règle en langage naturel (ex. "il faut toujours au moins un manager en boutique", "fermeture le midi si effectif ≤ 2 personnes"), le chat l'interprète en contrainte structurée générique (table `regles_planning` : description brute conservée, type de règle, paramètres en jsonb), et l'algorithme de génération applique ensuite toutes les règles actives de la boutique. Reste générique par construction — fonctionne pour n'importe quelle entreprise sans code spécifique par client.
3. **Ordonnancement des tâches** — check-lists ouverture/fermeture, tâches du jour par magasin. **Règle de report automatique** : une tâche non cochée en fin de journée est reportée automatiquement au lendemain, plutôt que de disparaître. **Confirmation de fin de journée** : avant le report, un écran demande de confirmer tâche par tâche si elle a vraiment été non réalisée ou si c'est un oubli de case à cocher (bouton "c'était fait" pour corriger sans report, "pas fait" pour confirmer le report réel) — évite à la fois la tâche perdue et le report abusif
4. **Demande de congés** — workflow demande → validation. Détection automatique de conflit avec le planning existant (ex. chevauchement avec une autre absence déjà validée), signalée au manager avant validation
5. **Accès aux documents** — contrats de travail, procédures internes, notes de service, avenants. Le vendeur peut aussi y ajouter certains documents le concernant (arrêt maladie, justificatif d'absence), en complément de la simple consultation. **Option de confidentialité salariale** : par défaut, le montant du salaire est masqué pour le manager dans le contrat qu'il consulte (seules les infos utiles à son rôle restent visibles — dates, poste, volume horaire) ; le gérant peut activer la visibilité complète s'il le souhaite. Précision : ce n'est pas une obligation de la directive transparence salariale (UE 2023/970, transposition française attendue autour de 2027-2028, et qui ne concerne pas la visibilité interne entre manager et salarié mais l'information des candidats/salariés en général) — c'est un choix de gouvernance interne, laissé au gérant. **Décision v1 : pas de coffre-fort numérique intégré.** Les petites structures ciblées ont presque toujours déjà un expert-comptable ou prestataire de paie externe qui gère la distribution légale des fiches de paie ; on ne duplique pas ce service. Un simple lien/renvoi vers l'outil existant du gérant suffit en v1. À revoir en V2 si la validation terrain montre un vrai besoin non couvert (coût constaté : 5-30€/mois selon fonctionnalités et niveau de certification NF Z42-013)
6. **Indicateurs commerciaux** — CA, marge, fréquentation, panier moyen par magasin ; fonctionnalité qui justifie le prix aux yeux du gérant. **Bilan périodique diagnostic** (hebdo/mensuel/annuel, recentré sur le manager en v1) : le CA se décompose en fréquentation × panier moyen ; le moteur de règles croise ces évolutions pour expliquer les causes plutôt que de juxtaposer des constats isolés (ex. "CA en hausse mais uniquement porté par la fréquentation, le panier moyen recule — surveillez la vente additionnelle"), et repère les situations trompeuses où un indicateur positif masque un problème sur un autre. **Objectifs fixés par le manager** (hebdo/mensuel/annuel, CA et panier moyen) pour sa boutique : servent de base au bilan diagnostic et sont rendus visibles à l'équipe de vendeurs sous forme d'une progression motivante (indépendant du toggle de visibilité complète des indicateurs — moins sensible qu'une marge ou une comparaison financière)
7. **Notes de frais salariés** — photo de ticket + montant + catégorie + **descriptif de l'achat** (ce qui a été acheté, pour la traçabilité et éviter toute dérive). Workflow clarifié : le manager valide ou refuse en première ligne (seule décision de légitimité) ; une fois validée, la note passe dans l'espace du gérant qui n'a qu'une action financière à faire — "marquer comme remboursé" une fois le virement effectué — sans rejuger la légitimité déjà tranchée par le manager
8. **Regroupement des factures fournisseurs** — dépôt/classement par magasin et par mois, tags (montant HT, TVA, catégorie), **descriptif de l'achat** (pour clarifier et faciliter la recherche), export propre pour l'expert-comptable (on n'automatise jamais le calcul ou la télédéclaration de la TVA). **Recherche et fiche fournisseur** : le gérant peut rechercher par nom de fournisseur, avec une fiche épinglée en haut d'écran (SIREN, adresse, contact commercial, total facturé sur 12 mois) au-dessus de l'historique des factures de ce fournisseur. **Décision format d'export v1 : CSV/Excel simple** (date, fournisseur, montant HT, TVA, montant TTC, catégorie) — importable par n'importe quel comptable, sans dépendance à un format complexe type FEC ni intégration API poussée avec un outil tiers
9. **Annonces/consignes du siège** — fil descendant avec accusé de réception, distinct de la messagerie 1-to-1. Le gérant cible tout ou partie des boutiques à l'envoi, ainsi que le rôle destinataire (managers uniquement, ou toute l'équipe) — utile par exemple pour une consigne de pilotage réservée aux managers avant relais à leur équipe. Suivi de lecture par le gérant (qui a pris connaissance, qui n'a pas encore lu), pour relancer les retardataires
10. **Onboarding nouveaux vendeurs** — check-list / mini-formation (procédures, argumentaires). **Formation sur mesure** : le manager importe ses propres supports de présentation (PDF, Canva, PowerPoint) par étape, plutôt que du contenu générique imposé par l'appli. **QCM de validation** : le manager crée un questionnaire à choix multiples par module ; le vendeur doit y répondre pour valider l'étape, garantissant une vraie compréhension plutôt qu'un simple "j'ai lu"
11. **Rappels et échéances** — liste de dates pré-remplies pour les obligations administratives récurrentes ou ponctuelles (vérification extincteurs, visite médecine du travail, renouvellement d'assurance, contrôle électrique...), avec notification à l'approche de l'échéance. Distinct des tâches du jour (logique calendaire/administrative, pas opérationnelle quotidienne). **Échéances croisées** : le manager peut assigner une échéance au gérant (ex. renouvellement de bail) et inversement (ex. contrôle à faire dans une boutique précise) — le champ responsable n'est pas limité à soi-même. **Délai de rappel personnalisable** (façon Rappels Apple) : à la création, choix du délai avant la date (le jour même, 1 semaine avant, 1 mois avant, ou personnalisé)

## Notifications et disponibilité

- **Notifications ciblées** : seules les urgences réelles déclenchent une notification push (échéance en retard, trou de couverture sur le planning, congé à valider, tâche non faite en fin de journée) ; tout le reste (nouveau message, bilan disponible...) reste consultable dans l'appli sans déranger. Objectif : rester un bonus perçu comme fiable, jamais une source de dérangement qu'on finit par couper entièrement.
- **Mode vacances automatique** : relié au planning (profil salarié), coupe automatiquement les notifications professionnelles d'une personne pendant ses congés validés et ses repos hebdomadaires fixes, sans manipulation manuelle nécessaire.

### Optionnelles (à tester selon retours terrain)
- Gestion de stocks/inventaire simplifié
- Suivi des heures/pointage réel vs planning prévu
- Fiche produit / catalogue partagé entre boutiques

## Principes d'interface (UX/UI)

1. Une action visible à la fois — jamais d'écran surchargé
2. Langage du quotidien, pas de jargon logiciel ("Mes ventes" plutôt que "Dashboard")
3. Gros éléments, peu de texte — pensé pour un usage rapide sur téléphone, entre deux clients
4. Hiérarchie visuelle stricte — l'info la plus importante saute aux yeux immédiatement
5. Cohérence totale — mêmes gestes, mêmes couleurs, mêmes emplacements partout

### Identité visuelle validée
- **Nom : Marguerite**
- **Palette** : blanc/noir épuré façon Apple, avec touches de couleur discrètes plutôt que des aplats colorés. Mode clair et mode sombre tous deux prévus.
- **Typographie** : gros caractères, ronde, lisible, priorité absolue à la lisibilité mobile
- **Ambiance** : beaucoup d'espace blanc, cartes à bordure fine plutôt que fond coloré, icônes simples
- **Logo / mark final : la marguerite "Méditerranée"** — six pétales blancs au tracé légèrement organique (esprit dessiné à la main plutôt que vectoriel parfait, inspiré des marques lifestyle côtières comme Natif), contour vert olive (#6B8F5E), cœur jaune doré (#E8B84B), avec de petits rayons de soleil qui pointent entre les pétales — le mark réunit les deux motifs floral et solaire. Utilisable sur fond blanc comme sur fond sombre.

### Fonctionnalités UX spécifiques décidées
- **Écran d'accueil personnalisable** (façon Garmin Connect / Pinterest) : chaque utilisateur compose son propre écran d'accueil selon les fonctions qu'il utilise le plus
- **Menu global** : donne accès à l'intégralité des fonctionnalités à tout moment, regroupées par catégorie (Quotidien/Pilotage/Équipe)

## Avancement réel de la V1 (code)

- [x] Projet Next.js créé, connecté à Supabase (auth + base de données)
- [x] Schéma de base de données en place (voir `marguerite-schema-v1.sql`, tenu à jour au fil des évolutions)
- [x] Authentification (connexion email/mot de passe)
- [x] Menu principal regroupé en 3 catégories (Quotidien/Pilotage/Équipe) + Accueil, filtrage par rôle
- [x] Onboarding structure/boutique (création générique, plus de valeur codée en dur)
- [x] Gestion des salariés (profils : contrat, heures hebdo, jours de repos, couleur)
- [x] Écran "Ma boutique" (horaires flexibles par jour + effectifs minimums ouverture/journée/fermeture)
- [x] Écran Planning manuel + bascule Jour/Semaine (vue semaine, créneaux colorés par salarié, détection des trous de couverture affinée, suppression individuelle de créneau)
- [x] Planning assisté par IA (algorithme glouton, testé en conditions réelles avec une vraie équipe de 5 personnes)
- [x] Vue salarié en lecture seule
- [x] Onglet Congés (demande salarié avec solde et historique, validation manager avec détection de conflit)
- [x] Onglet Tâches du jour (groupées par catégorie, report automatique avec confirmation, suppression individuelle)
- [x] Onglet Indicateurs commerciaux (saisie quotidienne CA/fréquentation, objectifs par période, référence de comparaison choisie, bilan diagnostic automatique, vue salarié limitée à la progression)
- [x] Onglet Documents (dépôt manager, stockage Supabase, ajout de justificatifs côté salarié, pas de coffre-fort fiche de paie en V1)
- [x] Onglet Notes de frais (soumission salarié avec ticket/descriptif, validation manager, écran "à rembourser")
- [x] Onglet Factures fournisseurs (dépôt manager, fiche fournisseur avec recherche, export CSV)
- [x] Onglet Annonces (création avec ciblage de rôle, accusé de lecture, suivi côté manager)
- [x] Onglet Onboarding nouveaux vendeurs (modules avec support et QCM, parcours guidé verrouillé)
- [x] Onglet Rappels et échéances (délai de rappel personnalisable, code couleur retard/imminent)
- [x] Onglet Messagerie (conversations libres entre collègues)
- [x] Écran d'accueil séparé du Planning : grille de widgets épinglables façon Pinterest, personnalisable par utilisateur
- [x] Page de connexion personnalisée (logo, "Bonjour", rubrique "Première connexion ?") + animation d'ouverture (logo qui se dessine)
- [x] Identité visuelle Marguerite appliquée sur l'ensemble des écrans (palette, mode sombre, logo)
- [x] Invitation des salariés par le manager (token, page `/rejoindre/[token]`, "Créer une nouvelle entreprise" distinct pour une nouvelle structure)
- [x] Audit et correction des policies RLS Supabase (isolation par structure/boutique, fonction partagée `user_has_access_to_boutique`, gère déjà le rôle `gerant`)
- [x] Déploiement public sur Vercel (déploiement automatique à chaque merge sur `main`)

**Les 11 fonctionnalités du périmètre V1 sont toutes construites, actives et testées de bout en bout.**

## Rôle Gérant — en cours d'activation

Le rôle gérant (vue transversale multi-boutiques, décisions finales, communication officielle — voir tableau des rôles plus haut) est en cours de construction, avec un délai serré (démo au vrai gérant prévue prochainement) mais sans compromis de qualité demandé.

**Approche technique retenue** : réutilisation des composants manager existants via un sélecteur de boutique pour les écrans opérationnels (Planning, Tâches, Congés, Documents, Notes de frais), plus des vues agrégées dédiées pour les écrans où la comparaison entre boutiques est la vraie valeur ajoutée (Indicateurs comparatif, Annonces diffusion structure, Rappels et échéances consolidés, Factures fournisseurs consolidées par fournisseur, Messagerie élargie).

**Décisions prises :**
- Droits d'écriture du gérant identiques au manager, sur n'importe quelle boutique de sa structure
- Documents/Échéances "structure-level" (non rattachés à une boutique précise) : colonne nullable plutôt que nouvelle table
- La création d'une nouvelle structure (`OnboardingScreen.tsx`) crée désormais un `gerant` plutôt qu'un `manager` — cohérent avec le fait que le créateur d'une entreprise en est le patron
- Deux chemins pour devenir gérant : promotion d'un compte existant via un sélecteur de rôle dans "Gérer l'équipe", ou invitation directe en tant que gérant

**Étape 1 (fondations) terminée et testée** : inscription → onboarding simplifié → compte gérant créé → redirection vers "Mes boutiques" → création d'une boutique → édition de ses horaires. Menu confirmé identique à un manager. Non-régression validée sur le compte manager réel.

**Reste à construire** : sélecteur de boutique générique (étape 2), vues dédiées une par une — Indicateurs comparatif, Annonces diffusion structure, Rappels et échéances consolidés, Factures fournisseurs consolidées, Messagerie élargie (étape 3), Accueil gérant avec widgets agrégés (étape 4).

## Autres points en attente (V1)

- [ ] Onglet Aide
- [ ] Onglet Paramètres
- [ ] Auditer les rôles et l'accessibilité des 3 types de compte sur l'ensemble des 11 onglets
- [ ] **Routine de fin de journée** (moins prioritaire) — consolider la confirmation des tâches et la saisie du CA en un seul réflexe, avec notification ~10 min avant la fermeture et une pop-up "Fin de journée"
- [ ] Système de règles personnalisées par chat — reporté (nécessite une clé API Anthropic Console)
- [ ] Ajustement conversationnel du planning déjà généré — même chat, reporté avec le point ci-dessus

## Méthode de travail

- Pas de pression de temps : développement prévu sur plusieurs mois, par sessions régulières
- Approche par phases, avec tests terrain au fur et à mesure plutôt qu'un lancement final unique
- **Stratégie boutiques pilotes** : les premières structures qui rejoignent en tarif BETA (19,99 €/mois fixe à vie) servent aussi de preuves de confiance pour le démarchage des clients suivants au tarif standard

## Décisions tranchées

- **Nom et identité visuelle** : Marguerite, logo "Méditerranée" (pétales blancs, contour vert olive, cœur jaune doré)
- **Coffre-fort numérique fiches de paie** : pas d'intégration en V1, réévaluation possible en V2
- **Format d'export comptable** : CSV/Excel simple, pas de format complexe type FEC en V1
- **Modèle de tarification** : coût + marge, deux paliers — BETA (structures pilotes) 19,99 €/mois fixe à vie ; Standard (après la phase pilote) 29,99 à 34,99 €/mois

## Décisions en attente / à trancher

- [ ] Lancement de la phase de validation terrain (script préparé, liste de gérants à contacter à établir)
