const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const categories = require('../data/ticketCategories');
const config = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Post the ticket creation panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle("Tickets")
      .setDescription(config.ticketPanelDescription);

    const row = new ActionRowBuilder().addComponents(
      categories.map(c =>
        new ButtonBuilder()
          .setCustomId(`ticket_open_${c.id}`)
          .setLabel(c.label)
          .setEmoji(c.emoji)
          .setStyle(ButtonStyle.Secondary)
      )
    );

    await interaction.channel.send({
      embeds: [embed],
      components: [row],
    });

    await interaction.reply({
      content: "Ticket panel posted.",
      ephemeral: true,
    });
  },
};
