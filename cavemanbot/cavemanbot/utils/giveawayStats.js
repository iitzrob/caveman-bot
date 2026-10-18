const createStore = require('./jsonStore');

// data/giveawayStats.json
//   weekly  userId -> giveaways hosted this week (reset every Monday with the points)
const store = createStore('giveawayStats.json', { weekly: {} });

function getWeekly() {
  return store.get('weekly') || {};
}

function addGiveaway(userId) {
  const weekly = getWeekly();
  weekly[userId] = (weekly[userId] || 0) + 1;
  store.set('weekly', weekly);
  return weekly[userId];
}

function resetWeekly() {
  store.set('weekly', {});
}

module.exports = { getWeekly, addGiveaway, resetWeekly };
