const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');
const ticketStore = require('./ticketStore');
const { isStaff } = require('./permissions');
const builds = require('./builds');

// 2 hours. Administrators skip this check entirely.
const COOLDOWN_MS = 2 * 60 * 60 * 1000;

function formatRemaining(ms) {
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

// /build-finish — staff run this INSIDE the ticket they built in. It only
// works in a ticket channel (needs an openerId to ask). Running it doesn't
// log the finish right away — it posts an Agree/Disagree prompt for the
// ticket opener (the person who asked for the build), same pattern as
// Request Close. Only they can answer, and the finish (and the staff
// member's cooldown reset) only happens once they hit Agree.
async function requestBuildFinish(interaction) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: 'You do not have permission to use this.', ephemeral: true });
  }

  const meta = ticketStore.get(interaction.channel.id);
  if (!meta || !meta.openerId) {
    return interaction.reply({ content: 'This can only be used inside a ticket.', ephemeral: true });
  }

  const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
  if (!isAdmin) {
    const remaining = builds.getCooldownRemaining(interaction.user.id, COOLDOWN_MS);
    if (remaining > 0) {
      return interaction.reply({
        content: `You can log another finished build in ${formatRemaining(remaining)}.`,
        ephemeral: true,
      });
    }
  }

  const embed = new EmbedBuilder()
    .setDescription(`<@${meta.openerId}>, ${interaction.user} says this build is finished. Do you agree?`)
    .setColor(0x2b2d31);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`build_finish_agree:${interaction.user.id}`)
      .setLabel('Agree')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`build_finish_disagree:${interaction.user.id}`)
      .setLabel('Disagree')
      .setStyle(ButtonStyle.Danger)
  );

  // The ping goes in the message content — mentions inside an embed show
  // the name but don't notify anyone.
  await interaction.reply({
    content: `<@${meta.openerId}>`,
    embeds: [embed],
    components: [row],
  });
}

async function handleBuildFinishAgree(interaction) {
  const meta = ticketStore.get(interaction.channel.id);
  if (!meta || !meta.openerId) {
    return interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true });
  }
  if (interaction.user.id !== meta.openerId) {
    return interaction.reply({ content: `Only <@${meta.openerId}> can respond to this.`, ephemeral: true });
  }

  const staffId = interaction.customId.split(':')[1];
  const updated = builds.recordFinish(staffId);

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setDescription(
          `${interaction.user} confirmed <@${staffId}> finished this build. That's **${updated.count}** total.`
        )
        .setColor(0x2b2d31),
    ],
    components: [],
  });
}

async function handleBuildFinishDisagree(interaction) {
  const meta = ticketStore.get(interaction.channel.id);
  if (!meta || !meta.openerId) {
    return interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true });
  }
  if (interaction.user.id !== meta.openerId) {
    return interaction.reply({ content: `Only <@${meta.openerId}> can respond to this.`, ephemeral: true });
  }

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setDescription(`${interaction.user} said this build is not finished yet.`)
        .setColor(0x2b2d31),
    ],
    components: [],
  });
}

module.exports = { requestBuildFinish, handleBuildFinishAgree, handleBuildFinishDisagree };
