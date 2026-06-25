---
description: Find load-bearing implicit assumptions in the code and record them in a living ASSUMPTIONS.md. Runs only when invoked — never automatically.
argument-hint: "[file/dir path | --all]   (default: git-changed files)"
---

# Assumption Search

Surface **load-bearing implicit assumptions** — things the code silently relies on
but never states or guards — and record them in `ASSUMPTIONS.md` at the repo root.

## Steps

1. **Pick the target** from `$ARGUMENTS`:
   - a file or directory path → scan that
   - `--all` → scan the whole repo (skip vendored / build / dependency dirs like
     `node_modules`, `dist`, `.git`)
   - no args (default) → files from `git diff --name-only HEAD` (changed vs HEAD)

2. **Read the target files** and hunt for implicit assumptions. An assumption
   qualifies **only if it is load-bearing**: being wrong about it would cause a real
   bug. These are example *shapes* — find any unwritten assumption, not just these:
   - temporal — "timestamps are UTC", "runs before the midnight rollover"
   - ordering — "this list is already sorted", "events arrive in order"
   - presence — "the user is authenticated by here", "this field is never null/missing"
   - environment — "single-threaded", "filesystem is writable", "this env var is set"
   - shape / range — "ids are positive ints", "array is non-empty", "amount is in USD"
   Skip anything trivial, already asserted, or already documented right next to it.

3. **For each kept assumption**, capture an object:
   - `file` — repo-relative path
   - `symbol` — the function / class / region it lives in (best effort, may be "")
   - `claim` — the assumption as one plain sentence
   - `rationale` — the concrete bug that happens if it is false
   - `risk` — `high` | `medium` | `low`

4. **Write the findings** as a JSON array to a temp file, then merge them in:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/src/index.js" merge --input <temp-findings.json>
   ```
   The engine assigns stable IDs (`AA-xxxx`), dedupes against existing entries, marks
   new ones `unverified`, refreshes ones already recorded, and preserves any human
   edits and notes. Delete the temp file afterward.

5. **Summarize** the new and refreshed entries to the user: id, file, claim, risk.

## Rules

- Record only load-bearing assumptions. Prefer recording nothing over noise.
- Read-only on source code. The only things you write are `ASSUMPTIONS.md` (via the
  merge tool) and the throwaway findings JSON.
- Never fix or change code here — this command documents assumptions; it does not edit
  source. (Addressing them is the user's call.)
