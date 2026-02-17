# Agreement System

## Le probleme

Quand BMAD produit les artefacts produit et Spec Kit produit les artefacts d'implementation,
rien ne garantit que les deux restent alignes avec le code livre.
Le PRD dit une chose, le contrat API dit une autre, le code fait une troisieme.
Le drift est invisible jusqu'a ce que quelque chose casse.

## La solution

Un **Agreement** est un artefact YAML leger qui capture la **promesse partagee** entre :

- **BMAD** (produit) — l'intention, le pourquoi
- **Spec Kit** (implementation) — le plan, les contrats, le comment
- **Code** — la realite livree

L'Agreement ne remplace aucun de ces trois. Il est le point de convergence
que chacun reference.

> Une feature = un Agreement = une promesse explicite.

## Architecture

```
project-root/
│
├── .agreements/                          # espace propre, jamais touche par les updates BMAD/Spec Kit
│   ├── agreement.md                      # ce fichier
│   ├── index.yaml                        # registre de tous les agreements
│   ├── _templates/
│   │   └── agreement.tpl.yaml            # template v1
│   └── ###-feature-name/
│       ├── agreement.yaml                # un agreement par feature
│       └── check-report.md               # rapport de drift (genere par /agreement.check)
│
├── .claude/commands/                     # commandes Claude Code
│   ├── agreement.create.md              # namespace "agreement.*" — independant de speckit.*
│   ├── agreement.sync.md
│   ├── agreement.check.md
│   └── agreement.doctor.md
│
├── _bmad/_config/agents/*.customize.yaml # integration BMAD via mecanisme natif
├── _bmad/_memory/agreements-sidecar/     # memoire persistante pour agents BMAD
│
├── .bmad_output/                         # artefacts BMAD (pas touche)
└── specs/                                # artefacts Spec Kit (pas touche sauf tasks.md par /doctor)
```

**Resilience aux mises a jour** : aucun fichier core de BMAD ni de Spec Kit n'est modifie.
L'integration passe par `customize.yaml` (BMAD) et le namespace `agreement.*` (Claude Code),
deux mecanismes d'extension conçus pour survivre aux updates.

## Commandes

| Commande | Role | Modifie des fichiers ? |
|----------|------|----------------------|
| `/agreement.create` | Creer un Agreement pour une feature | `.agreements/` uniquement |
| `/agreement.sync` | Synchroniser l'Agreement avec les artefacts existants | `.agreements/` uniquement |
| `/agreement.check` | Verifier le code contre la promesse de l'Agreement | Ecrit `check-report.md` si FAIL |
| `/agreement.doctor` | Generer des taches correctives depuis un check FAIL | Ajoute une phase dans `tasks.md` |

### `/agreement.create`

Cree un Agreement. Detecte automatiquement les artefacts BMAD et Spec Kit existants.

```
/agreement.create Description de la feature
/agreement.create 001-feature-name
```

### `/agreement.sync`

Detecte le drift entre l'Agreement et les artefacts produit/implementation.
Propose des mises a jour, applique uniquement apres confirmation.

```
/agreement.sync 001-feature-name
```

### `/agreement.check`

Compare le code reel aux interfaces et criteres declares dans l'Agreement.
Rend un verdict PASS ou FAIL. Si FAIL, ecrit un `check-report.md` structure.

```
/agreement.check 001-feature-name
/agreement.check diff
```

### `/agreement.doctor`

Lit le `check-report.md`, lit les contrats Spec Kit (source de verite),
et genere des taches correctives au format natif Spec Kit.
Les taches sont ajoutees a `tasks.md` comme phase "Agreement Fixes"
et sont executables par `/speckit.implement`.

```
/agreement.doctor 001-feature-name
```

## User Stories testees

### Story 1 — Creation from scratch (BMAD + Spec Kit + Agreement)

**Contexte** : partir de zero avec une idee de feature (BookStore CRUD API)
et produire tous les artefacts des deux cotes avant de creer l'Agreement.

**Flow execute** :

```
# 1. Produire les artefacts BMAD (produit)
/bmad-bmm-create-product-brief            → product-brief.md
/bmad-bmm-create-prd                      → prd.md
/bmad-bmm-create-architecture             → architecture.md
/bmad-bmm-create-epics-and-stories        → epics.md

# 2. Produire les artefacts Spec Kit (implementation)
/speckit.specify                          → spec.md
/speckit.plan                             → plan.md, contracts/, data-model.md, research.md
/speckit.tasks                            → tasks.md

# 3. Creer l'Agreement (convergence)
/agreement.create 001-bookstore-crud-api
```

**Resultat** : `/agreement.create` a detecte les 4 artefacts BMAD et les 7 artefacts
Spec Kit. L'Agreement a ete genere avec :

- l'intent produit extrait du PRD
- les interfaces extraites des contrats Spec Kit
- les criteres d'acceptation croises entre les deux sources
- les watched_paths couvrant les 3 couches (BMAD, Spec Kit, code)

**Ce que ca prouve** : l'Agreement sait scanner les deux ecosystemes
et en extraire une promesse unifiee, sans modifier aucun fichier existant.

### Story 2 — Contract-first repair (check → doctor → implement → check)

**Contexte** : le code a ete implemente via `/speckit.implement` mais
a diverge des contrats sur 3 points (DELETE 204 vs 200, pagination nested vs flat,
error codes string manquants). Le drift vient du fait que `tasks.md` ne referençait
pas les contrats explicitement — l'agent d'implementation a utilise les patterns
les plus courants au lieu de lire `contracts/books-api.md`.

**Flow execute** :

```
# 1. Detecter le drift
/agreement.check diff
  → FAIL : 3 BREAKING, 2 DRIFT
  → check-report.md ecrit dans .agreements/001-bookstore-crud-api/

# 2. Generer les taches correctives
/agreement.doctor 001-bookstore-crud-api
  → lit check-report.md + contracts/books-api.md (source de verite)
  → genere 5 taches FIX dans tasks.md (Phase 7: Agreement Fixes)
  → chaque tache est auto-contenue : fichier + comportement actuel + comportement attendu + ref contrat

# 3. Executer les corrections
/speckit.implement
  → execute les taches FIX comme n'importe quelle tache Spec Kit
  → marque chaque tache [X] une fois terminee

# 4. Re-verifier
/agreement.check 001-bookstore-crud-api
  → PASS
```

**Ce que ca prouve** :

1. `/agreement.check` detecte des ecarts reels entre la promesse et le code, en stateless
2. `/agreement.doctor` traduit ces ecarts en taches que Spec Kit consomme nativement
3. Le cycle check → doctor → implement → check boucle jusqu'au PASS
4. Aucun fichier core BMAD ou Spec Kit n'a ete modifie — seul `tasks.md` a reçu une phase corrective

**Root cause identifiee** : le drift n'etait pas dans les specs ni dans les contrats
(qui etaient precis) mais dans `tasks.md` qui ne referençait pas les contrats.
Le signal s'est degrade dans le dernier kilometre : `contrat (precis) → tasks (vague) → code (diverge)`.
L'Agreement System est le filet de securite qui rattrape cette perte.

## Principes

1. **Court** — un Agreement fait ~50 lignes YAML. Il capture la promesse, pas les details.
2. **Reference, ne duplique pas** — les details restent dans le PRD (BMAD) et la spec (Spec Kit).
3. **Agreement-first** — toute modification d'interface passe d'abord par l'Agreement.
4. **Jamais silencieux** — `/agreement.sync` propose, l'utilisateur confirme.
5. **Progressif** — on peut creer un Agreement a n'importe quel moment du cycle.
6. **Resilient** — aucune dependance sur les fichiers core des outils tiers.
