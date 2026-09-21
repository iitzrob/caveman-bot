const createStore = require('./jsonStore');

// vouches.json shape: { [targetUserId]: [ { voucherId, comment, timestamp }, ... ] }
const store = createStore('vouches.json', {});

function addVouch(targetId, voucherId, comment) {
  const all = store.all();
  const list = all[targetId] || [];
  list.push({ voucherId, comment: comment || null, timestamp: Date.now() });
  store.set(targetId, list);
  return list.length;
}

function getVouches(targetId) {
  return store.get(targetId) || [];
}

module.exports = { addVouch, getVouches };
