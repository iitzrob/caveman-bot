const { SlashCommandBuilder } = require('discord.js');
const { isStaff } = require('../utils/permissions');
const config = require('../config');

// "Higher ups" gate: if config.vouches.higherUpsRoleId is set, you need
// that role (staff/Administrator can always use it too). If it's left
// blank, any staff member can use this.
function canManageScammers(member) {
  const roleId = (config.vouches || {}).higherUpsRoleId;
  if (isStaff(member)) return true;
  if (roleId) return member.roles.cache.has(roleId);
  return false;
}

// /scam-vouch add user:@user   — confirms a scam report, gives the scammer role
// /scam-vouch remove user:@user — undoes that
module.exports = {
  data: new SlashCommandBuilder()
    .setName('scam-vouch')
    .setDescription('Manage confirmed scammers')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Mark a user as a confirmed scammer and give them the scammer role')
        .addUserOption((opt) => opt.setName('user').setDescription('The user to mark').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove the scammer role from a user')
        .addUserOption((opt) => opt.setName('user').setDescription('The user to unmark').setRequired(true))
    ),

  async execute(interaction) {
    if (!canManageScammers(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this.', ephemeral: true });
    }

    const roleId = (config.vouches || {}).scammerRoleId;
    if (!roleId) {
      return interaction.reply({
        content: 'config.vouches.scammerRoleId is not set in config.js — paste the scammer role id in there first.',
        ephemeral: true,
      });
    }

    const target = interaction.options.getUser('user');
    const sub = interaction.options.getSubcommand();

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      return interaction.reply({ content: "That user isn't in this server.", ephemeral: true });
    }

    try {
      if (sub === 'add') {
        await member.roles.add(roleId);
        await interaction.reply({ content: `<@${target.id}> has been marked as a scammer.` });
      } else {
        await member.roles.remove(roleId);
        await interaction.reply({ content: `<@${target.id}> is no longer marked as a scammer.` });
      }
    } catch (err) {
      console.error('Failed to update scammer role:', err);
      await interaction.reply({ content: `Something went wrong.\n\`\`\`${err.message}\`\`\``, ephemeral: true });
    }
  },
};
