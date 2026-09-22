const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isStaff } = require('../utils/permissions');
const vouches = require('../utils/vouches');

const TOP_N = 25;

// /staff-vouch-leaderboard — staff-only. Same idea as /vouch-leaderboard but
// also shows how many scam reports each person has against them, ranked by
// normal vouch count first.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff-vouch-leaderboard')
    .setDescription('Staff-only: vouches and scam reports per user'),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this.', ephemeral: true });
    }

    const all = vouches.getAll();
    const list = Object.entries(all)
      .map(([userId, entries]) => ({
        userId,
        vouchCount: entries.filter((e) => !e.scam).length,
        scamCount: entries.filter((e) => e.scam).length,
      }))
      .filter((entry) => entry.vouchCount > 0 || entry.scamCount > 0)
      .sort((a, b) => b.vouchCount - a.vouchCount)
      .slice(0, TOP_N);

    if (!list.length) {
      return interaction.reply({ content: 'No vouches or scam reports yet.', ephemeral: true });
    }

    const lines = list.map(
      (entry, i) =>
        `**${i + 1}.** <@${entry.userId}> — ${entry.vouchCount} vouch${entry.vouchCount === 1 ? '' : 'es'}, ` +
        `${entry.scamCount} scam report${entry.scamCount === 1 ? '' : 's'}`
    );

    const embed = new EmbedBuilder()
      .setTitle('Staff Vouch Leaderboard')
      .setDescription(lines.join('\n').slice(0, 4096))
      .setColor(0x2b2d31);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
