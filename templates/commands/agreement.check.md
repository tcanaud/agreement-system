---
description: Detect drift between an Agreement and the actual codebase — identify breaking changes and interface violations.
handoffs:
  - label: Fix code to match Agreement
    agent: agreement.doctor
    prompt: Generate corrective tasks from the check report
    send: true
  - label: Sync Agreement
    agent: agreement.sync
    prompt: Synchronize the agreement with all artifacts
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

Analyze the current codebase (or a specific diff) against one or more Agreements to detect breaking changes, interface violations, and acceptance criteria drift. This is the "code vs. promise" verification.

## Execution Flow

### 1. Determine scope

**If `$ARGUMENTS` contains a feature_id:**
- Check that Agreement at `.agreements/{{feature_id}}/` — if not found, ERROR.

**If `$ARGUMENTS` contains "diff" or "pr":**
- Run `git diff main...HEAD --name-only` (or the appropriate base branch) to get changed files.
- Cross-reference changed files against ALL agreements' `watched_paths.code[]` to find impacted agreements.

**If `$ARGUMENTS` is empty:**
- Load `.agreements/index.yaml`
- Process all active agreements.

### 2. For each Agreement in scope

Load `.agreements/{{feature_id}}/agreement.yaml`.

### 3. Check interfaces

For each entry in `interfaces[]`:

a. **API interfaces** (`type: api`):
   - Find the route/endpoint in the codebase using the `path` field
   - Compare: HTTP method, route path, request/response shape
   - Flag: removed endpoints, changed parameters, changed response structure

b. **Schema interfaces** (`type: schema`):
   - Find model/entity definitions in code
   - Compare: field names, field types, required fields
   - Flag: removed fields, type changes, new required fields

c. **Event interfaces** (`type: event`):
   - Find event definitions/emissions in code
   - Compare: event name, payload structure
   - Flag: removed events, changed payloads

d. **CLI interfaces** (`type: cli`):
   - Find command definitions
   - Compare: command names, flags, arguments
   - Flag: removed commands, changed flags

e. **UI interfaces** (`type: ui`):
   - Check that referenced components/pages exist
   - Flag: removed components, changed routes

### 4. Check acceptance criteria

For each `acceptance_criteria[]` entry:
- Determine if the criterion is still achievable given the current code
- Look for test files that validate the criterion
- Flag: criteria that can no longer be met, untested criteria

### 5. Check watched paths

For each path in `watched_paths.code[]`:
- Check if the file/directory still exists
- If using diff mode: check if any watched file was modified
- Flag: deleted watched paths, modified watched files

### 6. Classify findings

Each finding gets a classification:

| Type | Breaking? | Description |
|------|-----------|-------------|
| `BREAKING` | Yes | Interface removed or incompatibly changed |
| `DEGRADATION` | Possibly | Non-functional constraint violated |
| `DRIFT` | No | Code evolved beyond Agreement scope |
| `ORPHAN` | No | Watched path no longer exists |
| `UNTESTED` | No | Acceptance criterion has no corresponding test |

### 7. Present report

```markdown
## Agreement Check: {{feature_id}}

**Checked against**: [branch/commit or "current HEAD"]
**Date**: {{date}}

### Summary
- Breaking changes: N
- Degradations: N
- Drift: N
- Orphans: N

### Breaking Changes (action required)

| # | Interface | Type | Description | Agreement line |
|---|-----------|------|-------------|----------------|
| 1 | POST /api/users | api | Endpoint removed | interfaces[0] |

### Degradations (review recommended)

| # | Constraint | Description |
|---|------------|-------------|
| 1 | performance | Response time increased beyond threshold |

### Drift (informational)

| # | Description | Impacted paths |
|---|-------------|----------------|
| 1 | New endpoint added not in Agreement | src/api/new-route.ts |

### Verdict

**[PASS]** No breaking changes detected.
or
**[FAIL]** N breaking changes require Agreement update before merge.
```

### 8. Write check report (FAIL only)

If the verdict is FAIL, write the full report to `.agreements/{{feature_id}}/check-report.md`.

The file MUST include ALL findings with enough detail for `/agreement.doctor` to generate corrective tasks:

```markdown
# Check Report: {{feature_id}}

**Date**: {{date}}
**Branch**: {{branch}}
**Verdict**: FAIL

## Findings

### FINDING-001 [BREAKING]
- **Interface**: {{interface path}} ({{type}})
- **Agreement says**: {{what the agreement/contract specifies}}
- **Code does**: {{what the code actually does}}
- **File**: {{exact file path}}:{{line number if possible}}
- **Contract reference**: {{path to contract file and section}}

### FINDING-002 [BREAKING]
...

### FINDING-NNN [DRIFT]
...
```

Each finding MUST include:
- The severity tag: `[BREAKING]`, `[DEGRADATION]`, `[DRIFT]`, `[ORPHAN]`, `[UNTESTED]`
- What the Agreement/contract says (the expected behavior)
- What the code does (the actual behavior)
- The exact file path to modify
- The contract file path that serves as source of truth

### 9. Recommend actions

If FAIL:
```
Check report written to: .agreements/{{feature_id}}/check-report.md

If the contract is the source of truth (fix code):
  /agreement.doctor {{feature_id}}  → generates corrective tasks in tasks.md
  /speckit.implement                → applies the fixes
  /agreement.check {{feature_id}}   → re-verify → PASS

If the code is the source of truth (update agreement):
  /agreement.sync {{feature_id}}    → update the agreement to match code
  /agreement.check {{feature_id}}   → re-verify → PASS
```

If PASS:
```
Agreement is aligned with code. No action needed.
```

## Rules

- This command is READ-ONLY except for writing check-report.md.
- It reports findings, the user decides what to do.
- BREAKING changes should block merge (recommendation, not enforcement).
- When in doubt about whether a change is breaking, classify as DRIFT (not BREAKING).
- Keep the report concise. Group similar findings.
- If no interfaces are defined in the Agreement, warn that drift detection is limited.
- check-report.md is overwritten on each run.
