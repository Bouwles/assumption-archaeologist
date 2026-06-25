// Fixture: a tiny job scheduler that carries several unwritten, load-bearing
// assumptions. Used to smoke-test `/assumptions:search`. None of these are
// documented or guarded on purpose.

const jobs = [];

function scheduleJob(ts, fn) {
  // new Date(ts) with no timezone handling — a local-time string fires hours off.
  const when = new Date(ts).getTime();
  jobs.push({ when, fn });
}

function nextJobAfter(now) {
  // Binary search — only correct if `jobs` is already sorted ascending by `when`.
  let lo = 0;
  let hi = jobs.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (jobs[mid].when >= now) {
      ans = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return ans === -1 ? null : jobs[ans];
}

function chargeOwner(session, cents) {
  // session.user is dereferenced with no auth/null guard — throws on anonymous hits.
  return billing.charge(session.user.id, cents);
}

module.exports = { scheduleJob, nextJobAfter, chargeOwner };
