const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');
const createStore = require('./jsonStore');
const { isStaff } = require('./permissions');

// { [messageId]: { messageId, channelId, guildId, prize, hostId, hostName,
//   hostAvatar, endsAt, winnerCount, entries: [userIds], ended, winners: [] } }
const store = createStore('giveaways.json', {});

const ENTER_ID = 'giveaway_enter';
const COLOR_ACTIVE = 0x5865f2;
const COLOR_ENDED = 0x2b2d31;

// Staff role, Administrator, or Manage Server can use the giveaway commands.
function canManage(interaction) {
  const member = interaction.member;
  if (!member) return false;
  return isStaff(member) || interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
}

// "30s", "10m", "2h", "1d", "1w" and combos like "1d12h" -> milliseconds (or null).
function parseDuration(input) {
  const str = String(input || '').toLowerCase().replace(/\s+/g, '');
  if (!/^(\d+[smhdw])+$/.test(str)) return null;
  const units = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  let total = 0;
  for (const [, n, u] of str.matchAll(/(\d+)([smhdw])/g)) total += Number(n) * units[u];
  return total;
}

function footerFor(g) {
  const footer = { text: `Hosted by ${g.hostName}` };
  if (g.hostAvatar) footer.iconURL = g.hostAvatar;
  return footer;
}

function activeEmbed(g) {
  const ts = Math.floor(g.endsAt / 1000);
  return new EmbedBuilder()
    .setColor(COLOR_ACTIVE)
    .setTitle(g.prize)
    .setDescription(
      `Click the button below to enter!\n\n` +
        `**Ends:** <t:${ts}:R> (<t:${ts}:f>)\n` +
        `**Hosted by:** <@${g.hostId}>\n` +
        `**Winners:** ${g.winnerCount}`
    )
    .setFooter(footerFor(g));
}

function endedEmbed(g) {
  const ts = Math.floor(g.endsAt / 1000);
  const winners = g.winners.length ? g.winners.map((id) => `<@${id}>`).join(', ') : 'No valid entrants';
  return new EmbedBuilder()
    .setColor(COLOR_ENDED)
    .setTitle(g.prize)
    .setDescription(
      `**Ended:** <t:${ts}:R> (<t:${ts}:f>)\n` +
        `**Hosted by:** <@${g.hostId}>\n` +
        `**Winners:** ${winners}\n` +
        `**Entries:** ${g.entries.length}`
    )
    .setFooter(footerFor(g));
}

function activeRow(g) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(ENTER_ID)
      .setLabel(`Enter (${g.entries.length})`)
      .setEmoji('🎉')
      .setStyle(ButtonStyle.Primary)
  );
}

function endedRow(g) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(ENTER_ID)
      .setLabel(`Giveaway Ended (${g.entries.length})`)
      .setEmoji('🎉')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );
}

// Random, still-in-the-server winners.
async function pickWinners(guild, entries, count, exclude = []) {
  const pool = entries.filter((id) => !exclude.includes(id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const winners = [];
  for (const id of pool) {
    if (winners.length >= count) break;
    const member = await guild.members.fetch(id).catch(() => null);
    if (member) winners.push(id);
  }
  return winners;
}

async function fetchGiveawayMessage(client, g) {
  const channel = await client.channels.fetch(g.channelId).catch(() => null);
  if (!channel) return { channel: null, message: null };
  const message = await channel.messages.fetch(g.messageId).catch(() => null);
  return { channel, message };
}

async function endGiveaway(client, messageId, { early = false } = {}) {
  const g = store.get(messageId);
  if (!g || g.ended) return null;

  // Mark ended straight away so the timer can't end it twice.
  g.ended = true;
  if (early) g.endsAt = Date.now();
  store.set(messageId, g);

  const guild = await client.guilds.fetch(g.guildId).catch(() => null);
  g.winners = guild ? await pickWinners(guild, g.entries, g.winnerCount) : [];
  store.set(messageId, g);

  const { channel, message } = await fetchGiveawayMessage(client, g);
  if (message) {
    await message.edit({ embeds: [endedEmbed(g)], components: [endedRow(g)] }).catch((err) =>
      console.error('[giveaways] edit on end failed:', err.message)
    );
  }
  if (channel) {
    const text = g.winners.length
      ? `🎉 Congratulations ${g.winners.map((id) => `<@${id}>`).join(', ')}! You won **${g.prize}**!`
      : `No valid entrants, so nobody won **${g.prize}**.`;
    await channel
      .send({
        content: text,
        reply: message ? { messageReference: message.id, failIfNotExists: false } : undefined,
        allowedMentions: { users: g.winners },
      })
      .catch((err) => console.error('[giveaways] winner announce failed:', err.message));
  }
  return g;
}

async function rerollGiveaway(client, messageId, count = 1) {
  const g = store.get(messageId);
  if (!g || !g.ended) return null;

  const guild = await client.guilds.fetch(g.guildId).catch(() => null);
  if (!guild) return { g, winners: [] };

  let winners = await pickWinners(guild, g.entries, count, g.winners);
  // Everyone has already won once — allow repeats rather than failing.
  if (!winners.length) winners = await pickWinners(guild, g.entries, count);

  if (winners.length) {
    g.winners = [...new Set([...g.winners, ...winners])];
    store.set(messageId, g);
  }

  const { channel, message } = await fetchGiveawayMessage(client, g);
  if (channel) {
    await channel
      .send({
        content: winners.length
          ? `🎉 New winner${winners.length === 1 ? '' : 's'}: ${winners.map((id) => `<@${id}>`).join(', ')}! You won **${g.prize}**!`
          : `No valid entrants to reroll for **${g.prize}**.`,
        reply: message ? { messageReference: message.id, failIfNotExists: false } : undefined,
        allowedMentions: { users: winners },
      })
      .catch(() => {});
  }
  if (message && winners.length) {
    await message.edit({ embeds: [endedEmbed(g)], components: [endedRow(g)] }).catch(() => {});
  }
  return { g, winners };
}

// Checks every 10s for giveaways that are due. Survives restarts because
// everything lives in data/giveaways.json.
function startGiveawayTimer(client) {
  const tick = async () => {
    const now = Date.now();
    for (const g of Object.values(store.all())) {
      if (!g.ended && g.endsAt <= now) {
        await endGiveaway(client, g.messageId).catch((err) =>
          console.error('[giveaways] auto end failed:', err)
        );
      }
    }
  };
  tick();
  setInterval(tick, 10 * 1000).unref();
}

module.exports = {
  store,
  ENTER_ID,
  canManage,
  parseDuration,
  activeEmbed,
  activeRow,
  endedRow,
  endedEmbed,
  endGiveaway,
  rerollGiveaway,
  startGiveawayTimer,
};
