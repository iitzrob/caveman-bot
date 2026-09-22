const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isStaff } = require('../utils/permissions');
const points = require('../utils/points');

// /staff-leaderboard — shows everyone with points, ranked highest to lowest.
// Top 3 get medal emojis, everyone else is just numbered underneath.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff-leaderboard')
    .setDescription('Show the staff points leaderboard'),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this.', ephemeral: true });
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
