const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { parseEmoji } = require('./parseEmoji');

const VERIFIED_EMOJI = '<a:243574pastelblueverifiedanimated:1551827789974470676>';
const YES_EMOJI = '<:yes:1543519013567602708>';
const CROSS_EMOJI = '<:Cross:1533798047618695308>';

// targetId = the user picked in /vouch-send — they're the one being asked
// to give the vouch. runnerId = whoever ran the command — they're the one
// requesting it (and who receives the vouch if targetId says yes).
function buildPanelEmbed(targetId, runnerId) {
  return new EmbedBuilder()
    .setTitle('Vouch request')
    .setDescription(
      `${VERIFIED_EMOJI}\n**<@${targetId}>, <@${runnerId}> is requesting a vouch**\n**Do you want to vouch?**`
    )
    .setColor(0xfee75c);
}

// Replaces the panel embed once it's been answered — single-use, so the
// buttons come off and this becomes the final state of the message.
function buildResultEmbed(text) {
  return new EmbedBuilder().setDescription(text).setColor(0xfee75c);
}

function buildPanelRow(targetId, runnerId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`vouchsend_yes:${targetId}:${runnerId}`)
      .setEmoji(parseEmoji(YES_EMOJI))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`vouchsend_no:${targetId}:${runnerId}`)
      .setEmoji(parseEmoji(CROSS_EMOJI))
      .setStyle(ButtonStyle.Danger)
  );
}

// message.id -> true once the panel has been answered. One-shot: whoever
// is allowed to answer (the picked user) decides it on their first click,
// this Set just guards against a double-click firing twice.
const resolvedPanels = new Set();

module.exports = { buildPanelEmbed, buildResultEmbed, buildPanelRow, resolvedPanels };
