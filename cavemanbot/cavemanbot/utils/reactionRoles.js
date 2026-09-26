const config = require('../config');
const { parseEmoji } = require('./parseEmoji');

// No file/store needed: a reaction is on a panel if the message was posted
// by the bot itself and its embed title is "Reaction roles" — that's
// enough to recognize it, works automatically across restarts, and never
// touches disk (so it can't interfere with anything in data/).
function isPanelMessage(message) {
  return message.author?.id === message.client.user.id && message.embeds[0]?.title === 'Reaction roles';
}

// Looks up which reactionRoles entry (config.js) a given reaction's emoji
// corresponds to — matches custom emoji by id, unicode emoji by character.
function findEntryByEmoji(emoji) {
  return (config.reactionRoles || []).find((entry) => {
    const parsed = parseEmoji(entry.emoji);
    if (typeof parsed === 'string') return parsed === emoji.name;
    return parsed.id === emoji.id;
  });
}

module.exports = { isPanelMessage, findEntryByEmoji };
