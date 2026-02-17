---
description: Create a new Agreement for a feature — the shared promise between product, implementation, and code.
handoffs:
  - label: Sync with existing artifacts
    agent: agreement.sync
    prompt: Synchronize the agreement with existing BMAD and Spec Kit artifacts
    send: true
  - label: Create Spec Kit specification
    agent: speckit.specify
    prompt: Create a specification based on the agreement
  - label: Create BMAD PRD
    agent: bmad-agent-bmm-pm
    prompt: Create a PRD referencing this agreement
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Purpose

Create a new Agreement — a lightweight, versioned artifact that represents a shared promise between product (BMAD), implementation (Spec Kit), and code. The Agreement is a convergence point, not a specification or a plan.

## Execution Flow

### 0. Load configuration

Read `.agreements/config.yaml` and extract all paths:
- `bmad_dir` — BMAD installation directory (or null)
- `bmad_config` — BMAD config file path (or null)
- `bmad_artifacts_dir` — BMAD planning artifacts directory (or null)
- `speckit_dir` — Spec Kit installation directory (or null)
- `speckit_specs_dir` — Spec Kit specs directory (default: "specs")
- `default_owner` — Default owner for new agreements
- `breaking_change_policy` — Breaking change policy

If `.agreements/config.yaml` does not exist, ERROR "Config not found. Run `npx agreement-system init` first."

All subsequent steps use these config values instead of hardcoding paths.

### 1. Determine feature identity

**If `$ARGUMENTS` contains a feature description (new feature):**

a. Generate a concise short name (2-4 words, kebab-case) from the description.

b. Find the next available feature number by checking all three sources:
   - Remote branches: `git ls-remote --heads origin | grep -E 'refs/heads/[0-9]+'`
   - Local branches: `git branch | grep -E '^[* ]*[0-9]+'`
   - Specs directories: check `{{speckit_specs_dir}}/` for existing `###-*` directories
   - Agreements directories: check `.agreements/` for existing `###-*` directories

c. Use the highest number found + 1. If none found, start at 001.

d. The feature_id is `###-short-name` (e.g., `001-user-auth`).

**If `$ARGUMENTS` references an existing feature (e.g., "001-user-auth"):**

a. Use that feature_id directly.

b. Check if an Agreement already exists at `.agreements/{{feature_id}}/agreement.yaml`.
   - If yes: ERROR "Agreement already exists. Use `/agreement.sync` to update it."

### 2. Detect existing artifacts

Scan for existing BMAD, Spec Kit, and ADR artifacts related to this feature:

- **BMAD**: If `bmad_artifacts_dir` is not null, check `{{bmad_artifacts_dir}}/` for PRD, architecture, stories that mention the feature.
- **Spec Kit**: Check `{{speckit_specs_dir}}/{{feature_id}}/` for spec.md, plan.md, tasks.md
- **ADR**: If `.adr/` exists, find ADRs that apply to this feature's scope:
  - Always include all global ADRs (`.adr/global/`)
  - For domain/local ADRs, match `scope.applies_to` globs against the feature's code paths (from Spec Kit artifacts or `$ARGUMENTS`)
  - Only include active ADRs (status: proposed or accepted)
- Report what was found (may be nothing — that's fine)

### 3. Create the Agreement

a. Load the template from `.agreements/_templates/agreement.tpl.yaml`.

b. Fill in the identity section:
   - `feature_id`: the determined ID
   - `title`: from user description or extracted from existing artifacts
   - `status`: "draft"
   - `created` / `updated`: today's date (YYYY-MM-DD)
   - `owner`: use `default_owner` from config. If empty, use `git config user.name`. If neither, ask.

c. Fill in the product intent:

   **If BMAD artifacts exist**: Extract the intent from the PRD or stories. Summarize in one paragraph.

   **If Spec Kit spec exists**: Extract the intent from spec.md user scenarios. Summarize in one paragraph.

   **If neither exists**: Use `$ARGUMENTS` as the intent. Ask the user to describe the promise in one paragraph if the description is too vague.

d. Fill `user_outcomes`: Extract or ask (1-3 outcomes max).

e. Fill `acceptance_criteria`: Extract from existing artifacts or ask (1-5 criteria max, each must be verifiable).

f. Fill `interfaces`: Extract from Spec Kit plan.md/contracts/ if they exist. Otherwise leave empty with a comment `# To be filled during /speckit.plan`.

g. Fill `constraints`: Extract from existing artifacts if available. Otherwise leave empty.

h. Fill `references`:
   - `bmad`: paths to any BMAD artifacts found
   - `speckit`: paths to any Spec Kit artifacts found
   - `code`: leave empty unless code already exists
   - `adr`: paths to active ADRs that apply to this feature (found in step 2)

i. Fill `watched_paths`:
   - `bmad`: BMAD artifact paths to monitor
   - `speckit`: Spec Kit artifact paths to monitor
   - `code`: relevant source paths if known

### 4. Write the Agreement

a. Create directory `.agreements/{{feature_id}}/`

b. Write the Agreement to `.agreements/{{feature_id}}/agreement.yaml`

### 5. Update the registry

a. Read `.agreements/index.yaml`

b. Add a new entry to the `agreements` list:
   ```yaml
   - feature_id: "{{feature_id}}"
     title: "{{title}}"
     status: "draft"
     path: ".agreements/{{feature_id}}/agreement.yaml"
     created: "{{date}}"
     updated: "{{date}}"
   ```

c. Write the updated index.

### 6. Report

Display a summary:

```
Agreement created: {{feature_id}}
Path: .agreements/{{feature_id}}/agreement.yaml
Status: draft

Artifacts detected:
  BMAD:    [list or "none"]
  SpecKit: [list or "none"]
  ADR:     [list or "none"]
  Code:    [list or "none"]

Next steps:
  - /agreement.sync    → enrich from existing artifacts
  - /speckit.specify   → create implementation spec
  - /bmad-agent-bmm-pm → create product PRD
```

## Rules

- The Agreement MUST remain short (aim for < 50 lines of YAML content).
- Do NOT duplicate content from BMAD or Spec Kit — reference it.
- Do NOT include implementation details — that's Spec Kit's job.
- Do NOT include full product vision — that's BMAD's job.
- The Agreement captures the PROMISE, not the details.
- Always write valid YAML. Use `|` for multi-line strings.
