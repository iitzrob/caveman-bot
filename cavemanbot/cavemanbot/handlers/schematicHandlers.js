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

// Text of the message itself AND of anything it forwards. Reads the normal text,
// embeds, AND newer "components" messages (text blocks / containers / sections),
// which many bots use instead of plain text.
function embedText(embed) {
  const d = embed && (embed.data || embed);
  if (!d) return '';
  const out = [d.title, d.description];
  for (const f of d.fields || []) out.push(`${f.name}: ${f.value}`);
  if (d.footer && d.footer.text) out.push(d.footer.text);
  return out.filter(Boolean).join('\n');
}

function componentText(node, depth = 0) {
  if (!node || depth > 8) return '';
  const out = [];
  const d = node.data || node;
  if (typeof d.content === 'string') out.push(d.content);
  if (typeof node.content === 'string' && node.content !== d.content) out.push(node.content);
  const kids = [].concat(
    node.components ? [...(node.components.values ? node.components.values() : node.components)] : [],
    d.components && d.components !== node.components ? [...(d.components.values ? d.components.values() : d.components)] : [],
    node.accessory ? [node.accessory] : [],
    d.accessory && d.accessory !== node.accessory ? [d.accessory] : []
  );
  for (const kid of kids) out.push(componentText(kid, depth + 1));
  return out.filter(Boolean).join('\n');
}

function partsOf(m) {
  const parts = [m.content || ''];
  for (const embed of m.embeds || []) parts.push(embedText(embed));
  for (const row of m.components || []) parts.push(componentText(row));
  return parts;
}

function collectText(message) {
  const parts = partsOf(message);
  if (message.messageSnapshots) {
    for (const snapshot of message.messageSnapshots.values()) parts.push(...partsOf(snapshot));
  }
  return parts.filter(Boolean).join('\n');
}

async function download(attachment) {
  const response = await fetch(attachment.url);
  if (!response.ok) throw new Error(`download failed (${response.status}) for ${attachment.name}`);
  return Buffer.from(await response.arrayBuffer());
}

// Finds a custom emoji by name in any server the bot is in, so the template
// can use :ANIMTED_BLUEGEM: etc. without hard-coding ids. Falls back to `fallback`.
function emojiByName(client, name, fallback = '') {
  const emoji = client.emojis.cache.find((e) => e.name === name);
  return emoji ? emoji.toString() : fallback;
}

// creatorName is already a plain username / name (never an @mention).
function buildPostText(client, title, creatorName) {
  const gem = emojiByName(client, 'ANIMTED_BLUEGEM', cfg.emojiBlocks || '');
  const club = emojiByName(client, '25F2FB6B769B4265A375168819C20316', '');
  const lines = [
    `## ${cfg.emojiNo}   DO NOT SHARE THESE SCHEMATICS   ${cfg.emojiNo}`,
    `## ${gem}  ${title} ${gem}`.replace(/\s+\$/, ''),
    `**${club ? club + ' ' : ''}CaveMen Club**`,
    '',
  ];
  if (creatorName) {
    lines.push(`**Original Creator:** ${String(creatorName).replace(/@/g, '')}`);
  }
  lines.push(
    '_Taking this schematic and reposting it in your own server without credit or permission will result in removal of access, scammer roles across partnered servers, and possible blacklist._'
  );
  return lines.join('\n');
}

// A Discord id -> that person's username. Anything else is already a name.
async function toDisplayName(client, guild, value) {
  const text = String(value);
  if (!/^\d{15,25}$/.test(text)) return text.replace(/@/g, '').trim() || null;
  const member = guild && (guild.members.cache.get(text) || (await guild.members.fetch(text).catch(() => null)));
  if (member && member.user) return member.user.username;
  const user = client.users.cache.get(text) || (await client.users.fetch(text).catch(() => null));
  return user ? user.username : null;
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
    // 1) Use what the message text says (title + "Original Creator: ..."),
    // 2) otherwise fall back to the file name.
    const rawText = collectText(message);
    console.log(`[schematics] text seen (${rawText.length} chars): ${JSON.stringify(rawText.slice(0, 1500))}`);
    const textInfo = schematics.readPostText(rawText);
    const fromName = schematics.findCreator(fileNames);
    const blocked = new Set((cfg.blockedCreatorIds || []).map(String));
    // Credit order: message text first, then the file name. Blocked ids are skipped.
    const sources = [['text', textInfo], ['file name', fromName]];
    let creatorId = null;
    let creatorName = null;
    let creatorSource = 'none';
    for (const [label, info] of sources) {
      if (info.creatorId && !blocked.has(String(info.creatorId))) {
        const shown = await toDisplayName(message.client, message.guild, info.creatorId);
        if (!shown) continue; // could not look the user up, try the next source
        creatorId = shown;
        creatorName = shown;
        creatorSource = label;
        break;
      }
    }
    console.log(`[schematics] credit -> ${creatorId || 'none'} (from ${creatorSource})`);
    const title = textInfo.title || schematics.makeTitle(fileNames[0], creatorName);
    console.log(`[schematics] text title: ${textInfo.title || 'none'} | text creator: ${textInfo.creatorName || 'none'}`);

    await destination.send({
      content: buildPostText(message.client, title, creatorId),
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
