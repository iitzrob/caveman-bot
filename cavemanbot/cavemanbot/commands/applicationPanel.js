const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

// Discord only lets a ">>>" block-quote run from where it starts to the end
// of the message — there's no way to close it early. So each section's list
// uses "> " on every line instead: consecutive "> " lines render as one
// quoted block (the same look as >>>), but it stops the moment a
// non-quoted line (the next bold header) follows, keeping each section's
// quote separate instead of swallowing everything underneath it.
const APPLICATIONS_DESCRIPTION = `## Applications

**Partner Manager Requirements:**
> - Must be able to do 2+ partners a day
> - Must always follow our partner requirements
> - Do at least three waves per week (10+ servers) with us at the bottom everywhere, and we will only ping partners

**Staff Requirements:**
> - Must currently be active in some way
> - Must have a balance of 150M+
> - Be creative, active, mature, professional & friendly
> - Have good experience

**Builder Requirements:**
> - Must have access to a Java account and Litematica
> - Must have a balance of 250M+
> - Must have 25+ vouches or be trusted in some other way

**Note:**
> - If you get denied, you can't apply again for 1 week
> - If you ask any staff about your application, we will instantly deny it
> - You must have 2FA enabled
> - You must be 13+ to apply for any position`;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('application-panel')
    .setDescription('Post the staff/builder applications panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(APPLICATIONS_DESCRIPTION);

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('application_select')
        .setPlaceholder('Select an application type')
        .addOptions(
          { label: 'Staff/Helper Applications', value: 'staff_helper' },
          { label: 'Builder Applications', value: 'builder' },
          { label: 'Partner Manager Applications', value: 'partner_manager' }
        )
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: 'Application panel posted.', ephemeral: true });
  },
};
