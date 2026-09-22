const { SlashCommandBuilder } = require('discord.js');
const { isStaff } = require('../utils/permissions');
const { buildPanelEmbed, buildPanelRow, votedOnPanel } = require('../utils/vouchSendPanel');

// /vouch-send user:@user — staff only (same role that manages tickets).
// Posts a "Vouch request" panel in the channel the command was run in;
// anyone can click the yes/no buttons, and every "yes" click registers as
// a real vouch for `user` (counts on /vouch-leaderboard same as normal
// vouches) and gets announced in config.vouches.staffVouchChannelId.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('vouch-send')
    .setDescription('Post a vouch request panel for a user')
    .addUserOption((opt) => opt.setName('user').setDescription('Who is requesting a vouch').setRequired(true)),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');

    await interaction.reply({
      embeds: [buildPanelEmbed(target.id)],
      components: [buildPanelRow(target.id)],
    });

    const message = await interaction.fetchReply();
    votedOnPanel.set(message.id, new Set());
  },
};
