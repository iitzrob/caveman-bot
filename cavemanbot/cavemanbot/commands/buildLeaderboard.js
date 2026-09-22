const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isStaff } = require('../utils/permissions');
const builds = require('../utils/builds');

// /build-leaderboard — shows everyone who has logged a finished build via
// /build-finish, ranked highest count to lowest (1st to last). Same layout
// as /staff-leaderboard: top 3 get medals, everyone else is numbered.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('build-leaderboard')
    .setDescription('Show the finished-builds leaderboard'),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this.', ephemeral: true });
    }

    const data = builds.getAll();
    const list = Object.entries(data)
      .map(([userId, entry]) => ({ userId, count: entry.count || 0 }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count);

    if (!list.length) {
      return interaction.reply({ content: 'No one has logged a finished build yet.', ephemeral: true });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = list.map((entry, i) => {
      const rank = medals[i] || `**${i + 1}.**`;
      return `${rank} <@${entry.userId}> — ${entry.count} build${entry.count === 1 ? '' : 's'}`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🏗️ Build Leaderboard')
      .setDescription(lines.join('\n').slice(0, 4096))
      .setColor(0x2b2d31)
      .setFooter({ text: 'Use /build-finish to log a completed build' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
