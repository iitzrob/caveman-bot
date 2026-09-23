const { PermissionFlagsBits, AuditLogEvent, EmbedBuilder } = require('discord.js');
const config = require('../config');

// Sliding window of recent ban timestamps per executor id, e.g.
// { '123456789012345678': [t1, t2, t3] }. In-memory only — resets on
// restart, which is fine since it's just a rolling few-minute window.
const recentBans = new Map();

function getSettings() {
  return config.antiNuke || {};
}

// Never auto-banned: the server owner, plus anyone listed in
// config.antiNuke.exemptUserIds / exemptRoleIds.
function isExempt(guild, userId, member) {
  if (guild.ownerId === userId) return true;
  const settings = getSettings();
  if ((settings.exemptUserIds || []).includes(userId)) return true;
  if (member && (settings.exemptRoleIds || []).some((id) => member.roles.cache.has(id))) return true;
  return false;
}

async function logAction(guild, description) {
  const settings = getSettings();
  if (!settings.logChannelId) return;
  try {
    const channel = await guild.channels.fetch(settings.logChannelId);
    const embed = new EmbedBuilder().setDescription(description).setColor(0xff3333).setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[anti-nuke] Failed to post to log channel:', err);
  }
}

// Fired on every audit-log entry (Events.GuildAuditLogEntryCreate). We only
// care about MemberBanAdd entries — tracks how many bans each executor has
// made in the last banWindowMs, and permanently bans them once they hit
// banThreshold.
async function handleAuditLogEntry(entry, guild, client) {
  const settings = getSettings();
  if (!settings.enabled) return;
  if (entry.action !== AuditLogEvent.MemberBanAdd) return;

  const executorId = entry.executorId;
  if (!executorId) return;
  // Ignore the bot's own bans — including ones this system just issued —
  // so it can never end up chasing its own tail.
  if (executorId === client.user.id) return;

  const member = await guild.members.fetch(executorId).catch(() => null);
  if (isExempt(guild, executorId, member)) return;

  const now = Date.now();
  const windowMs = settings.banWindowMs || 5 * 60 * 1000;
  const threshold = settings.banThreshold || 3;

  const timestamps = (recentBans.get(executorId) || []).filter((t) => now - t < windowMs);
  timestamps.push(now);
  recentBans.set(executorId, timestamps);

  if (timestamps.length < threshold) return;

  recentBans.delete(executorId);

  try {
    await guild.members.ban(executorId, {
      reason:
        settings.banReason ||
        `Anti-nuke: banned ${threshold} members within ${Math.round(windowMs / 60000)} minutes.`,
      deleteMessageSeconds: 0,
    });
    console.warn(
      `[anti-nuke] Banned ${executorId} for a ban spree (${timestamps.length} bans in the last ${Math.round(
        windowMs / 60000
      )} min).`
    );
    await logAction(
      guild,
      `🚨 <@${executorId}> (\`${executorId}\`) was permanently banned by anti-nuke for banning ${timestamps.length} members within ${Math.round(
        windowMs / 60000
      )} minutes.`
    );
  } catch (err) {
    console.error(`[anti-nuke] Failed to ban ${executorId} after a detected ban spree:`, err);
  }
}

// Fired on every message (Events.MessageCreate). Bans the author on the spot
// if they ping @everyone, @here, or any id in config.antiNuke.protectedMentionIds
// (checked as both a user id and a role id, since the id could be either).
async function handleMessageMentionCheck(message) {
  const settings = getSettings();
  if (!settings.enabled) return;
  if (!message.guild || message.author.bot) return;

  const protectedIds = settings.protectedMentionIds || [];
  const hasEveryoneOrHere = message.mentions.everyone;
  const hasProtectedUser = protectedIds.some((id) => message.mentions.users.has(id));
  const hasProtectedRole = protectedIds.some((id) => message.mentions.roles.has(id));

  if (!hasEveryoneOrHere && !hasProtectedUser && !hasProtectedRole) return;

  if (isExempt(message.guild, message.author.id, message.member)) return;

  try {
    await message.guild.members.ban(message.author.id, {
      reason:
        settings.mentionBanReason ||
        'Anti-nuke: pinged @everyone/@here or a protected role/user.',
      deleteMessageSeconds: 60, // also cleans up the last minute of their messages, including the ping itself
    });
    console.warn(`[anti-nuke] Banned ${message.author.tag} (${message.author.id}) for a protected mention.`);
    await logAction(
      message.guild,
      `🚨 <@${message.author.id}> (\`${message.author.id}\`) was permanently banned by anti-nuke for pinging @everyone/@here or a protected role/user.`
    );
  } catch (err) {
    console.error(`[anti-nuke] Failed to ban ${message.author.id} for a protected mention:`, err);
  }
}

module.exports = { handleAuditLogEntry, handleMessageMentionCheck };
