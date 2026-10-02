const createStore = require('./jsonStore');
const cfg = require('../schematicConfig');

// data/schematics.json:
//   weekly        userId -> posts this week (reset every Monday with the points)
//   channelCounts destination channel id -> total posts there (for the 10 / 30 messages)
//   known         fingerprints of every schematic ever posted (to block repeats)
const store = createStore('schematics.json', { weekly: {}, channelCounts: {}, known: {} });

function getMap(key) {
  return store.get(key) || {};
}

// ---------- repeat blocking ----------

function nameKey(fileName) {
  return 'n:' + baseName(fileName).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function hashKey(hash) {
  return 'h:' + hash;
}

// keys = list of fingerprint keys for the files in a post. Returns the stored
// record of the first one that was already posted, or null if all are new.
function findDuplicate(keys) {
  const known = getMap('known');
  for (const key of keys) {
    if (known[key]) return known[key];
  }
  return null;
}

function rememberAll(keys, info) {
  const known = getMap('known');
  for (const key of keys) known[key] = info;
  store.set('known', known);
}

// ---------- weekly posts ----------

function addPost(userId) {
  const weekly = getMap('weekly');
  weekly[userId] = (weekly[userId] || 0) + 1;
  store.set('weekly', weekly);
  return weekly[userId];
}

function getWeekly() {
  return getMap('weekly');
}

function resetWeekly() {
  store.set('weekly', {});
}

// ---------- per-channel counter ----------

function bumpChannelCount(channelId) {
  const counts = getMap('channelCounts');
  counts[channelId] = (counts[channelId] || 0) + 1;
  store.set('channelCounts', counts);
  return counts[channelId];
}

// ---------- file name parsing ----------

function baseName(fileName) {
  return String(fileName || '').replace(/\.[^.]+$/, '');
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Looks at the file names for a creator name from config.creators. Returns
// { creatorId, creatorName } or nulls. Separators are ignored, so
// "void_view" or "Void-View" still match "voidview".
function findCreator(fileNames) {
  for (const fileName of fileNames) {
    const squashed = baseName(fileName).toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const [name, userId] of Object.entries(cfg.creators || {})) {
      const wanted = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (wanted && squashed.includes(wanted)) return { creatorId: userId, creatorName: name };
    }
  }
  return { creatorId: null, creatorName: null };
}

// "voidview_christmas_tree_gamble.litematic" -> "Christmas Tree Gamble"
function makeTitle(fileName, creatorName) {
  let text = baseName(fileName);

  if (creatorName) {
    // Remove the creator name (and a "by" in front of it); the name may have
    // separators between its letters.
    const loose = [...creatorName.replace(/[^A-Za-z0-9]/g, '')].map(escapeRegex).join('[\\s_\\-.]*');
    if (loose) text = text.replace(new RegExp('(?:\\bby[\\s_\\-.]+)?' + loose + '(?:[\'’]?s\\b)?', 'gi'), ' ');
  }

  text = text
    .replace(/[_.]+/g, ' ')
    .replace(/(^|\s)[-–—]+(\s|$)/g, ' ')
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—]+|[\s\-–—]+$/g, '')
    .trim();

  if (!text) return 'Schematic';

  // Capitalise words that are fully lowercase; leave anything else as typed.
  return text
    .split(' ')
    .map((word) => (word === word.toLowerCase() ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

module.exports = {
  nameKey,
  hashKey,
  findDuplicate,
  rememberAll,
  addPost,
  getWeekly,
  resetWeekly,
  bumpChannelCount,
  findCreator,
  makeTitle,
};
