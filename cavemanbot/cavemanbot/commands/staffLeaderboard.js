const { SlashCommandBuilder } = require('discord.js');
const { isStaff } = require('../utils/permissions');
const { buildPointsBoard } = require('../utils/staffBoards');

// Anti-spam: each person gets 4 free uses, then has to wait out a 10s
// cooldown before the command works again. In-memory only (resets if the
// bot restarts) — that's fine, this is just to stop channel spam.
const MAX_USES = 4;
const WINDOW_MS = 10 * 1000;
const recentUses = new Map(); // userId -> array of use timestamps (ms)

function getCooldownRemaining(userId) {
  const now = Date.now();
  const timestamps = (recentUses.get(userId) || []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_USES) {
    recentUses.set(userId, timestamps);
    return WINDOW_MS - (now - timestamps[0]);
  }

  timestamps.push(now);
  recentUses.set(userId, timestamps);
  return 0;
}

// /staff-leaderboard — shows everyone with points, ranked highest to lowest.
// Top 3 get medal emojis, everyone else is just numbered underneath. The
// button under the board switches it to the weekly schematic posts board.
// Reply is public (no ephemeral flag) so the whole channel sees it.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff-leaderboard')
    .setDescription('Show the staff points leaderboard'),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this.', ephemeral: true });
    }

    const remaining = getCooldownRemaining(interaction.user.id);
    if (remaining > 0) {
      return interaction.reply({
        content: `You're using this too fast — try again in ${Math.ceil(remaining / 1000)}s.`,
        ephemeral: true,
      });
    }

    await interaction.reply(buildPointsBoard());
  },
};
