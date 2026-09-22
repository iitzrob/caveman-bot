const createStore = require('./jsonStore');

// { userId: { count: number, lastAt: number (ms timestamp) } }
const store = createStore('builds.json', {});

// Records a finished build for userId — bumps their count and stamps
// lastAt so the cooldown in /build-finish has something to check against.
function recordFinish(userId) {
  const current = store.get(userId) || { count: 0, lastAt: 0 };
  const updated = { count: current.count + 1, lastAt: Date.now() };
  store.set(userId, updated);
  return updated;
}

// Milliseconds left before userId can use /build-finish again, or 0 if
// they're clear. cooldownMs is passed in so this file doesn't need to know
// the actual cooldown length.
function getCooldownRemaining(userId, cooldownMs) {
  const current = store.get(userId);
  if (!current || !current.lastAt) return 0;
  const elapsed = Date.now() - current.lastAt;
  return Math.max(0, cooldownMs - elapsed);
}

function getAll() {
  return store.all();
}

module.exports = { recordFinish, getCooldownRemaining, getAll };
