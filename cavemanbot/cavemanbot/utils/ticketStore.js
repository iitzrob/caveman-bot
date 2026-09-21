const createStore = require('./jsonStore');

const store = createStore('tickets.json', {});

module.exports = {
  add(channelId, meta) {
    store.set(channelId, meta);
  },
  get(channelId) {
    return store.get(channelId);
  },
  remove(channelId) {
    store.delete(channelId);
  },
  // Merges `patch` into the existing meta for channelId (e.g. setting
  // claimedBy, or linking an application to a ticket it opened).
  update(channelId, patch) {
    const current = store.get(channelId) || {};
    const updated = { ...current, ...patch };
    store.set(channelId, updated);
    return updated;
  },
  all() {
    return store.all();
  },
  // Finds an existing open ticket/application for a user in a given category,
  // so people can't spam-open duplicates.
  findOpenByUser(userId, category) {
    const all = store.all();
    return Object.entries(all).find(
      ([, meta]) => meta.openerId === userId && meta.category === category
    );
  },
};
