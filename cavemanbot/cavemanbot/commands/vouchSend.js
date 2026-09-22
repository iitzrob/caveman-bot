const { SlashCommandBuilder } = require('discord.js');
const { isStaff } = require('../utils/permissions');
const { buildPanelEmbed, buildPanelRow } = require('../utils/vouchSendPanel');

// /vouch-send user:@user — staff only (same role that manages tickets).
// Posts a one-shot "Vouch request" panel in the channel the command was
// run in: "@user, @runner is requesting a vouch". @user (the one you pick)
// is the one being ASKED to vouch — only they can answer. @runner is
// whoever ran the command, and receives the vouch if @user says yes.
// First click decides it — the embed then updates in place to show the
// result and the buttons go away.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('vouch-send')
    .setDescription('Ask someone to vouch for you')
    .addUserOption((opt) => opt.setName('user').setDescription('Who you want a vouch from').setRequired(true)),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const runnerId = interaction.user.id;

    if (target.id === runnerId) {
      return interaction.reply({ content: "You can't request a vouch from yourself.", ephemeral: true });
    }

    await interaction.reply({
      embeds: [buildPanelEmbed(target.id, runnerId)],
      components: [buildPanelRow(target.id, runnerId)],
    });
  },
};
