const createStore = require('./jsonStore');

// vouches.json shape: { [targetUserId]: [ { voucherId, comment, timestamp, scam }, ... ] }
// `scam: true` means this entry came from a "scam vouch @user" report
// rather than a normal vouch — it's kept separate so it never counts
// toward someone's public vouch total.
const store = createStore('vouches.json', {});

function addVouch(targetId, voucherId, comment, scam = false) {
  const all = store.all();
  const list = all[targetId] || [];
  list.push({ voucherId, comment: comment || null, timestamp: Date.now(), scam: !!scam });
  store.set(targetId, list);
  return list.length;
}

function getVouches(targetId) {
  return store.get(targetId) || [];
}

// Every entry for every user, keyed by userId — used by the leaderboards.
function getAll() {
  return store.all();
}

module.exports = { addVouch, getVouches, getAll };
