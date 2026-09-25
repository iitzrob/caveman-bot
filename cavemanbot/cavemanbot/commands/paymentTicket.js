const { SlashCommandBuilder } = require('discord.js');
const { paymentTicket } = require('../utils/ticketActions');

// /payment-ticket — run inside a service ticket (build, dig, mapart,
// regears) to move it into the payment category set in
// config.paymentTicketCategoryId. Staff keep access to the ticket after
// the move. See utils/ticketActions.js#paymentTicket for the checks.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('payment-ticket')
    .setDescription('Move this service ticket to the payment category (staff only)'),

  async execute(interaction) {
    return paymentTicket(interaction);
  },
};
