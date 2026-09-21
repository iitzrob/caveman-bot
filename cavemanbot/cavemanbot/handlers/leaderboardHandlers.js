const { EmbedBuilder } = require('discord.js');
const points = require('../utils/points');

async function handleLeaderboardRoleSelect(interaction) {
  await interaction.deferUpdate();

  const role = interaction.roles.first();
  if (!role) {
    return interaction.editReply({ content: 'No role selected.', components: [] });
  }

  await interaction.guild.members.fetch();
  const data = points.getAll();

  const list = role.members
    .map((m) => ({ name: m.displayName, pts: data[m.id] || 0 }))
    .sort((a, b) => b.pts - a.pts);

  const description = list.length
    ? list.map((entry, i) => `**${i + 1}.** ${entry.name} — ${entry.pts} pts`).join('\n')
    : 'No members currently have that role.';

  const embed = new EmbedBuilder()
    .setTitle(`Points Leaderboard — ${role.name}`)
    .setDescription(description.slice(0, 4096))
    .setColor(0x2b2d31)
    .setFooter({ text: 'Resets every Monday at 1:00 AM' })
    .setTimestamp();

  await interaction.editReply({ content: null, embeds: [embed], components: [] });
}

module.exports = { handleLeaderboardRoleSelect };
