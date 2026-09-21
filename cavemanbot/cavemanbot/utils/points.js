const createStore = require('./jsonStore');

const store = createStore('points.json', {});

function addPoints(userId, amount) {
  const current = store.get(userId) || 0;
  const updated = current + amount;
  store.set(userId, updated);
  return updated;
}

function getPoints(userId) {
  return store.get(userId) || 0;
}

function getAll() {
  return store.all();
}

function resetAll() {
  store.overwriteAll({});
}

module.exports = { addPoints, getPoints, getAll, resetAll };
