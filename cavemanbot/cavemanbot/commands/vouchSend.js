const { SlashCommandBuilder } = require('discord.js');
const { isStaff } = require('../utils/permissions');
const { buildPanelEmbed, buildPanelRow } = require('../utils/vouchSendPanel');

// /vouch-send user:@user — staff only (same role that manages tickets).
// Posts a one-shot "Vouch request" panel in the channel the command was
// run in: "@user, @runner is requesting a vouch" (the picked user, and
// whoever ran the command). First person to click yes/no decides it — the
// embed then updates in place to show the result and the buttons go away.
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
    const runnerId = interaction.user.id;

    await interaction.reply({
      embeds: [buildPanelEmbed(target.id, runnerId)],
      components: [buildPanelRow(target.id)],
    });
  },
};
