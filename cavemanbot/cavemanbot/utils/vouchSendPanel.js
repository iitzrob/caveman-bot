const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { parseEmoji } = require('./parseEmoji');

const VERIFIED_EMOJI = '<a:243574pastelblueverifiedanimated:1551827789974470676>';
const YES_EMOJI = '<:yes:1543519013567602708>';
const CROSS_EMOJI = '<:Cross:1533798047618695308>';

function buildPanelEmbed(targetId) {
  return new EmbedBuilder()
    .setTitle('Vouch request')
    .setDescription(`${VERIFIED_EMOJI}\n**<@${targetId}> Is requesting a vouch**\n**Do you want to vouch?**`)
    .setColor(0xfee75c);
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

// message.id -> Set(voucherId) — who has already vouched off this specific
// panel, so the same person clicking Yes twice on one /vouch-send doesn't
// register twice. In-memory only: resets on restart (harmless — worst case
// someone can vouch again after the bot restarts).
const votedOnPanel = new Map();

module.exports = { buildPanelEmbed, buildPanelRow, votedOnPanel };
