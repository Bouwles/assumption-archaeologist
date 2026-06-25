# Assumption Archaeologist — Design Spec

**Date:** 2026-06-25
**Status:** approved-pending-review

## Problem

Code is full of implicit assumptions that were never written down: "this always
runs in UTC", "this list is already sorted", "the user is authenticated by the
time we reach here", "this value is never null", "this only runs single-threaded".
These are load-bearing — when one turns out false in production, it's a bug — yet
nobody documents them. Assumption Archaeologist surfaces them into a living
`ASSUMPTIONS.md` and tracks each one's lifecycle.

## Scope decisions (locked)

- **Command-driven only. Never auto-active.** No hooks. Analysis runs only when the
  user invokes a command, to avoid wasting tokens on every edit.
- **Two commands**, namespace `assumptions`:
  - `/assumptions:search` — find load-bearing implicit assumptions, record them.
  - `/assumptions:verify` — re-check recorded assumptions, update their status.
- **Default scan scope:** git-changed files (vs HEAD). `<path>` or `--all` override.
- **Reporting bar:** load-bearing only — record an assumption only if being wrong
  about it would cause a real bug. Skip trivia. Keeps the doc signal-dense.
- **Lifecycle:** stable per-assumption ID + status, maintained by a small JS engine
  that preserves human edits and dedupes.
- **No subagent.** The invoking Claude does the semantic analysis inline (the user
  deselected a separate hunter agent).

## Why almost no detector code

Assumptions are implicit and semantic. There is no reliable regex for "this list is
always sorted." Claude finds them, guided by the command prompt. Deterministic code
is justified only for the part that *is* deterministic: maintaining the living
`ASSUMPTIONS.md` (stable IDs, dedupe, status, render). That is the single JS module.

## File layout

```
Assumption Archaelogist/
  .claude-plugin/
    marketplace.json        # marketplace wrapper (one plugin)
    plugin.json             # plugin manifest — NO hooks key
  commands/
    search.md               # /assumptions:search
    verify.md               # /assumptions:verify
  src/
    index.js                # ASSUMPTIONS.md merge/maintenance engine (only JS)
  test/
    run.js                  # assert-based: round-trip + ID stability + status preserve
  test-fixtures/
    utc-scheduler.js        # code carrying known load-bearing assumptions
  README.md
  package.json
  .gitignore
```

## ASSUMPTIONS.md format

Lives at the scanned repo root. Single living artifact AND source of truth. Each
entry is anchored by a durable HTML-comment marker so humans can freely edit the
prose while the engine keys off the marker and the `Status:` line.

```markdown
### AA-3f9c · `src/scheduler.js` · scheduleJob()
<!-- aa:id=AA-3f9c file=src/scheduler.js hash=3f9c2a1b -->
- **Assumption:** timestamps passed in are always UTC
- **Load-bearing because:** scheduleJob() does `new Date(ts)` with no timezone — a
  local-time input fires the job hours off
- **Risk:** high
- **Status:** unverified   ·   **First seen:** 2026-06-25
- **Notes:** _(free text, human-owned, preserved verbatim)_
```

- ID: `AA-<short hash of file path + normalized claim>`. Content-based, so it
  survives line moves and reformatting. (Ceiling: a file rename or a reworded claim
  mints a new ID — acceptable; the stale old entry is caught by `verify`.)
- Entries are grouped by risk (high → low), then file.
- A header/legend at the top explains the status values.

### Status values

| Status | Meaning | Set by |
|---|---|---|
| `unverified` | newly found, not yet judged | `search` (default for new) |
| `confirmed` | a human confirmed it's a real, intended assumption | human (or `verify` on request) |
| `addressed` | code now guards/documents it (assert, default, type, comment) | `verify` |
| `stale` | the assumption is no longer present in the code | `verify` |

## Engine: `src/index.js`

Node, no dependencies. Reads/writes `ASSUMPTIONS.md` at a given root (default cwd).

Subcommands:

- `merge --input <findings.json> [--root <dir>]`
  - `findings.json`: `[{ file, symbol, claim, rationale, risk }]`
  - For each finding: compute `id` from `file + normalize(claim)`; if marker with
    that id exists → keep its `Status` and `First seen` and `Notes`, refresh
    symbol/rationale/risk; else → append with `status: unverified`, first-seen =
    today.
  - Entries whose files were NOT in this batch are left untouched (scan is scoped).
  - Re-render the whole file (grouped, sorted), preserving human Notes verbatim.
  - Print a summary: N new, M refreshed, total.

- `list [--json] [--root <dir>]`
  - Emit current entries (id, file, symbol, claim, risk, status). `verify` iterates
    these.

- `set-status --id <AA-xxxx> --status <unverified|confirmed|addressed|stale> [--root <dir>]`
  - Update one entry's `Status` line, preserve everything else. `verify` calls this.

Parser: split on `<!-- aa:id=... -->` markers; pull structured fields from labeled
lines; treat the `Notes:` block as opaque preserved text. Renderer is the inverse.

## Command flows

### `/assumptions:search` (`commands/search.md`)
1. Resolve target from `$ARGUMENTS`: a path → that; `--all` → whole repo; default →
   `git diff --name-only HEAD` files.
2. Read those files. Identify **load-bearing implicit assumptions** — things the code
   relies on but never states or guards. Skip anything trivial or already asserted.
3. For each, capture `{ file, symbol, claim, rationale (the concrete bug if false),
   risk }`. Write the array to a temp JSON.
4. `node "${CLAUDE_PLUGIN_ROOT}/src/index.js" merge --input <temp.json>` to update
   `ASSUMPTIONS.md`.
5. Summarize new/refreshed entries to the user. Code is never modified.

### `/assumptions:verify` (`commands/verify.md`)
1. `node "${CLAUDE_PLUGIN_ROOT}/src/index.js" list --json`.
2. For each entry, re-read the cited file/symbol:
   - assumption now guarded or documented → `set-status addressed`
   - assumption no longer in the code at all → `set-status stale`
   - still present and unguarded → leave as-is
3. Report what changed. Code is never modified.

## Testing (`test/run.js`)

assert-based, no framework. Covers the non-trivial engine logic:
- round-trip: render → parse → render is stable
- merge dedupe: same claim twice → one entry, ID unchanged
- status preserved: merge over an entry already `confirmed` keeps `confirmed` and its
  Notes
- ID stability: same file + claim with different line numbers → same ID
- `test-fixtures/utc-scheduler.js` exists as a realistic carrier of assumptions for
  manual `/assumptions:search` smoke testing.

## Out of scope (YAGNI)

- PostToolUse hook / always-on scanning — explicitly excluded to save tokens.
- Separate analysis subagent.
- Auto-fixing code (the plugin documents assumptions; it never edits source).
- CI integration, severity config files — add later only if needed.
```
