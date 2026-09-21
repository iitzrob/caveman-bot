const { SlashCommandBuilder, ActionRowBuilder, RoleSelectMenuBuilder } = require('discord.js');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('point-leaderboard')
    .setDescription('Show the points leaderboard for a specific role'),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this.', ephemeral: true });
    }

    const row = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('leaderboard_role_select')
        .setPlaceholder('Select a role to track')
        .setMinValues(1)
        .setMaxValues(1)
    );

    await interaction.reply({
      content: 'Which role would you like to track?',
      components: [row],
      ephemeral: true,
    });
  },
};
