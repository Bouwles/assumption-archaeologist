'use strict';

// assert-based checks for the ASSUMPTIONS.md engine. No framework.
//   node test/run.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const eng = require('../src/index');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('  ok  ' + name);
}

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aa-test-'));
}

const finding = {
  file: 'src/scheduler.js',
  symbol: 'scheduleJob()',
  claim: 'timestamps passed in are always UTC',
  rationale: 'new Date(ts) with no tz — local-time input fires hours off',
  risk: 'high',
};

check('makeId is stable across line moves / wording noise', () => {
  const a = eng.makeId('src/scheduler.js', 'timestamps passed in are always UTC');
  const b = eng.makeId('src/scheduler.js', 'Timestamps  passed in   are always UTC!!');
  assert.strictEqual(a.id, b.id, 'normalized claim should yield same id');
  assert.ok(/^AA-[0-9a-f]{4}$/.test(a.id), 'id format AA-xxxx');
});

check('merge records a new entry as unverified with today first-seen', () => {
  const root = tmpRoot();
  const r = eng.merge([finding], root);
  assert.strictEqual(r.added, 1);
  assert.strictEqual(r.total, 1);
  const entries = eng.list(root);
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].status, 'unverified');
  assert.strictEqual(entries[0].risk, 'high');
  assert.strictEqual(entries[0].firstSeen, new Date().toISOString().slice(0, 10));
});

check('merge dedupes identical claims to one entry', () => {
  const root = tmpRoot();
  const r = eng.merge([finding, finding], root);
  assert.strictEqual(r.total, 1, 'two identical findings → one entry');
});

check('round-trip render -> parse -> render is stable', () => {
  const root = tmpRoot();
  eng.merge([finding, { ...finding, file: 'src/sort.js', symbol: 'nextJob()', claim: 'jobs list is already sorted', risk: 'medium' }], root);
  const doc1 = fs.readFileSync(path.join(root, 'ASSUMPTIONS.md'), 'utf8');
  const reparsed = eng.renderDoc([...eng.parseDoc(doc1).values()]);
  assert.strictEqual(reparsed, doc1, 'doc should be a fixed point of parse+render');
});

check('merge preserves human status + notes on an existing entry', () => {
  const root = tmpRoot();
  eng.merge([finding], root);
  const id = eng.makeId(finding.file, finding.claim).id;

  // human confirms it and writes a note
  eng.setStatus(root, id, 'confirmed');
  const docPath = path.join(root, 'ASSUMPTIONS.md');
  fs.writeFileSync(
    docPath,
    fs.readFileSync(docPath, 'utf8').replace('- **Notes:** _none_', '- **Notes:** verified with the on-call runbook')
  );

  // re-running search finds the same assumption with a refined rationale
  eng.merge([{ ...finding, rationale: 'refined: tz-naive Date() drifts the fire time' }], root);

  const e = eng.list(root).find((x) => x.id === id);
  assert.strictEqual(e.status, 'confirmed', 'status must survive a re-merge');
  assert.ok(e.notes.includes('on-call runbook'), 'human note must survive a re-merge');
  assert.ok(e.rationale.includes('refined'), 'rationale should refresh');
});

check('set-status rejects an unknown status', () => {
  const root = tmpRoot();
  eng.merge([finding], root);
  const id = eng.makeId(finding.file, finding.claim).id;
  assert.throws(() => eng.setStatus(root, id, 'banana'), /invalid status/);
});

console.log(`\n${passed} checks passed.`);
