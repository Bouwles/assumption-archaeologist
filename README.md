# Assumption Archaeologist

A Claude Code plugin that digs up the **implicit assumptions baked into your code that
were never written down** — "this always runs in UTC", "this list is already sorted",
"the user is authenticated by the time we get here", "this value is never null" — and
surfaces them as a living `ASSUMPTIONS.md`.

These unwritten assumptions are exactly the things that cause production bugs, and
nobody documents them. This plugin documents them and tracks whether they still hold.

It is **command-driven only**. It never runs on a hook and never scans in the
background, so it never spends tokens unless you explicitly ask.

## Commands

### `/assumptions:search [path | --all]`
Reads your code and records every **load-bearing** implicit assumption it finds into
`ASSUMPTIONS.md`. Default scope is git-changed files (`git diff HEAD`); pass a path to
scan that, or `--all` for the whole repo. Read-only on your source — the only file it
writes is `ASSUMPTIONS.md`.

"Load-bearing" means: if the assumption turns out false, you get a real bug. Trivia is
skipped on purpose, so the doc stays signal-dense.

### `/assumptions:verify`
Re-checks each assumption already in `ASSUMPTIONS.md` against the current code and
updates its status — marks it `addressed` once the code guards or documents it, or
`stale` once that code is gone. Finds no new assumptions; only verifies existing ones.

## ASSUMPTIONS.md

One living file at your repo root. Each entry:

```markdown
### AA-3f9c · `src/scheduler.js` · scheduleJob()
<!-- aa:id=AA-3f9c file=src/scheduler.js hash=3f9c -->
- **Assumption:** timestamps passed in are always UTC
- **Load-bearing because:** scheduleJob() does `new Date(ts)` with no timezone — a
  local-time input fires the job hours off
- **Risk:** high
- **Status:** unverified   ·   **First seen:** 2026-06-25
- **Notes:** _none_
```

Edit the prose and **Notes** however you like. The tool keys off the hidden `aa:id`
marker, so re-running `/assumptions:search` dedupes, refreshes the details, and
**never clobbers your edits, status, or notes**.

### Status lifecycle

| Status | Meaning |
| --- | --- |
| `unverified` | just found, not yet judged |
| `confirmed` | a human confirmed it's a real, intended assumption |
| `addressed` | the code now guards or documents it |
| `stale` | the assumption is no longer present in the code |

## Install

From the marketplace in this repo:

```
/plugin marketplace add <path-or-repo-to-this-folder>
/plugin install assumptions@assumption-archaeologist
```

## How it works

Finding assumptions is semantic work, so Claude does it (guided by the command
prompts) — there is no brittle regex pretending to detect "this list is sorted". The
only deterministic code (`src/index.js`, zero dependencies) maintains the living doc:
stable content-based IDs, dedupe, the status lifecycle, and a round-trippable render
that preserves your prose.

```
node src/index.js merge --input findings.json   # add/refresh entries
node src/index.js list --json                    # dump current entries
node src/index.js set-status --id AA-xxxx --status addressed
```

## Test

```
npm test
```
