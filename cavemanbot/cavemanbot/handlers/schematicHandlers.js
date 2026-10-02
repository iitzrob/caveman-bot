const crypto = require('crypto');
const { AttachmentBuilder } = require('discord.js');
const cfg = require('../schematicConfig');
const schematics = require('../utils/schematics');
const points = require('../utils/points');
const { isStaff } = require('../utils/permissions');
const { buildPointsBoard, buildSchematicBoard } = require('../utils/staffBoards');

const MAX_FILES_PER_POST = 10; // Discord's limit per message
const inFlight = new Set(); // fingerprints being posted right now (stops two forwards racing)

function isImage(attachment) {
  const ext = String(attachment.name || '').split('.').pop().toLowerCase();
  return (
    (attachment.contentType && attachment.contentType.startsWith('image/')) ||
    cfg.imageExtensions.includes(ext)
  );
}

// Files and images from the message itself AND from anything it forwards
// (a forwarded message keeps its attachments in "message snapshots").
function collectAttachments(message) {
  const found = new Map();
  const add = (attachment) => {
    if (attachment && !found.has(attachment.url)) found.set(attachment.url, attachment);
  };

  for (const attachment of message.attachments.values()) add(attachment);
  if (message.messageSnapshots) {
    for (const snapshot of message.messageSnapshots.values()) {
      if (!snapshot.attachments) continue;
      for (const attachment of snapshot.attachments.values()) add(attachment);
    }
  }
  return [...found.values()];
}

async function download(attachment) {
  const response = await fetch(attachment.url);
  if (!response.ok) throw new Error(`download failed (${response.status}) for ${attachment.name}`);
  return Buffer.from(await response.arrayBuffer());
}

function buildPostText(title, creatorId) {
  const lines = [
    `## ${cfg.emojiNo}   DO NOT SHARE THESE SCHEMATICS   ${cfg.emojiNo}`,
    `##   ${cfg.emojiBlocks} ${title} ${cfg.emojiBlocks} `,
    '**CaveMen Club**',
    '',
  ];
  if (creatorId) {
    // A Discord id gets mentioned; anything else is written as plain text.
    const credit = /^\d{15,25}$/.test(String(creatorId)) ? `<@${creatorId}>` : creatorId;
    lines.push(`**Original Creator:** ${credit}`);
  }
  lines.push(
    '_Taking this schematic and reposting it in your own server without credit or permission will result in removal of access, scammer roles across partnered servers, and possible blacklist._'
  );
  return lines.join('\n');
}

function tempReply(message, text) {
  message
    .reply({ content: text, allowedMentions: { repliedUser: false } })
    .then((reply) => setTimeout(() => reply.delete().catch(() => {}), 10 * 1000))
    .catch(() => {});
}

// Is the ping id a role or a user? Works either way.
async function buildPing(guild) {
  const id = cfg.pingId;
  const role = guild.roles.cache.get(id) || (await guild.roles.fetch(id).catch(() => null));
  if (role) return { content: `<@&${id}>`, allowedMentions: { roles: [id] } };
  return { content: `<@${id}>`, allowedMentions: { users: [id] } };
}

async function handleSchematicMessage(message) {
  if (!cfg.enabled) return;
  if (!message.guild || message.author?.bot) return;

  const destinationId = cfg.channels[message.channelId];
  if (!destinationId) return;
  console.log(`[schematics] message in source channel ${message.channelId} from ${message.author?.tag}`);

  if (
    message.messageSnapshots === undefined &&
    message.reference &&
    message.reference.type === 1
  ) {
    console.warn('[schematics] This is a forwarded message but this discord.js version is too old to read it. Run: npm install discord.js@latest');
  }

  const attachments = collectAttachments(message);
  const files = attachments.filter((a) => !isImage(a));
  if (!files.length) {
    console.log(`[schematics] ignored: no schematic file found (${attachments.length} attachments, snapshots: ${message.messageSnapshots ? message.messageSnapshots.size : 'unsupported'})`);
    return; // nothing to post unless there is a file
  }

  const destination = await message.client.channels.fetch(destinationId).catch(() => null);
  if (!destination || !destination.isTextBased()) {
    console.error(`[schematics] Destination channel ${destinationId} not found or not a text channel.`);
    return;
  }

  const toSend = attachments.slice(0, MAX_FILES_PER_POST);

  let buffers;
  try {
    buffers = await Promise.all(toSend.map(download));
  } catch (err) {
    console.error('[schematics] Could not download the files:', err.message);
    tempReply(message, "Couldn't read those files, try forwarding it again.");
    return;
  }

  // Fingerprints of the schematic files: the file's content and its name.
  const keys = [];
  toSend.forEach((attachment, i) => {
    if (isImage(attachment)) return;
    keys.push(schematics.hashKey(crypto.createHash('sha256').update(buffers[i]).digest('hex')));
    keys.push(schematics.nameKey(attachment.name));
  });

  if (keys.some((key) => inFlight.has(key)) || schematics.findDuplicate(keys)) {
    console.log(`[schematics] blocked as a repeat: ${files.map((f) => f.name).join(', ')}`);
    tempReply(message, 'That schematic has already been posted, so it was not sent again.');
    return;
  }
  keys.forEach((key) => inFlight.add(key));

  try {
    const fileNames = toSend.filter((a) => !isImage(a)).map((a) => a.name);
    const { creatorId, creatorName } = schematics.findCreator(fileNames);
    const title = schematics.makeTitle(fileNames[0], creatorName);

    await destination.send({
      content: buildPostText(title, creatorId),
      files: toSend.map((attachment, i) => new AttachmentBuilder(buffers[i], { name: attachment.name })),
      allowedMentions: { parse: [] },
    });

    // Posted - now it counts.
    schematics.rememberAll(keys, { name: fileNames[0], by: message.author.id, at: Date.now() });
    schematics.addPost(message.author.id);
    if (cfg.alsoAddToStaffPoints) points.addPoints(message.author.id, cfg.pointsPerPost);

    const count = schematics.bumpChannelCount(destination.id);

    if (count % cfg.adEvery === 0) {
      await destination
        .send({
          content: `Hey, are you liking any of these schematics but you don’t want to build them or don’t have time, then feel free to open a <#${cfg.ticketChannelId}> and we can build it for you.`,
          allowedMentions: { parse: [] },
        })
        .catch((err) => console.error('[schematics] Could not send the build request message:', err.message));
    }

    if (count % cfg.pingEvery === 0) {
      const ping = await buildPing(destination.guild);
      await destination.send(ping).catch((err) => console.error('[schematics] Could not send the ping:', err.message));
    }
  } catch (err) {
    console.error('[schematics] Could not post the schematic:', err);
    tempReply(message, "Couldn't post that schematic (the file may be too big for this server).");
  } finally {
    keys.forEach((key) => inFlight.delete(key));
  }
}

// Buttons under /staff-leaderboard: switches the board between staff points
// and schematic posts.
async function handleStaffBoardButton(interaction) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: 'You do not have permission to use this.', ephemeral: true });
  }
  const board = interaction.customId === 'staff_lb_schematics' ? buildSchematicBoard() : buildPointsBoard();
  await interaction.update(board);
}

module.exports = { handleSchematicMessage, handleStaffBoardButton };
