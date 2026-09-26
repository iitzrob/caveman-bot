const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isStickyEnabled, enableSticky, disableSticky } = require('../handlers/stickyRoles');

// /sticky-roles user:<user> — toggles sticky roles for one specific user
// (admins only). While on for them, if they leave and rejoin, their roles
// from right before they left are automatically restored. Running the
// command again on the same user turns it back off.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('sticky-roles')
    .setDescription('Toggle sticky roles for one user (admins only)')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Whose roles should stick if they leave and rejoin').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'You do not have permission to use this.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    if (user.bot) {
      return interaction.reply({ content: 'Bots don’t need sticky roles.', ephemeral: true });
    }

    if (isStickyEnabled(user.id)) {
      disableSticky(user.id);
      return interaction.reply({
        content: `Sticky roles turned **off** for <@${user.id}>. Their roles won't be restored if they leave and rejoin.`,
        allowedMentions: { parse: [] },
      });
    }

    enableSticky(user.id);
    return interaction.reply({
      content: `Sticky roles turned **on** for <@${user.id}>. If they leave and rejoin, their current roles will be restored.`,
      allowedMentions: { parse: [] },
    });
  },
};
