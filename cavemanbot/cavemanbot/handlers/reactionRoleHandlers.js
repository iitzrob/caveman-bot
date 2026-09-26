const { findEntryByEmoji, isPanelMessage } = require('../utils/reactionRoles');

// Shared by add/remove: resolves partials (so this still works for
// reactions on a panel message the bot hasn't seen since its last restart)
// and returns the matching reaction-roles entry, or null if this reaction
// isn't on a panel we care about / isn't one of the configured emoji.
async function resolveEntry(reaction, user) {
  if (user.bot) return null;

  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (err) {
      console.error('[reaction roles] Failed to fetch partial reaction:', err.message);
      return null;
    }
  }
  if (reaction.message.partial) {
    try {
      await reaction.message.fetch();
    } catch (err) {
      console.error('[reaction roles] Failed to fetch partial message:', err.message);
      return null;
    }
  }

  if (!isPanelMessage(reaction.message)) return null;

  return findEntryByEmoji(reaction.emoji) || null;
}

async function handleReactionRoleAdd(reaction, user) {
  const entry = await resolveEntry(reaction, user);
  if (!entry) return;

  const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  await member.roles.add(entry.roleId).catch((err) =>
    console.error(`[reaction roles] Failed to add role for "${entry.label}":`, err.message)
  );
}

async function handleReactionRoleRemove(reaction, user) {
  const entry = await resolveEntry(reaction, user);
  if (!entry) return;

  const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  await member.roles.remove(entry.roleId).catch((err) =>
    console.error(`[reaction roles] Failed to remove role for "${entry.label}":`, err.message)
  );
}

module.exports = { handleReactionRoleAdd, handleReactionRoleRemove };
