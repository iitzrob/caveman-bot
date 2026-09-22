const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

const RULES = [
  'Must be 14+ years old.',
  'Must show previous building or staffing experience.',
  'Be honest in your application.',
  'Low-effort applications may be denied.',
  'Troll applications will result in a 6-month blacklist.',
  'If denied, wait 2 weeks before reapplying.',
  'Asking staff to check your application will result in an instant denial.',
  'Staff decisions are final.',
].map((rule, i) => `${i + 1}. ${rule}`).join('\n');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('application-panel')
    .setDescription('Post the staff/builder applications panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Applications')
      .setColor(0x2b2d31)
      .setDescription(RULES);

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('application_select')
        .setPlaceholder('Select an application type')
        .addOptions(
          { label: 'Staff/Helper Applications', value: 'staff_helper' },
          { label: 'Builder Applications', value: 'builder' }
        )
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: 'Application panel posted.', ephemeral: true });
  },
};
