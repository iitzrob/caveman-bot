const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const vouches = require('../utils/vouches');

const PAGE_SIZE = 5;
const VOUCH_COLOR = 0xfee75c; // plain yellow, no emojis anywhere in this embed
const COLLECTOR_TIME_MS = 5 * 60 * 1000; // 5 minutes to page through

// Plain text throughout — the bold-unicode styling is reserved for
// applications only.
function buildEmbed(target, entries, page, totalPages) {
  const start = page * PAGE_SIZE;
  const pageEntries = entries.slice(start, start + PAGE_SIZE);

  const description = pageEntries.length
    ? pageEntries
        .map((entry, i) => {
          const tag = entry.scam ? ' — ⚠️ SCAM REPORT' : '';
          const line = `${start + i + 1}. <@${entry.voucherId}>${tag}`;
          return `${line}\n${entry.comment ? entry.comment : 'No comment left.'}`;
        })
        .join('\n\n')
    : 'No vouches yet.';

  return new EmbedBuilder()
    .setTitle(`${target.username}'s Vouches`)
    .setDescription(description)
    .setColor(VOUCH_COLOR)
    .setFooter({
      text: `Page ${page + 1} of ${totalPages} — ${entries.length} total vouch${entries.length === 1 ? '' : 'es'}`,
    });
}

function buildRow(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('vouchsee_prev')
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('vouchsee_next')
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1)
  );
}

// /vouchsee [user] — shows the vouches left for `user` (defaults to whoever
// ran the command) as a paged plain-yellow embed. Only the person who ran
// the command can flip pages; the buttons disable themselves once the
// collector times out.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('vouchsee')
    .setDescription("See a user's vouches")
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Whose vouches to see (defaults to you)')
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const entries = vouches.getVouches(target.id).slice().reverse(); // newest first
    const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
    let page = 0;

    const message = await interaction.reply({
      embeds: [buildEmbed(target, entries, page, totalPages)],
      components: totalPages > 1 ? [buildRow(page, totalPages)] : [],
      fetchReply: true,
    });

    if (totalPages <= 1) return;

    const collector = message.createMessageComponentCollector({ time: COLLECTOR_TIME_MS });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: "These buttons aren't for you.", ephemeral: true });
      }

      if (i.customId === 'vouchsee_prev') page = Math.max(0, page - 1);
      if (i.customId === 'vouchsee_next') page = Math.min(totalPages - 1, page + 1);

      await i.update({
        embeds: [buildEmbed(target, entries, page, totalPages)],
        components: [buildRow(page, totalPages)],
      });
    });

    collector.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};
