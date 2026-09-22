const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const vouches = require('../utils/vouches');
const { votedOnPanel } = require('../utils/vouchSendPanel');

// Call this from index.js's InteractionCreate handler for button customIds
// starting with "vouchsend_yes:" or "vouchsend_no:".
async function handleVouchSendButton(interaction) {
  const [action, targetId] = interaction.customId.split(':');
  const isYes = action === 'vouchsend_yes';

  if (interaction.user.id === targetId) {
    return interaction.reply({ content: "You can't vouch for yourself.", ephemeral: true });
  }

  if (!isYes) {
    return interaction.reply({ content: 'Okay, no vouch added.', ephemeral: true });
  }

  const voted = votedOnPanel.get(interaction.message.id) || new Set();
  if (voted.has(interaction.user.id)) {
    return interaction.reply({ content: "You've already vouched off this request.", ephemeral: true });
  }
  voted.add(interaction.user.id);
  votedOnPanel.set(interaction.message.id, voted);

  vouches.addVouch(targetId, interaction.user.id, null, false);

  await interaction.reply({ content: `You vouched for <@${targetId}>.`, ephemeral: true });

  const staffVouchChannelId = (config.vouches || {}).staffVouchChannelId;
  if (!staffVouchChannelId) return;

  try {
    const channel = await interaction.client.channels.fetch(staffVouchChannelId);
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setDescription(`<@${interaction.user.id}> vouched <@${targetId}>!`)
          .setColor(0xfee75c),
      ],
    });
  } catch (err) {
    console.error('Failed to post staff vouch announcement:', err);
  }
}

module.exports = { handleVouchSendButton };
