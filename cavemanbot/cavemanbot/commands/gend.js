const { SlashCommandBuilder } = require('discord.js');
const { store, canManage, endGiveaway } = require('../utils/giveaways');

// /gend <message_id> — ends a running giveaway right now and picks winners.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('gend')
    .setDescription('End a giveaway now (staff only)')
    .addStringOption((o) =>
      o.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true)
    )
    .setDMPermission(false),

  async execute(interaction) {
    if (!canManage(interaction)) {
      return interaction.reply({ content: 'You do not have permission to use this.', ephemeral: true });
    }

    const id = interaction.options.getString('message_id').trim();
    const g = store.get(id);
    if (!g || g.guildId !== interaction.guild.id) {
      return interaction.reply({ content: 'No giveaway found with that message ID.', ephemeral: true });
    }
    if (g.ended) {
      return interaction.reply({ content: 'That giveaway has already ended.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    await endGiveaway(interaction.client, id, { early: true });
    return interaction.editReply({ content: 'Giveaway ended.' });
  },
};
