const { SlashCommandBuilder } = require('discord.js');
const { store, canManage, rerollGiveaway } = require('../utils/giveaways');

// /greroll <message_id> [winners] — picks new winner(s) for an ended giveaway.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('greroll')
    .setDescription('Reroll the winner of an ended giveaway (staff only)')
    .addStringOption((o) =>
      o.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true)
    )
    .addIntegerOption((o) =>
      o.setName('winners').setDescription('How many new winners (default 1)').setMinValue(1).setMaxValue(20)
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
    if (!g.ended) {
      return interaction.reply({
        content: 'That giveaway is still running. Use `/gend` to end it first.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });
    const result = await rerollGiveaway(interaction.client, id, interaction.options.getInteger('winners') || 1);
    return interaction.editReply({
      content: result?.winners.length ? 'Rerolled.' : 'There were no valid entrants to reroll.',
    });
  },
};
