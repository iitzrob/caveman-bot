const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isBypassRole } = require('../utils/permissions');
const { getGuide } = require('./guide');

// /helper guide — posts the Helper Guide / Training as plain text (no embed).
// The text comes from commands/guide.js, so it can be changed with /guide config.
// Restricted to config.alwaysCanTypeRoleId (see utils/permissions.js#isBypassRole)
// or anyone with Administrator.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('helper')
    .setDescription('Helper commands')
    .addSubcommand((sub) =>
      sub.setName('guide').setDescription('Post the Helper Guide / Training')
    )
    .setDMPermission(false),

  async execute(interaction) {
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isAdmin && !isBypassRole(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this.', ephemeral: true });
    }

    return interaction.reply({
      content: getGuide('helper'),
      allowedMentions: { parse: [] },
    });
  },
};
