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

// Removes advert text from a file name, like "Join Zyrins Discord For More"
// or "discord.gg/abc", so only the schematic's name is left.
function stripPromo(text) {
  return String(text || '')
    .replace(/(?:https?:\/\/)?discord\.(?:gg|com)\/\S*/gi, ' ')
    .replace(/join[\s_\-.]*[\s\S]*?for[\s_\-.]*more/gi, ' ')
    .replace(/join[\s_\-.]*[\s\S]*?discord/gi, ' ')
    .replace(/(?<![A-Za-z0-9])join(?![A-Za-z]).*$/gi, ' ')
    .replace(/discord/gi, ' ');
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

  // Not in the list: look for a creator written in the file name itself,
  // like "Cool Base by Steve", "Cool Base Made By Steve" or "Steve's Cool Base".
  // Only ONE word is used as the name, and it is written as plain text.
  for (const fileName of fileNames) {
    const text = stripPromo(baseName(fileName)).replace(/[_.]+/g, ' ');
    const match =
      text.match(/(?<![A-Za-z0-9])(?:made|created|built|designed|design|credits?)?\s*by[\s\-:]+([A-Za-z0-9]+)/i) ||
      text.match(/^\s*([A-Za-z0-9]+)['’]s\s/);
    if (!match) continue;
    let name = match[1];
    if (name === name.toLowerCase()) name = name.charAt(0).toUpperCase() + name.slice(1);
    return { creatorId: name, creatorName: name };
  }
  return { creatorId: null, creatorName: null };
}

// "voidview_christmas_tree_gamble.litematic" -> "Christmas Tree Gamble"
function makeTitle(fileName, creatorName) {
  let text = stripPromo(baseName(fileName));

  const keepName = (cfg.keepNameInTitle || []).some((n) => String(n).toLowerCase() === String(creatorName || '').toLowerCase());
  if (creatorName && !keepName) {
    // Remove the creator name (and a "by" in front of it); the name may have
    // separators between its letters.
    const loose = [...creatorName.replace(/[^A-Za-z0-9]/g, '')].map(escapeRegex).join('[\\s_\\-.]*');
    if (loose) text = text.replace(new RegExp('(?:(?<![A-Za-z0-9])(?:(?:made|created|built|designed)[\\s_\\-.]+)?by[\\s_\\-.]+)?' + loose + '(?:[\'’]?s\\b)?', 'gi'), ' ');
  }

  text = text
    .replace(/\(\s*\d+\s*\)\s*$/, ' ') // copy numbers like "(2)"
    .replace(/[_.]+/g, ' ')
    .replace(/(^|\s)[-–—]+(\s|$)/g, ' ')
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—]+|[\s\-–—]+$/g, '')
    .trim();

  if (!text) return 'Schematic';

  // Capitalise words that are fully lowercase; leave anything else as typed.
  const title = text
    .split(' ')
    .map((word) => (word === word.toLowerCase() ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
  console.log(`[schematics] file "${fileName}" -> title "${title}", creator "${creatorName || 'none'}"`);
  return title;
}


// Credit lines the bot understands in a forwarded/posted message. Any of
// these work (bold, no bold, with or without a colon where it is safe):
//   Original Creator: Nevio        Original Designer - Nevio
//   Credits: Nevio                 Credit to Nevio
//   Designed by Nevio              Made by / Built by / Created by Nevio
//   Author: Nevio                  Builder: Nevio
//   <the name can also be a @mention>, or sit on the NEXT line.
// Words like "creator/designer/credit" need a ":" or "-" (or "to") after them,
// so normal sentences such as "without credit or permission" are ignored.
const NOUN_LABEL = /(?:^|[^a-z0-9])(?:orig(?:inal)?\.?\s*)?(?:creators?|designers?|builders?|authors?|credits?)\s*(?:[:\-–—=]+|(?:goes\s+|go\s+)?to\b|is\b)\s*(.*)$/i;
const BY_LABEL = /(?:^|[^a-z0-9])(?:made|built|build|designed|design|created|crafted|schematic)\s*by\s*[:\-–—]?\s*(.+)$/i;
// A line that is ONLY a label (name is on the next line), e.g. "Original Designer".
const BARE_LABEL = /^(?:orig(?:inal)?\.?\s*)?(?:creators?|designers?|builders?|authors?|credits?)\s*[:\-–—]?\s*$/i;

function matchCreditLine(line) {
  const m = line.match(NOUN_LABEL) || line.match(BY_LABEL);
  return m ? m[1] : null;
}

// Reads the text of the forwarded/posted message itself. Looks for
//   **Title line**                      (first line, wrapped in bold)
//   a credit line (see above)
// Returns { title, creatorId, creatorName }, each null when not found.
function readPostText(text) {
  const result = { title: null, creatorId: null, creatorName: null };
  // Only strip formatting characters (not underscores) so @mentions stay intact.
  const strip = (t) => t.replace(/[*~`|]/g, '');
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return result;

  const clean = (t) => strip(t).replace(/^[\s_@]+|[\s_]+$/g, '').trim();

  let creditLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const plain = strip(lines[i]).trim();
    let rest = matchCreditLine(plain);
    if (rest === null && BARE_LABEL.test(plain)) rest = '';
    if (rest === null) continue;

    // Name is on the next line ("**Original Designer**" then "Nevio").
    if (!rest.trim() || BARE_LABEL.test(plain)) {
      const next = lines[i + 1] ? strip(lines[i + 1]).trim() : '';
      if (!next || matchCreditLine(next) !== null || BARE_LABEL.test(next)) continue;
      rest = next;
    }

    const mention = rest.match(/<@!?(\d{15,25})>/);
    if (mention) {
      result.creatorId = mention[1];
      result.creatorName = mention[1];
      creditLineIndex = i;
      break;
    }
    if (/<@&\d+>|<#\d+>/.test(rest)) continue; // roles/channels are not creators

    let value = clean(rest).replace(/\s+/g, ' ');
    if (!value) continue;
    if (value.length > 40) value = value.slice(0, 40).trim();
    // If it is a creator from the config list, use their configured id/name.
    const squashed = value.toLowerCase().replace(/[^a-z0-9]/g, '');
    let configured = null;
    for (const [name, userId] of Object.entries(cfg.creators || {})) {
      if (name.toLowerCase().replace(/[^a-z0-9]/g, '') === squashed) configured = userId;
    }
    result.creatorId = configured || value;
    result.creatorName = value;
    creditLineIndex = i;
    break;
  }

  // Title: only the FIRST line, and only when it is wrapped in **bold**
  // (and is not itself the credit line).
  const first = lines[0].match(/^\*\*(.+?)\*\*$/);
  if (first && creditLineIndex !== 0 && matchCreditLine(strip(first[1])) === null && !BARE_LABEL.test(strip(first[1]).trim())) {
    const title = clean(first[1]).replace(/\s+/g, ' ');
    if (title) result.title = title;
  }
  return result;
}

module.exports = {
  readPostText,
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
