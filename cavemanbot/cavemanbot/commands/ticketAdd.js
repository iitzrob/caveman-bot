const { SlashCommandBuilder } = require('discord.js');
const { addUserToTicket } = require('../utils/ticketActions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-add')
    .setDescription('Add a user to the current ticket or application-ticket channel (staff only)')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to add to this ticket').setRequired(true)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    await addUserToTicket(interaction, user);
  },
};
