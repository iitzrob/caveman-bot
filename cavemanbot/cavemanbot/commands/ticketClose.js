const { SlashCommandBuilder } = require('discord.js');
const { closeChannel } = require('../utils/ticketActions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-close')
    .setDescription('Close the current ticket or application channel (staff only)'),

  async execute(interaction) {
    await closeChannel(interaction);
  },
};
