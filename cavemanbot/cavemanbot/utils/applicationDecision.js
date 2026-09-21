const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { bold } = require('./textStyle');

// Builds the row of buttons shown under an application submission embed:
// Accept, Accept with Reason, Deny, Deny with Reason, Open a Ticket.
//
// state.disabled     - disables every button (a final decision was made)
// state.ticketOpened - disables just "Open a Ticket" (one has already been opened)
function buildDecisionRow(appId, state = {}) {
  const { disabled = false, ticketOpened = false } = state;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`application_accept:${appId}`)
      .setLabel(bold('Accept'))
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`application_accept_reason:${appId}`)
      .setLabel(bold('Accept with Reason'))
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`application_deny:${appId}`)
      .setLabel(bold('Deny'))
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`application_deny_reason:${appId}`)
      .setLabel(bold('Deny with Reason'))
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`application_open_ticket:${appId}`)
      .setLabel(bold(ticketOpened ? 'Ticket Opened' : 'Open a Ticket'))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled || ticketOpened)
  );
}

module.exports = { buildDecisionRow };
