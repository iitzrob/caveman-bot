const { SlashCommandBuilder } = require('discord.js');
const { renameChannel } = require('../utils/ticketActions');

// Same as /ticket-rename — just a shorter name for the same command.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('rename')
    .setDescription('Rename the current ticket or application channel (staff only)')
    .addStringOption((opt) =>
      opt.setName('name').setDescription('New channel name').setRequired(true)
    ),

  async execute(interaction) {
    const newName = interaction.options.getString('name');
    await renameChannel(interaction, newName);
  },
};
