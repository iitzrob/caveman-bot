// ButtonBuilder#setEmoji() needs a unicode emoji character OR an object
// ({ id, name, animated }) for custom emojis — it does NOT understand the
// <:name:id> / <a:name:id> tag format you get when you type an emoji in
// Discord and copy it. Passed a tag string directly, discord.js can't
// resolve it, so the button falls back to showing the raw name (":name:")
// instead of rendering the emoji.
//
// This works everywhere the tag is just sitting in message/embed text
// (like /embed's description) because Discord's client parses that tag
// itself when rendering text — no help from the bot needed there. Buttons
// go through the separate emoji field, so we have to parse it ourselves.
//
// parseEmoji('<:ticketcoupon:1268607173936676958>')
//   -> { id: '1268607173936676958', name: 'ticketcoupon', animated: false }
// parseEmoji('✋') -> '✋' (unicode emoji, passed through as-is)
function parseEmoji(emoji) {
  if (!emoji) return emoji;

  const match = emoji.match(/^<(a)?:(\w+):(\d+)>$/);
  if (!match) return emoji; // not a custom-emoji tag — treat as unicode

  const [, animated, name, id] = match;
  return { id, name, animated: Boolean(animated) };
}

// Slash-command text options (like /embed's title/description/footer) don't
// get the same treatment as the normal message box: if you type or paste a
// custom emoji there, Discord doesn't expand it into the <:name:id> tag —
// it stays as the literal shortcode ":name:", which is why it looks fine
// while you're typing (the picker shows a preview) but posts as plain text.
//
// This scans a string for :name: shortcodes and swaps in the guild's real
// emoji tag when one matches, so the description renders properly once sent.
// Unmatched shortcodes (typos, emoji from another server) are left as-is.
//
// resolveEmojiShortcodes(guild, 'Use :ticketcoupon: for a discount')
//   -> 'Use <:ticketcoupon:1268607173936676958> for a discount'
function resolveEmojiShortcodes(guild, text) {
  if (!text || !guild) return text;

  return text.replace(/:(\w+):/g, (full, name) => {
    const emoji = guild.emojis.cache.find((e) => e.name === name);
    return emoji ? emoji.toString() : full;
  });
}

module.exports = { parseEmoji, resolveEmojiShortcodes };
