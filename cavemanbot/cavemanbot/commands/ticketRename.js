const { SlashCommandBuilder } = require('discord.js');
const { renameChannel } = require('../utils/ticketActions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-rename')
    .setDescription('Rename the current ticket or application channel (staff only)')
    .addStringOption((opt) =>
      opt.setName('name').setDescription('New channel name').setRequired(true)
    ),

  async execute(interaction) {
    const newName = interaction.options.getString('name');
    await renameChannel(interaction, newName);
  },
};
