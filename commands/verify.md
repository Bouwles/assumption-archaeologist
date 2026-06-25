---
description: Re-check assumptions already recorded in ASSUMPTIONS.md against the current code and update each one's status (addressed / stale). Runs only when invoked.
argument-hint: "(no args — re-checks every recorded assumption)"
---

# Assumption Verify

Re-examine the assumptions already in `ASSUMPTIONS.md` and update each one's lifecycle
status against the current code. This does **not** look for new assumptions — that is
`/assumptions:search`.

## Steps

1. **List recorded assumptions:**
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/src/index.js" list --json
   ```
   If the output is empty (or the file does not exist), tell the user there is nothing
   to verify and stop.

2. **For each entry**, re-read the cited `file` / `symbol` and judge:
   - the assumption is now **guarded or documented** in the code (an assert, default
     value, null-check, type, validation, or an explanatory comment) → `addressed`
   - the assumption is **no longer present** in the code at all (that code path was
     removed or rewritten away) → `stale`
   - the assumption is **still present and unguarded** → leave it unchanged

3. **Apply each status change**, one per entry:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/src/index.js" set-status --id AA-xxxx --status addressed
   ```

4. **Report** what changed: which became `addressed`, which went `stale`, which still
   stand. Offer to let the user delete the `stale` ones if they agree.

## Rules

- Read-only on source code. Only `ASSUMPTIONS.md` is modified (via `set-status`).
- Do not invent new assumptions here. Only verify the ones already recorded.
- Be conservative: if you are unsure whether something is truly guarded now, leave the
  status unchanged.
- Never set `confirmed` automatically — that status means a human vouched for the
  assumption being real and intended.
