const config = require('../config');

// Turns 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th", 11 -> "11th", etc.
function ordinal(n) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
}

// Sends the plain-text welcome message configured under `welcome` in
// config.js to `welcome.channelId` whenever someone joins the server.
async function handleWelcome(member) {
  const cfg = config.welcome || {};
  if (!cfg.enabled) return;
  if (member.guild.id !== config.guildId) return;
  if (member.user.bot) return;

  if (!cfg.channelId) {
    console.warn('[welcome] welcome.channelId is empty in config.js — set it to the channel to post in.');
    return;
  }

  const channel = member.guild.channels.cache.get(cfg.channelId);
  if (!channel || !channel.isTextBased()) {
    console.warn(`[welcome] welcome.channelId "${cfg.channelId}" isn't a text channel in this server.`);
    return;
  }

  const content = (cfg.message || 'Welcome {user} to {guild}! You are the {ordinal} member.')
    .replace(/{user}/g, `<@${member.id}>`)
    .replace(/{guild}/g, member.guild.name)
    .replace(/{ordinal}/g, ordinal(member.guild.memberCount));

  // content (not embeds) so this is a plain text message, not an embed.
  await channel.send({ content }).catch((err) =>
    console.error('[welcome] Failed to send welcome message:', err.message)
  );
}

module.exports = { handleWelcome };
