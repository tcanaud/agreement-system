---
description: Synchronize an Agreement with existing BMAD and Spec Kit artifacts — detect drift and propose updates.
handoffs:
  - label: Check for code drift
    agent: agreement.check
    prompt: Check if the code has drifted from the agreement
    send: true
  - label: Create Agreement
    agent: agreement.create
    prompt: Create a new agreement
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Purpose

Synchronize an existing Agreement with the current state of BMAD artifacts, Spec Kit artifacts, and code. Detect drift, qualify changes, and propose targeted updates to the Agreement.

## Execution Flow

### 0. Load configuration

Read `.agreements/config.yaml` and extract all paths:
- `bmad_dir` — BMAD installation directory (or null)
- `bmad_config` — BMAD config file path (or null)
- `bmad_artifacts_dir` — BMAD planning artifacts directory (or null)
- `speckit_dir` — Spec Kit installation directory (or null)
- `speckit_specs_dir` — Spec Kit specs directory (default: "specs")
- `default_owner` — Default owner for new agreements

If `.agreements/config.yaml` does not exist, ERROR "Config not found. Run `npx agreement-system init` first."

All subsequent steps use these config values instead of hardcoding paths.

### 1. Identify the target Agreement

**If `$ARGUMENTS` specifies a feature_id** (e.g., "001-user-auth"):
- Load `.agreements/{{feature_id}}/agreement.yaml`
- If not found: ERROR "No Agreement found for {{feature_id}}. Use `/agreement.create` first."

**If `$ARGUMENTS` is empty or "all":**
- Load `.agreements/index.yaml`
- List all agreements with status != "deprecated"
- Ask user to pick one, or process all sequentially

### 2. Load the current Agreement

Read `.agreements/{{feature_id}}/agreement.yaml` and parse all sections.

### 3. Scan BMAD artifacts

a. Check paths listed in `references.bmad[]`
b. If `bmad_artifacts_dir` is not null, also scan `{{bmad_artifacts_dir}}/` for planning artifacts mentioning the feature_id or title
c. For each BMAD artifact found, extract:
   - Product intent / vision statements
   - User outcomes / goals
   - Acceptance criteria
   - Any breaking changes mentioned

### 4. Scan Spec Kit artifacts

a. Check paths listed in `references.speckit[]`
b. Also scan `{{speckit_specs_dir}}/{{feature_id}}/` for spec.md, plan.md, tasks.md, contracts/
c. For each Spec Kit artifact found, extract:
   - Interfaces (from plan.md and contracts/)
   - Non-functional constraints
   - Acceptance criteria (from spec.md)
   - Implementation decisions that affect the promise

### 5. Scan ADRs

a. Check paths listed in `references.adr[]` — for each referenced ADR:
   - Verify the file still exists
   - Parse frontmatter and check `status`
   - If status is "superseded by ..." → flag as drift (the superseding ADR may change constraints)
   - If status is "deprecated" → flag as drift (constraint may no longer apply)

b. If `.adr/` exists, scan for NEW ADRs that apply to this feature but are not yet referenced:
   - Include all global ADRs from `.adr/global/`
   - For domain/local ADRs, match `scope.applies_to` globs against the Agreement's `watched_paths.code[]`
   - Only consider active ADRs (status: proposed or accepted)
   - If a matching ADR is found that is NOT in `references.adr[]`, flag as coverage gap

### 6. Scan code (lightweight)

a. Check paths listed in `watched_paths.code[]`
b. If code paths exist, look for:
   - API route definitions
   - Schema/model definitions
   - Event definitions
   - Exported interfaces/types
c. Do NOT perform deep code analysis — just surface-level interface detection

### 7. Detect drift

Compare current Agreement content against what was found in steps 3-6.

Classify each difference:

| Category | Severity | Description |
|----------|----------|-------------|
| **Intent drift** | HIGH | Product intent in BMAD differs from Agreement |
| **Interface change** | HIGH | API/schema/event changed in code or Spec Kit |
| **ADR superseded** | HIGH | A referenced ADR was superseded — the new ADR may impose different constraints |
| **Criteria mismatch** | MEDIUM | Acceptance criteria differ between sources |
| **New constraint** | MEDIUM | Constraint added in one layer but not Agreement |
| **ADR deprecated** | MEDIUM | A referenced ADR is deprecated — constraint may no longer apply |
| **Reference stale** | LOW | Referenced file moved, renamed, or deleted |
| **Coverage gap** | LOW | New artifact exists but isn't referenced |
| **ADR coverage gap** | LOW | Active ADR applies to this feature's scope but is not in references.adr |

### 8. Present findings

Display a drift report:

```markdown
## Drift Report: {{feature_id}}

**Agreement status**: {{status}}
**Last updated**: {{updated}}

### Findings

| # | Category | Severity | Source | Description |
|---|----------|----------|--------|-------------|
| 1 | Intent drift | HIGH | .bmad_output/prd.md | PRD says "X" but Agreement says "Y" |
| 2 | Interface change | HIGH | specs/001/plan.md | New endpoint POST /api/v2/resource |
| ... | ... | ... | ... | ... |

### No drift detected in:
- [list sections with no drift]
```

**If no drift detected**: Report "Agreement is in sync" and stop.

### 9. Propose updates

For each finding, propose a specific YAML change to the Agreement:

```markdown
### Proposed Update #1: Intent drift
**Current**:
intent: |
  Old intent text

**Proposed**:
intent: |
  Updated intent text reflecting PRD changes

**Reason**: PRD updated on YYYY-MM-DD with new scope
```

### 10. Apply updates (with confirmation)

- Present ALL proposed changes before applying any
- Ask user: "Apply all / Select specific / Skip"
- If user selects specific: present numbered list, accept comma-separated selection
- Apply selected changes to `.agreements/{{feature_id}}/agreement.yaml`
- Update the `updated` field to today's date
- Update `.agreements/index.yaml` with new `updated` date

### 11. Report

```
Sync complete: {{feature_id}}
  Applied: N updates
  Skipped: M updates
  New status: {{status}}
```

## Rules

- NEVER apply changes without user confirmation.
- NEVER modify BMAD, Spec Kit, or ADR artifacts — only the Agreement.
- Keep the Agreement short — summarize, don't duplicate.
- If drift is detected but ambiguous, ask the user to clarify intent.
- Severity HIGH findings should be addressed before continuing development.
