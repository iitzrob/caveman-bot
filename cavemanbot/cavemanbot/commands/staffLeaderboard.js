const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isStaff } = require('../utils/permissions');
const points = require('../utils/points');

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
// Top 3 get medal emojis, everyone else is just numbered underneath. Reply
// is public (no ephemeral flag) so the whole channel sees it.
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

    const data = points.getAll();
    const list = Object.entries(data)
      .map(([userId, pts]) => ({ userId, pts }))
      .filter((entry) => entry.pts > 0)
      .sort((a, b) => b.pts - a.pts);

    if (!list.length) {
      return interaction.reply({ content: 'No one has earned any points yet.', ephemeral: true });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = list.map((entry, i) => {
      const rank = medals[i] || `**${i + 1}.**`;
      return `${rank} <@${entry.userId}> — ${entry.pts} pts`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🏆 Staff Leaderboard')
      .setDescription(lines.join('\n').slice(0, 4096))
      .setColor(0x2b2d31)
      .setFooter({ text: 'Earn points in tickets — Rename: 3 pts, Close: 2 pts' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
