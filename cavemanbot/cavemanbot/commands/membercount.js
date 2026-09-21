const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Shown next to "Members". Change the id here to swap the emoji.
const MEMBER_EMOJI = '<:1st246234:1533798054681907291>';

const fmt = (n) => n.toLocaleString('en-US');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('membercount')
    .setDescription('Show how many members the server has')
    .setDMPermission(false),

  async execute(interaction) {
    // memberCount counts everyone in the server, bots included.
    const description = [
      `## ${MEMBER_EMOJI} Members`,
      `* ***${fmt(interaction.guild.memberCount)}***`,
    ].join('\n');

    const embed = new EmbedBuilder().setColor(0x2b2d31).setDescription(description);

    return interaction.reply({ embeds: [embed] });
  },
};
