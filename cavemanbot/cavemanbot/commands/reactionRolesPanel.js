const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../config');
const { parseEmoji } = require('../utils/parseEmoji');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reaction-roles-panel')
    .setDescription('Post the reaction-roles panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const guild = interaction.guild;
    const entries = config.reactionRoles || [];

    const lines = entries.map((e) => `${e.emoji} = ${e.label}`).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setAuthor({ name: "Cavemen's Club", iconURL: guild.iconURL() || undefined })
      .setTitle('Reaction roles')
      .setDescription(`**React if you want to be pinged for any of these**\n${lines}`)
      .setFooter({ text: 'Re-react if you want to remove that ping' });

    const message = await interaction.channel.send({ embeds: [embed] });

    for (const entry of entries) {
      const parsed = parseEmoji(entry.emoji);
      const identifier = typeof parsed === 'string' ? parsed : `${parsed.name}:${parsed.id}`;
      await message.react(identifier).catch((err) =>
        console.error(`[reaction roles] Failed to react with ${entry.emoji}:`, err.message)
      );
    }

    await interaction.reply({ content: 'Reaction-roles panel posted.', ephemeral: true });
  },
};
