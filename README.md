# Agreement System

Lightweight convergence layer between product (BMAD), implementation (Spec Kit), and code.

> One feature = one Agreement = one explicit promise.

## The Problem

When BMAD produces product artifacts and Spec Kit produces implementation artifacts, nothing guarantees they stay aligned with the shipped code. The PRD says one thing, the API contract says another, the code does a third. Drift is invisible until something breaks.

This is the **last-mile degradation** pattern:

- **Contract** (precise): *"DELETE returns 204, no body"*
- **Task** (vague): *"Implement DELETE endpoint"*
- **Code** (diverged): *Returns 200 with body*

## The Solution

An **Agreement** is a lightweight YAML artifact (~50 lines) that captures the shared promise between product intent, implementation decisions, and actual code. It doesn't replace any existing tool — it's the convergence point they all reference.

```
┌─────────┐       ┌──────────┐       ┌──────┐
│  BMAD   │       │ Spec Kit │       │ Code │
│ (intent)│       │ (design) │       │(real)│
└────┬────┘       └────┬─────┘       └──┬───┘
     │                 │                 │
     └────────┬────────┘                 │
              ▼                          │
       ┌─────────────┐                  │
       │  Agreement  │◄─────────────────┘
       │   (YAML)    │   /agreement.check
       └─────────────┘
```

## Install

```bash
npx agreement-system init
```

The installer detects your environment and adapts:

| Detected | What happens |
|----------|-------------|
| BMAD (`_bmad/`) | Adds Agreement menu items to BMAD agents via `customize.yaml` |
| Spec Kit (`.specify/`) | Confirms `/agreement.doctor` compatibility with `/speckit.implement` |
| Neither | Installs standalone (commands + templates only) |

## Update

```bash
npx agreement-system update
```

Updates commands and templates without touching your existing agreements or config.

## Commands

| Command | Purpose | Input | Output | Modifies |
|---------|---------|-------|--------|----------|
| `/agreement.create` | Create an Agreement for a feature | Feature description or ID | `agreement.yaml` + registry update | `.agreements/` only |
| `/agreement.sync` | Detect drift between Agreement and BMAD/Spec Kit artifacts | Feature ID or `all` | Drift report + proposed YAML changes | `.agreements/` only (after confirmation) |
| `/agreement.check` | Verify code matches the Agreement | Feature ID or `diff` | PASS or FAIL + `check-report.md` | `check-report.md` only (on FAIL) |
| `/agreement.doctor` | Generate fix tasks from a check FAIL | Feature ID | Fix tasks appended to `tasks.md` | `specs/{{feature_id}}/tasks.md` |

### `/agreement.create`

Scans for existing BMAD artifacts (PRD, architecture, stories) and Spec Kit artifacts (spec, plan, contracts, tasks). Extracts product intent, user outcomes, acceptance criteria, and interfaces. Writes a unified `agreement.yaml` and updates the global registry.

### `/agreement.sync`

Detects 6 categories of drift between Agreement and upstream artifacts:

| Category | Severity | Example |
|----------|----------|---------|
| Intent drift | HIGH | Product intent changed in PRD |
| Interface change | HIGH | API path or response shape changed in contract |
| Criteria mismatch | MEDIUM | Acceptance criteria differ between Agreement and spec |
| New constraint | MEDIUM | Constraint added in one layer but not reflected |
| Reference stale | LOW | Referenced file moved or deleted |
| Coverage gap | LOW | New artifact exists but is not referenced |

**Never applies changes silently** — always proposes and waits for confirmation.

### `/agreement.check`

Compares code against the Agreement's interfaces and acceptance criteria. Classifies findings into 5 types:

| Finding | Severity | Meaning |
|---------|----------|---------|
| `BREAKING` | Blocks merge | Interface removed or incompatibly changed |
| `DEGRADATION` | Blocks merge | Non-functional constraint violated |
| `DRIFT` | Informational | Code evolved beyond agreement scope |
| `ORPHAN` | Warning | Watched path no longer exists |
| `UNTESTED` | Warning | Acceptance criterion has no test coverage |

Supports `diff` mode: analyses only files changed in the current branch and finds impacted agreements automatically.

### `/agreement.doctor`

Reads the check report, extracts BREAKING and DEGRADATION findings, and generates self-contained fix tasks in Spec Kit format. Each task includes the exact file path, current vs. expected behavior, and a reference to the contract file. Tasks are appended as a new phase in `tasks.md` and can be executed directly by `/speckit.implement`.

## Workflows

### New feature

```
/agreement.create  My new feature
/speckit.specify   My new feature
/speckit.plan      Tech stack details
/agreement.sync    001-my-feature
```

### Pre-merge check (pass)

```
/agreement.check diff    → PASS → merge
```

### Pre-merge check (fail → repair → pass)

```
/agreement.check diff                → FAIL + check-report.md
/agreement.doctor 001-my-feature     → corrective tasks in tasks.md
/speckit.implement                   → applies fixes
/agreement.check 001-my-feature      → PASS → merge
```

## Agreement Structure

```yaml
agreement_version: "1.0"

# ── Identity ──────────────────────
feature_id: "001-feature-name"
title: "Human-readable title"
status: "draft" | "active" | "deprecated" | "superseded"
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
owner: "person_name"

# ── Product Intent ────────────────
intent: |
  One paragraph max describing the user promise
user_outcomes:
  - "Outcome 1"
  - "Outcome 2"
acceptance_criteria:
  - criterion: "Verifiable criterion"
    verifiable: true

# ── Interfaces ────────────────────
interfaces:
  - type: "api"           # api | schema | event | cli | ui
    path: "POST /api/books"
    contract: "Creates a book (title, author required) → 201 | 400 | 409"
  - type: "schema"
    path: "books"
    contract: "Table with id, title, author, isbn (unique), year, genre, timestamps"

# ── Non-Functional Constraints ────
constraints:
  - type: "performance"
    description: "Response time < 200ms p95 for all CRUD operations"

# ── Breaking Change Policy ────────
breaking_changes:
  policy: "agreement-first"
  history: []

# ── Traceability ──────────────────
references:
  bmad:
    - ".bmad_output/planning-artifacts/prd.md"
  speckit:
    - "specs/001-feature-name/spec.md"
    - "specs/001-feature-name/contracts/api.md"
  code:
    - "src/routes/books.js"

# ── Drift Detection ───────────────
watched_paths:
  bmad:
    - ".bmad_output/planning-artifacts/prd.md"
  speckit:
    - "specs/001-feature-name/contracts/books-api.md"
  code:
    - "src/routes/books.js"

checksums: {}
```

## Files Installed

```
.agreements/                          # your agreements live here
├── agreement.md                      # documentation
├── index.yaml                        # global registry
├── config.yaml                       # project settings
├── _templates/
│   └── agreement.tpl.yaml            # agreement template
└── ###-feature-name/
    ├── agreement.yaml                # one agreement per feature
    └── check-report.md               # drift report (generated by /agreement.check)

.claude/commands/                     # Claude Code slash commands
├── agreement.create.md
├── agreement.sync.md
├── agreement.check.md
└── agreement.doctor.md
```

## Key Principles

- **Short** — ~50 lines of YAML; captures the promise, not the details
- **Reference, don't duplicate** — details stay in PRD (BMAD) and spec (Spec Kit)
- **Agreement-first** — any interface change goes through the Agreement before code
- **Never silent** — `/agreement.sync` proposes, user confirms
- **Progressive** — can create an Agreement at any point in the development cycle
- **Resilient** — no modification to BMAD or Spec Kit core files; uses `customize.yaml` (BMAD) and `agreement.*` namespace (Claude Code)

## Options

```
npx agreement-system init --skip-bmad    # skip BMAD integration
npx agreement-system init --force-bmad   # force BMAD integration even if not detected
npx agreement-system init --yes          # skip confirmation prompts
```

## Requirements

- Node.js 18+
- Claude Code (for slash commands)
- BMAD and/or Spec Kit (optional, enhances the experience)

## License

MIT
