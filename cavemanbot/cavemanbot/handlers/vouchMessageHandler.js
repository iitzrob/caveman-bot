const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const config = require('../config');
const vouches = require('../utils/vouches');
const ticketStore = require('../utils/ticketStore');
const { createPrivateChannel } = require('../utils/ticketCreation');
const { unclaimedRow } = require('../utils/ticketActions');

// Matches a plain-text message that STARTS with "vouch @user" or
// "scam vouch @user" (case-insensitive). Anything after the mention is
// treated as an optional comment. Group 1 is "scam " (or undefined) so we
// know which kind it is.
const VOUCH_REGEX = /^(scam\s+)?vouch\s+<@!?(\d+)>\s*([\s\S]*)$/i;

// message.id -> { targetId, voucherId, comment, guildId, channelId, jumpLink }
// In-memory on purpose: if the bot restarts before someone clicks Yes/No on
// their DM, the vouch entry is already saved either way (see below) — they
// just have to retype "scam vouch @user" to get a fresh ticket prompt.
const pendingScamReports = new Map();

// Call this from index.js inside your existing MessageCreate listener.
async function handleVouchMessage(message) {
  const cfg = config.vouches || {};
  if (!cfg.channelId) return; // plain-text trigger turned off
  if (message.author.bot) return;
  if (message.channel.id !== cfg.channelId) return;

  const match = message.content.match(VOUCH_REGEX);
  if (!match) return;

  const isScam = !!match[1];
  const targetId = match[2];
  const comment = match[3].trim() || null;

  if (targetId === message.author.id) {
    await message.reply({ content: "You can't vouch for yourself." }).catch(() => {});
    return;
  }

  // Normal vouch: just registers. "vouch @user" is the minimum — anything
  // typed after the mention is saved as their comment.
  if (!isScam) {
    vouches.addVouch(targetId, message.author.id, comment, false);
    await message.react('✅').catch(() => {});
    return;
  }

  // Scam vouch: this still gets saved right away (it stays in the vouch
  // data, and the message itself is never deleted from the channel), then
  // we DM the poster to confirm before opening a report ticket for staff.
  vouches.addVouch(targetId, message.author.id, comment, true);
  await message.react('⚠️').catch(() => {});

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`scamvouch_confirm:${message.id}:${targetId}`)
      .setLabel('Yes, report this')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`scamvouch_cancel:${message.id}:${targetId}`)
      .setLabel('No, cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  const embed = new EmbedBuilder()
    .setTitle('Confirm scam report')
    .setDescription(
      `Do you want to scam vouch <@${targetId}>?\n\n` +
        `This opens a report ticket and tells staff everything you wrote. ` +
        `Your message stays in <#${cfg.channelId}> either way — nothing gets removed.` +
        (comment ? `\n\n**Your comment:**\n${comment}` : '')
    )
    .setColor(0xed4245);

  try {
    const dm = await message.author.send({ embeds: [embed], components: [row] });
    pendingScamReports.set(message.id, {
      targetId,
      voucherId: message.author.id,
      comment,
      guildId: message.guild.id,
      jumpLink: message.url,
      dmMessageId: dm.id,
    });
  } catch (err) {
    await message
      .reply({ content: "I couldn't DM you to confirm the report — check that you allow DMs from server members and try again." })
      .catch(() => {});
  }
}

// Call this from index.js's InteractionCreate handler for button customIds
// starting with "scamvouch_confirm:" or "scamvouch_cancel:".
async function handleScamVouchButton(interaction) {
  const [action, messageId, targetId] = interaction.customId.split(':');
  const pending = pendingScamReports.get(messageId);
  pendingScamReports.delete(messageId);

  if (action === 'scamvouch_cancel') {
    return interaction.update({ content: 'Okay, no report was made.', embeds: [], components: [] });
  }

  if (!pending) {
    return interaction.update({
      content: 'This confirmation expired (the bot restarted). Send `scam vouch @user` again to retry.',
      embeds: [],
      components: [],
    });
  }

  await interaction.update({ content: 'Creating your report ticket...', embeds: [], components: [] });

  const cfg = config.vouches || {};
  const pingRoleId = cfg.reportPingRoleId || config.staffRoleId;

  let guild;
  try {
    guild = interaction.client.guilds.cache.get(pending.guildId) || (await interaction.client.guilds.fetch(pending.guildId));
  } catch (err) {
    console.error('Failed to fetch guild for scam report:', err);
    return;
  }

  let channel, rolesWithAccess;
  try {
    ({ channel, rolesWithAccess } = await createPrivateChannel({
      guild,
      name: `scam-report-${interaction.user.username}`,
      parentId: cfg.reportCategoryId,
      openerId: pending.voucherId,
      roleIds: [config.staffRoleId, pingRoleId, config.alwaysCanTypeRoleId],
    }));
  } catch (err) {
    console.error('Failed to create scam-report ticket channel:', err);
    return interaction
      .followUp({ content: `Something went wrong creating the ticket. Please tell staff.\n\`\`\`${err.message}\`\`\`` })
      .catch(() => {});
  }

  ticketStore.add(channel.id, {
    type: 'ticket',
    category: 'scam_report',
    openerId: pending.voucherId,
    openedAt: Date.now(),
    rolesWithAccess,
    claimedBy: null,
  });

  const embed = new EmbedBuilder()
    .setTitle('Scam Report')
    .setDescription(
      `**Reported by:** <@${pending.voucherId}>\n` +
        `**Reported user:** <@${targetId}>\n` +
        `**Original message:** [Jump to message](${pending.jumpLink})` +
        (pending.comment ? `\n\n**Comment:**\n${pending.comment}` : '\n\n_No comment left._') +
        `\n\nIf this checks out, run \`/scam-vouch add\` on <@${targetId}> to give them the scammer role.`
    )
    .setColor(0xed4245);

  const pings = [`<@${pending.voucherId}>`];
  if (pingRoleId) pings.push(`<@&${pingRoleId}>`);

  try {
    await channel.send({ content: pings.join(' '), embeds: [embed], components: [unclaimedRow()] });
  } catch (err) {
    console.error('Failed to send scam-report ticket embed:', err);
    ticketStore.remove(channel.id);
    await channel.delete().catch(() => {});
    return;
  }

  await interaction.followUp({ content: `Report ticket created: ${channel}` }).catch(() => {});
}

module.exports = { handleVouchMessage, handleScamVouchButton };
