const { SlashCommandBuilder } = require('discord.js');
const vouches = require('../utils/vouches');

// /vouch user: [comment] — leaves a vouch for `user` from whoever ran the
// command. Comment is optional; /vouchsee shows both on request.
// Plain text throughout — the bold-unicode styling is reserved for
// applications only.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('vouch')
    .setDescription('Leave a vouch for someone')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('The user to vouch for').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('comment').setDescription('Optional comment to go with your vouch').setMaxLength(500)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const comment = interaction.options.getString('comment');

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: "You can't vouch for yourself.", ephemeral: true });
    }
    if (target.bot) {
      return interaction.reply({ content: "You can't vouch for a bot.", ephemeral: true });
    }

    vouches.addVouch(target.id, interaction.user.id, comment);

    let msg = `Vouch added for <@${target.id}> by <@${interaction.user.id}>.`;
    if (comment) msg += `\nComment: ${comment}`;

    await interaction.reply({ content: msg });
  },
};
