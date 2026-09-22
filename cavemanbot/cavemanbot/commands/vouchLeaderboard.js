const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const vouches = require('../utils/vouches');

const TOP_N = 20;

// /vouch-leaderboard — public. Ranked by normal (non-scam) vouch count.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('vouch-leaderboard')
    .setDescription('Show who has the most vouches'),

  async execute(interaction) {
    const all = vouches.getAll();
    const list = Object.entries(all)
      .map(([userId, entries]) => ({
        userId,
        count: entries.filter((e) => !e.scam).length,
      }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_N);

    if (!list.length) {
      return interaction.reply({ content: 'No one has any vouches yet.' });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = list.map((entry, i) => {
      const rank = medals[i] || `**${i + 1}.**`;
      return `${rank} <@${entry.userId}> — ${entry.count} vouch${entry.count === 1 ? '' : 'es'}`;
    });

    const embed = new EmbedBuilder()
      .setTitle('Vouch Leaderboard')
      .setDescription(lines.join('\n').slice(0, 4096))
      .setColor(0xfee75c);

    await interaction.reply({ embeds: [embed] });
  },
};
