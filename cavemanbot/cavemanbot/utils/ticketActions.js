const {
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const config = require('../config');
const ticketStore = require('./ticketStore');
const { isStaff } = require('./permissions');
const { buildTranscript } = require('./transcript');
const points = require('./points');
const serviceCategories = require('../data/serviceCategories');

// Service ticket type ids (build/dig/mapart/regears) — the only kind of
// ticket /payment-ticket is allowed to run in.
const SERVICE_TICKET_IDS = new Set(serviceCategories.map((c) => c.id));

// Role exempt from the one-rename-per-ticket limit (see renameChannel below).
const RENAME_EXEMPT_ROLE_ID = config.renameExemptRoleId;

// Points awarded to staff for each ticket action, added to the weekly
// leaderboard (utils/points.js). Rename Ticket is worth more since it takes
// more thought (fitting a clear, useful channel name) than the other two.
// Requesting a close and it later being agreed to only counts once, at the
// point the staff member clicks Request Close.
const CLOSE_POINTS = 2;
const REQUEST_CLOSE_POINTS = 2;
const RENAME_POINTS = 3;

// This role always keeps SendMessages in a ticket, even after it's claimed
// and every other role gets locked out. Edit config.alwaysCanTypeRoleId to
// change it.
const ALWAYS_CAN_TYPE_ROLE_ID = config.alwaysCanTypeRoleId;

function getTicketCategoryIds() {
  return Object.values(config.ticketCategories || {})
    .map((c) => c.categoryId)
    .filter(Boolean);
}

function getApplicationCategoryIds() {
  return Object.values(config.applicationCategories || {})
    .map((c) => c.ticketCategoryId)
    .filter(Boolean);
}

// Central lookup used by every ticket action. Tries, in order:
// 1) the saved record in data/tickets.json (ticketStore) — the normal case
// 2) an opener id embedded in the channel topic — the old fallback
// 3) simply being a channel that lives under one of the configured
//    ticket/application categories. If the bot created it there, it's a
//    real ticket even if its ticketStore entry or topic got lost somehow
//    (bot restart mid-open, topic edited/cleared, etc.) — being in the
//    right category is enough on its own.
// Returns null only if none of the three match at all.
function getTicketMeta(channel) {
  const stored = ticketStore.get(channel.id);
  if (stored) return stored;

  const topicOpenerId = (channel.topic || '').match(/\d{17,20}/)?.[0];
  if (topicOpenerId) return { type: 'ticket', openerId: topicOpenerId };

  if (getTicketCategoryIds().includes(channel.parentId)) {
    return { type: 'ticket', openerId: null };
  }
  if (getApplicationCategoryIds().includes(channel.parentId)) {
    return { type: 'application', openerId: null };
  }

  return null;
}

// Used when building log/close text — avoids printing "<@null>" when a
// ticket was recognized purely by category and has no known opener.
function openerMentionClause(meta) {
  return meta.openerId ? ` (opened by <@${meta.openerId}>)` : '';
}

// Simple one-line system-notice embed used for claim/unclaim/close/rename
// notifications, so they look consistent instead of plain text.
function systemEmbed(description) {
  return new EmbedBuilder().setDescription(description).setColor(0x2b2d31);
}

// Posts a one-line embed (optionally with files, e.g. a transcript) to
// config.ticketLogChannelId. Silently does nothing if that's not set, and
// never throws — a logging failure shouldn't break the action itself.
async function logToChannel(interaction, description, files) {
  if (!config.ticketLogChannelId) return;
  try {
    const logChannel = await interaction.client.channels.fetch(config.ticketLogChannelId);
    await logChannel.send({ embeds: [systemEmbed(description)], files });
  } catch (err) {
    console.error('Failed to post to ticket log channel:', err);
  }
}

async function closeChannel(interaction) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: 'Only staff can close this.', ephemeral: true });
  }

  const meta = getTicketMeta(interaction.channel);
  if (!meta) {
    return interaction.reply({ content: 'This is not a ticket or application channel.', ephemeral: true });
  }

  points.addPoints(interaction.user.id, CLOSE_POINTS);

  await interaction.reply({ embeds: [systemEmbed('🔒 Closing ticket, making a transcript...')] });

  await finishClose(
    interaction,
    meta,
    `Ticket **#${interaction.channel.name}** closed by ${interaction.user}${openerMentionClause(meta)}.`
  );
}

// The actual closing work — transcript, DM to the opener, log message, then
// deleting the channel. Shared by the Close Ticket button / /ticket close and
// by the "Agree" button on a close request. The caller is responsible for
// having already told the channel it's closing (reply / followUp) and for
// any permission checks.
async function finishClose(interaction, meta, logText) {
  const channel = interaction.channel;

  let transcript;
  try {
    transcript = await buildTranscript(channel);
  } catch (err) {
    console.error('Failed to build transcript:', err);
  }

  if (transcript && meta.openerId) {
    try {
      const opener = await interaction.client.users.fetch(meta.openerId);
      const closedEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket Closed')
        .setDescription(
          `Hello **${opener.username}**,\n\n` +
            `Your ticket (\`${channel.name}\`) has been closed.\n` +
            `A full transcript of your ticket conversation is attached below.`
        )
        .setColor(0x2b2d31)
        .setTimestamp();
      await opener.send({ files: [transcript], embeds: [closedEmbed] });
    } catch (err) {
      console.error('Failed to DM transcript to ticket opener:', err);
    }
  }

  // Also post the transcript in the log channel (skipped if it couldn't be built).
  if (config.ticketLogChannelId) {
    await logToChannel(interaction, logText, transcript ? [transcript] : undefined);
  }

  ticketStore.remove(channel.id);

  setTimeout(() => {
    channel.delete().catch(() => {});
  }, 5000);
}

// ---- Request Close ----
// Staff press "Request Close" on a ticket. The bot pings the ticket opener
// with an embed asking whether they agree, with green Agree / red Disagree
// buttons. Only the opener can answer. Agree closes the ticket exactly like
// Close Ticket does; Disagree just dismisses the request. The requester's id
// is stored in the button ids (ticket_close_agree:<id>), so this survives bot
// restarts and nothing extra has to be saved.
//
// This flow specifically needs a known opener id (there has to be someone to
// ping and to authorize), so unlike the other actions it does not fall back
// to "any channel in a ticket category" — if that's all we have, staff
// should use Close Ticket directly instead.

// Channels whose close is already in progress from an Agree click, so a
// double-click can't start two closes.
const closing = new Set();

async function requestClose(interaction) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: 'Only staff can request to close this.', ephemeral: true });
  }

  const meta = getTicketMeta(interaction.channel);
  if (!meta || !meta.openerId) {
    return interaction.reply({
      content: meta
        ? "Can't tell who opened this ticket, so there's no one to ask — use Close Ticket instead."
        : 'This is not a ticket or application channel.',
      ephemeral: true,
    });
  }

  // Only one close request can be pending at a time — staff have to wait
  // for the opener to Agree/Disagree before asking again. Disagree clears
  // this; Agree closes the ticket (which removes its store entry anyway).
  if (meta.closeRequestPending) {
    return interaction.reply({
      content: 'A close request is already pending on this ticket — wait for a response before requesting again.',
      ephemeral: true,
    });
  }

  points.addPoints(interaction.user.id, REQUEST_CLOSE_POINTS);
  ticketStore.update(interaction.channel.id, { closeRequestPending: true });

  const embed = new EmbedBuilder()
    .setDescription(`<@${meta.openerId}>, ${interaction.user} requested to close this ticket. Do you agree?`)
    .setColor(0x2b2d31);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_close_agree:${interaction.user.id}`)
      .setLabel('Agree')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`ticket_close_disagree:${interaction.user.id}`)
      .setLabel('Disagree')
      .setStyle(ButtonStyle.Danger)
  );

  // The ping goes in the message content — mentions inside an embed show the
  // name but don't notify anyone.
  await interaction.reply({
    content: `<@${meta.openerId}>`,
    embeds: [embed],
    components: [row],
  });
}

async function handleCloseAgree(interaction) {
  const meta = getTicketMeta(interaction.channel);
  if (!meta || !meta.openerId) {
    return interaction.reply({ content: 'This is not a ticket or application channel.', ephemeral: true });
  }
  if (interaction.user.id !== meta.openerId) {
    return interaction.reply({ content: `Only <@${meta.openerId}> can respond to this.`, ephemeral: true });
  }
  if (closing.has(interaction.channel.id)) {
    return interaction.reply({ content: 'This ticket is already closing.', ephemeral: true });
  }
  closing.add(interaction.channel.id);

  const requesterId = interaction.customId.split(':')[1];

  await interaction.update({
    embeds: [systemEmbed(`${interaction.user} agreed to close this ticket.`)],
    components: [],
  });
  await interaction.followUp({ embeds: [systemEmbed('🔒 Closing ticket, making a transcript...')] });

  await finishClose(
    interaction,
    meta,
    `Ticket **#${interaction.channel.name}** closed by <@${requesterId}> after <@${meta.openerId}> agreed to the close request.`
  );
}

async function handleCloseDisagree(interaction) {
  const meta = getTicketMeta(interaction.channel);
  if (!meta || !meta.openerId) {
    return interaction.reply({ content: 'This is not a ticket or application channel.', ephemeral: true });
  }
  if (interaction.user.id !== meta.openerId) {
    return interaction.reply({ content: `Only <@${meta.openerId}> can respond to this.`, ephemeral: true });
  }

  const requesterId = interaction.customId.split(':')[1];

  ticketStore.update(interaction.channel.id, { closeRequestPending: false });

  await interaction.update({
    embeds: [systemEmbed(`${interaction.user} declined the request from <@${requesterId}> to close this ticket.`)],
    components: [],
  });
}

async function renameChannel(interaction, newName) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: 'Only staff can rename this.', ephemeral: true });
  }

  const meta = getTicketMeta(interaction.channel);
  if (!meta) {
    return interaction.reply({ content: 'This is not a ticket or application channel.', ephemeral: true });
  }

  // Everyone can rename a given ticket once; RENAME_EXEMPT_ROLE_ID can do it
  // as many times as needed regardless of that limit.
  const isExempt = RENAME_EXEMPT_ROLE_ID && interaction.member.roles.cache.has(RENAME_EXEMPT_ROLE_ID);
  if (!isExempt && meta.renamed) {
    return interaction.reply({
      content: `This ticket has already been renamed once — only <@&${RENAME_EXEMPT_ROLE_ID}> can rename it again.`,
      ephemeral: true,
    });
  }

  const sanitized = newName
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\ufe0f\u{1F3FB}-\u{1F3FF}_-]/gu, '')
    .toLowerCase()
    .slice(0, 90) || 'ticket';

  points.addPoints(interaction.user.id, RENAME_POINTS);
  ticketStore.update(interaction.channel.id, { renamed: true });

  const oldName = interaction.channel.name;
  await interaction.channel.setName(sanitized);

  await interaction.reply({
    embeds: [systemEmbed(`${interaction.user} renamed this ticket to \`${sanitized}\``)],
  });

  await logToChannel(
    interaction,
    `✏️ ${interaction.user} renamed ticket **#${oldName}** to \`${sanitized}\`.`
  );
}

// Strips the footer off an embed and returns a fresh EmbedBuilder — used so
// unclaiming removes the "Claimed by" note that claiming added.
function withoutFooter(embed) {
  if (!embed) return null;
  const data = embed.toJSON();
  delete data.footer;
  return EmbedBuilder.from(data);
}

// Button rows shown on a ticket message. Claim Ticket is green (Success),
// Rename Ticket is blurple (Primary), Request Close is grey (Secondary) and
// Close Ticket is red (Danger). Claim Ticket flips to Unclaim Ticket (grey)
// once claimed. Rename's emoji is shared across every ticket row.
function renameButton() {
  return new ButtonBuilder()
    .setCustomId('ticket_rename_btn')
    .setLabel('Rename Ticket')
    .setEmoji({ id: '1549873873040965812', name: 'rename', animated: true })
    .setStyle(ButtonStyle.Primary);
}

function requestCloseButton() {
  return new ButtonBuilder()
    .setCustomId('ticket_request_close_btn')
    .setLabel('Request Close')
    .setEmoji({ id: '1549870086586761357', name: 'finnishedafter2hoursanimating', animated: true })
    .setStyle(ButtonStyle.Secondary);
}

function closeButton() {
  return new ButtonBuilder()
    .setCustomId('ticket_close_btn')
    .setLabel('Close Ticket')
    .setEmoji({ id: '1533798047618695308', name: 'Cross' })
    .setStyle(ButtonStyle.Danger);
}

function claimedRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_unclaim_btn')
      .setLabel('Unclaim Ticket')
      .setStyle(ButtonStyle.Secondary),
    renameButton(),
    requestCloseButton(),
    closeButton()
  );
}

function unclaimedRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_claim_btn')
      .setLabel('Claim Ticket')
      .setEmoji({ id: '1533798048856281168', name: 'Tick234234' })
      .setStyle(ButtonStyle.Success),
    renameButton(),
    requestCloseButton(),
    closeButton()
  );
}

// Application tickets have no Claim button (it's not a support ticket).
function noClaimRow() {
  return new ActionRowBuilder().addComponents(renameButton(), requestCloseButton(), closeButton());
}

// Claiming a ticket locks SendMessages on every role that normally has
// access to it (the staff role + that category's ping role), then grants
// SendMessages back to just the claiming staff member. Administrators are
// unaffected since Discord's Administrator permission bypasses channel
// overwrites entirely, the ticket opener's own overwrite is never touched so
// they can keep talking, and ALWAYS_CAN_TYPE_ROLE_ID is skipped entirely so
// that role can always type even in a claimed ticket.
async function claimTicket(interaction) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: 'Only staff can claim tickets.', ephemeral: true });
  }

  const meta = getTicketMeta(interaction.channel);
  if (!meta || meta.type !== 'ticket') {
    return interaction.reply({ content: 'This channel cannot be claimed.', ephemeral: true });
  }

  const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
  if (meta.claimedBy && meta.claimedBy !== interaction.user.id && !isAdmin) {
    return interaction.reply({
      content: `This ticket is already claimed by <@${meta.claimedBy}>.`,
      ephemeral: true,
    });
  }

  const roleIds = meta.rolesWithAccess || [];
  for (const roleId of roleIds) {
    if (roleId === ALWAYS_CAN_TYPE_ROLE_ID) continue; // this role always keeps access
    await interaction.channel.permissionOverwrites.edit(roleId, { SendMessages: false }).catch(() => {});
  }
  await interaction.channel.permissionOverwrites
    .edit(interaction.user.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    })
    .catch(() => {});

  ticketStore.update(interaction.channel.id, { claimedBy: interaction.user.id });

  // Service tickets (build/dig/mapart/regears) also get moved into the
  // shared "claimed" category, so staff can see in-progress work in one
  // place. The category it came from is saved on the ticket's stored meta
  // (survives a bot restart) so unclaimTicket can move it back.
  if (
    SERVICE_TICKET_IDS.has(meta.category)
    && config.claimedServiceCategoryId
    && interaction.channel.parentId !== config.claimedServiceCategoryId
  ) {
    ticketStore.update(interaction.channel.id, { preClaimCategoryId: interaction.channel.parentId });
    await interaction.channel.setParent(config.claimedServiceCategoryId, { lockPermissions: false }).catch((err) => {
      console.error('Failed to move claimed service ticket to claimedServiceCategoryId:', err);
    });
  }

  const embed = interaction.message.embeds[0]
    ? EmbedBuilder.from(interaction.message.embeds[0]).setFooter({ text: `Claimed by ${interaction.user.tag}` })
    : null;

  await interaction.update({
    embeds: embed ? [embed] : interaction.message.embeds,
    components: [claimedRow()],
  });
  await interaction.followUp({
    embeds: [systemEmbed(`${interaction.user} claimed this ticket`)],
  });

  await logToChannel(
    interaction,
    `🔒 ${interaction.user} claimed ticket **#${interaction.channel.name}**.`
  );
}

async function unclaimTicket(interaction) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: 'Only staff can unclaim tickets.', ephemeral: true });
  }

  const meta = getTicketMeta(interaction.channel);
  if (!meta || meta.type !== 'ticket' || !meta.claimedBy) {
    return interaction.reply({ content: 'This ticket is not currently claimed.', ephemeral: true });
  }

  const isClaimer = meta.claimedBy === interaction.user.id;
  const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
  if (!isClaimer && !isAdmin) {
    return interaction.reply({
      content: `Only <@${meta.claimedBy}> (or an admin) can unclaim this ticket.`,
      ephemeral: true,
    });
  }

  const roleIds = meta.rolesWithAccess || [];
  for (const roleId of roleIds) {
    await interaction.channel.permissionOverwrites.edit(roleId, { SendMessages: true }).catch(() => {});
  }
  await interaction.channel.permissionOverwrites.delete(meta.claimedBy).catch(() => {});

  ticketStore.update(interaction.channel.id, { claimedBy: null });

  // Move a service ticket back to whichever category it was claimed out of.
  if (SERVICE_TICKET_IDS.has(meta.category) && meta.preClaimCategoryId) {
    ticketStore.update(interaction.channel.id, { preClaimCategoryId: null });
    await interaction.channel.setParent(meta.preClaimCategoryId, { lockPermissions: false }).catch((err) => {
      console.error('Failed to move unclaimed service ticket back to its category:', err);
    });
  }

  const embed = withoutFooter(interaction.message.embeds[0]);

  await interaction.update({
    embeds: embed ? [embed] : interaction.message.embeds,
    components: [unclaimedRow()],
  });
  await interaction.followUp({
    embeds: [systemEmbed(`🔓 Ticket unclaimed by ${interaction.user} — staff can type here again.`)],
  });

  await logToChannel(
    interaction,
    `🔓 ${interaction.user} unclaimed ticket **#${interaction.channel.name}**.`
  );
}

// Rename Ticket button — opens a small modal asking for the new name, since
// buttons can't collect text input directly. The modal submit calls the same
// renameChannel() used by /ticket rename and /rename, so behavior stays
// identical no matter how staff trigger a rename.
function renameModal() {
  const modal = new ModalBuilder().setCustomId('ticket_rename_modal').setTitle('Rename Ticket');
  const nameInput = new TextInputBuilder()
    .setCustomId('name')
    .setLabel('New channel name')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(90);
  modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
  return modal;
}

async function handleRenameButton(interaction) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: 'Only staff can rename this.', ephemeral: true });
  }

  const meta = getTicketMeta(interaction.channel);
  if (!meta) {
    return interaction.reply({ content: 'This is not a ticket or application channel.', ephemeral: true });
  }

  await interaction.showModal(renameModal());
}

async function handleRenameModalSubmit(interaction) {
  const newName = interaction.fields.getTextInputValue('name');
  await renameChannel(interaction, newName);
}

// /ticket add user:<user> — staff only, adds someone to whatever ticket or
// application-ticket channel the command is run in.
async function addUserToTicket(interaction, user) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: 'Only staff can add someone to a ticket.', ephemeral: true });
  }

  const meta = getTicketMeta(interaction.channel);
  if (!meta) {
    return interaction.reply({ content: 'This is not a ticket or application channel.', ephemeral: true });
  }

  await interaction.channel.permissionOverwrites.edit(user.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
  });

  await interaction.reply(`${user} has been added to this ticket by ${interaction.user}.`);
}

// /payment-ticket — staff only, only inside a service ticket (build, dig,
// mapart, regears). Moves the channel to config.paymentTicketCategoryId.
// Doesn't touch permission overwrites (lockPermissions: false), so staff
// and the opener keep exactly the access they already had — only the
// channel's category/position changes.
async function paymentTicket(interaction) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: 'Only staff can use this.', ephemeral: true });
  }

  const meta = getTicketMeta(interaction.channel);
  if (!meta || meta.type !== 'ticket' || !SERVICE_TICKET_IDS.has(meta.category)) {
    return interaction.reply({
      content: 'This can only be used inside a service ticket (Build, Dig, Mapart or Regears).',
      ephemeral: true,
    });
  }

  if (!config.paymentTicketCategoryId) {
    return interaction.reply({
      content: 'paymentTicketCategoryId is not set in config.js.',
      ephemeral: true,
    });
  }

  if (interaction.channel.parentId === config.paymentTicketCategoryId) {
    return interaction.reply({ content: 'This ticket is already in the payment category.', ephemeral: true });
  }

  try {
    await interaction.channel.setParent(config.paymentTicketCategoryId, { lockPermissions: false });
  } catch (err) {
    console.error('Failed to move ticket to payment category:', err);
    return interaction.reply({
      content: "Couldn't move this ticket — check the bot has Manage Channels access to the payment category.",
      ephemeral: true,
    });
  }

  await interaction.reply({
    embeds: [systemEmbed(`💳 ${interaction.user} moved this ticket to the payment ticket's category.`)],
  });

  await logToChannel(
    interaction,
    `💳 ${interaction.user} moved ticket **#${interaction.channel.name}** to the payment category.`
  );
}

module.exports = {
  closeChannel,
  requestClose,
  handleCloseAgree,
  handleCloseDisagree,
  renameChannel,
  claimTicket,
  unclaimTicket,
  handleRenameButton,
  handleRenameModalSubmit,
  addUserToTicket,
  paymentTicket,
  claimedRow,
  unclaimedRow,
  noClaimRow,
};
