const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { parseEmoji } = require('./parseEmoji');

const VERIFIED_EMOJI = '<a:243574pastelblueverifiedanimated:1551827789974470676>';
const YES_EMOJI = '<:yes:1543519013567602708>';
const CROSS_EMOJI = '<:Cross:1533798047618695308>';

// targetId = the user picked in /vouch-send (who the vouch is for).
// runnerId = whoever ran the command (shown as the one requesting it).
function buildPanelEmbed(targetId, runnerId) {
  return new EmbedBuilder()
    .setTitle('Vouch request')
    .setDescription(
      `${VERIFIED_EMOJI}\n**<@${targetId}>, <@${runnerId}> is requesting a vouch**\n**Do you want to vouch?**`
    )
    .setColor(0xfee75c);
}

// Replaces the panel embed once someone has answered — single-use, so the
// buttons come off and this becomes the final state of the message.
function buildResultEmbed(text) {
  return new EmbedBuilder().setDescription(text).setColor(0xfee75c);
}

function buildPanelRow(targetId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`vouchsend_yes:${targetId}`)
      .setEmoji(parseEmoji(YES_EMOJI))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`vouchsend_no:${targetId}`)
      .setEmoji(parseEmoji(CROSS_EMOJI))
      .setStyle(ButtonStyle.Danger)
  );
}

// message.id -> true once the panel has been answered. One-shot: whoever
// clicks first decides the outcome and the buttons get removed, this Set
// just guards against two people clicking within the same instant.
const resolvedPanels = new Set();

module.exports = { buildPanelEmbed, buildResultEmbed, buildPanelRow, resolvedPanels };
