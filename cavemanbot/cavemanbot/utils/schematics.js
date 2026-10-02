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


// ---------- credit reading (forwarded / posted message text) ----------
// Understands lots of wordings, bold or not, any separator, name on the next line:
//   Original Creator: Nevio      Original Designer - Nevio     Credits | Nevio
//   Credit to Nevio              Credits go to Nevio           Credit: <@123456789012345678>
//   Designed by Nevio            Made / Built / Created / Crafted by Nevio
//   Author: Nevio                Builder » Nevio               Original Design: Nevio
const LABEL_WORDS = '(?:creators?|designers?|design|builders?|build|authors?|credits?|credited)';
const SEP = '[:\\-–—=|>»›→➜➔➤•·~]';
const NOUN_LABEL = new RegExp(
  '(?:^|[^a-z0-9])(?:orig(?:inal)?\\.?\\s*)?' + LABEL_WORDS +
  '\\s*(?:' + SEP + '+|(?:goes\\s+|go\\s+)?to\\b|is\\b)\\s*(.*)$', 'i');
// "Credits Nevio" / "Creator @Nevio" with no separator: only when the label starts the line.
const START_LABEL = new RegExp(
  '^[^a-z0-9<]*(?:orig(?:inal)?\\.?\\s*)?' + LABEL_WORDS + '\\s+(.+)$', 'i');
const BY_LABEL = /(?:^|[^a-z0-9])(?:made|built|build|designed|design|created|crafted|schematic|original\s+design|original\s+build)\s*by\s*[:\-–—]?\s*(.+)$/i;
// A line that is ONLY a label (the name is on the next line), e.g. "Original Designer".
const BARE_LABEL = new RegExp('^[^a-z0-9]*(?:orig(?:inal)?\\.?\\s*)?' + LABEL_WORDS + '\\s*(?:' + SEP + ')*\\s*$', 'i');
// Lines that talk ABOUT credit instead of giving it (the bot's own warning, etc).
const NOT_A_CREDIT = /without\s+credit|give\s+credit|giving\s+credit|take\s+credit|taking\s+this|permission|steal|no\s+credit|remove\s+credit|credit\s+or\b/i;
const JUNK_VALUE = /^(?:n\/?a|none|unknown|nobody|no\s*one|me|myself|the|a|an|their|his|her|them|us|everyone|anyone|whoever|others?|original|orig|and|or|for|of|is)\b/i;

function stripFormat(t) {
  return String(t || '')
    .replace(/<a?:\w+:\d+>/g, ' ')                 // custom emojis
    .replace(/\[([^\]]+)\]\((?:https?:\/\/)[^)]*\)/g, '$1') // [name](link) -> name
    .replace(/<?https?:\/\/\S+>?/gi, ' ')          // bare links
    .replace(/discord\.gg\/\S+/gi, ' ')
    .replace(/[*~`]/g, '')                          // bold / strike / code (keep _ and | for now)
    .replace(/^[>#\-\s]+(?=\S)/, (m) => (/-/.test(m) && !/^\s*-\s+\S/.test(m + 'x') ? m : ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function matchCreditLine(line) {
  if (!line || NOT_A_CREDIT.test(line)) return null;
  let m = line.match(NOUN_LABEL) || line.match(BY_LABEL);
  if (m) return m[1];
  m = line.match(START_LABEL);
  if (m && !JUNK_VALUE.test(m[1].trim())) return m[1];
  return null;
}

function cleanValue(t) {
  return String(t || '')
    .split(/\s[|•·]\s|\s[-–—]{1,2}\s(?=[a-z]+:)/i)[0]   // cut "Name | other stuff"
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, ' ')   // emojis
    .replace(/^[\s_@:\-–—=|>»›→➜➔➤•·~]+/, '')
    .replace(/[\s_|•·]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Reads the text of the forwarded/posted message itself. Looks for
//   **Title line**   (first line, wrapped in bold)
//   a credit line (see above)
// Returns { title, creatorId, creatorName }, each null when not found.
function readPostText(text) {
  const result = { title: null, creatorId: null, creatorName: null };
  const rawLines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!rawLines.length) return result;
  // Keep mentions exactly as they are; strip formatting from everything else.
  const lines = rawLines.map((l) => stripFormat(l.replace(/<@!?(\d{15,25})>/g, ' <@$1> ')).replace(/< @/g, '<@'));

  let creditLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const plain = lines[i];
    let rest = matchCreditLine(plain);
    if (rest === null && BARE_LABEL.test(plain)) rest = '';
    if (rest === null) continue;

    // Name is on the next line ("**Original Designer**" then "Nevio").
    if (!rest.trim() || BARE_LABEL.test(plain)) {
      const next = lines[i + 1] || '';
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

    let value = cleanValue(rest);
    if (!value || JUNK_VALUE.test(value)) continue;
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
  const first = rawLines[0].match(/^\*\*(.+?)\*\*$/);
  if (first && creditLineIndex !== 0 && matchCreditLine(stripFormat(first[1])) === null && !BARE_LABEL.test(stripFormat(first[1]))) {
    const title = stripFormat(first[1]).replace(/^[\s_@]+|[\s_]+$/g, '');
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
