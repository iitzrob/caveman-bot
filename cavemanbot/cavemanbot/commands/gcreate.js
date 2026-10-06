const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { store, canManage, parseDuration, activeContent, activeEmbed, activeRow } = require('../utils/giveaways');

const MIN_MS = 10 * 1000;
const MAX_MS = 30 * 24 * 60 * 60 * 1000;

// /gcreate <prize> <duration> [winners] [description] [channel]
module.exports = {
  data: new SlashCommandBuilder()
    .setName('gcreate')
    .setDescription('Start a giveaway (staff only)')
    .addStringOption((o) => o.setName('prize').setDescription('What are you giving away?').setRequired(true).setMaxLength(200))
    .addStringOption((o) =>
      o.setName('duration').setDescription('How long? e.g. 30m, 2h, 1d, 1d12h').setRequired(true)
    )
    .addIntegerOption((o) =>
      o.setName('winners').setDescription('Number of winners (default 1)').setMinValue(1).setMaxValue(20)
    )
    .addStringOption((o) =>
      o.setName('description').setDescription('Extra text shown under the prize').setMaxLength(500)
    )
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Where to post it (default: this channel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .setDMPermission(false),

  async execute(interaction) {
    if (!canManage(interaction)) {
      return interaction.reply({ content: 'You do not have permission to use this.', ephemeral: true });
    }

    const prize = interaction.options.getString('prize');
    const ms = parseDuration(interaction.options.getString('duration'));
    const winnerCount = interaction.options.getInteger('winners') || 1;
    const description = interaction.options.getString('description');
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    if (!ms || ms < MIN_MS || ms > MAX_MS) {
      return interaction.reply({
        content: 'Invalid duration. Use something like `30m`, `2h`, `1d` or `1d12h` (10 seconds to 30 days).',
        ephemeral: true,
      });
    }

    const botPerms = channel.permissionsFor(interaction.guild.members.me);
    if (!botPerms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
      return interaction.reply({
        content: `I need **View Channel**, **Send Messages** and **Embed Links** in ${channel}.`,
        ephemeral: true,
      });
    }

    const g = {
      messageId: null,
      channelId: channel.id,
      guildId: interaction.guild.id,
      prize,
      description: description || null,
      hostId: interaction.user.id,
      hostName: interaction.member?.displayName || interaction.user.username,
      hostAvatar: interaction.user.displayAvatarURL(),
      endsAt: Date.now() + ms,
      winnerCount,
      entries: [],
      ended: false,
      winners: [],
    };

    await interaction.deferReply({ ephemeral: true });

    const message = await channel.send({
      content: activeContent(),
      embeds: [activeEmbed(g)],
      components: [activeRow(g)],
    });
    g.messageId = message.id;
    store.set(message.id, g);

    return interaction.editReply({
      content: `Giveaway started in ${channel}.\nMessage ID: \`${message.id}\``,
    });
  },
};
