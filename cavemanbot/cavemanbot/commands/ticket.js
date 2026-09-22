const { SlashCommandBuilder } = require('discord.js');
const { closeChannel, renameChannel } = require('../utils/ticketActions');

// /ticket close — closes the current ticket/application channel.
// /ticket rename <name> — renames it.
// Both just call straight into utils/ticketActions.js, same as the button
// versions of these actions.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket management commands (staff only)')
    .addSubcommand((sub) =>
      sub.setName('close').setDescription('Close the current ticket or application channel')
    )
    .addSubcommand((sub) =>
      sub
        .setName('rename')
        .setDescription('Rename the current ticket or application channel')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('New channel name').setRequired(true)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'close') {
      return closeChannel(interaction);
    }

    if (sub === 'rename') {
      const newName = interaction.options.getString('name');
      return renameChannel(interaction, newName);
    }
  },
};
