const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const vouches = require('../utils/vouches');
const { buildResultEmbed, resolvedPanels } = require('../utils/vouchSendPanel');

// Call this from index.js's InteractionCreate handler for button customIds
// starting with "vouchsend_yes:" or "vouchsend_no:".
async function handleVouchSendButton(interaction) {
  const [action, targetId, runnerId] = interaction.customId.split(':');
  const isYes = action === 'vouchsend_yes';

  // Only the person who was asked can answer this — not the requester,
  // not anyone else who happens to be in the channel.
  if (interaction.user.id !== targetId) {
    return interaction.reply({ content: "This vouch request isn't for you.", ephemeral: true });
  }

  // One-shot panel: the first (valid) click wins.
  if (resolvedPanels.has(interaction.message.id)) {
    return interaction.reply({ content: 'This request has already been answered.', ephemeral: true });
  }
  resolvedPanels.add(interaction.message.id);

  if (!isYes) {
    return interaction.update({
      embeds: [buildResultEmbed(`No vouch was given for <@${runnerId}>.`)],
      components: [],
    });
  }

  // targetId (the person who clicked) is the voucher; runnerId (whoever
  // ran /vouch-send) is who receives the vouch.
  vouches.addVouch(runnerId, interaction.user.id, null, false);

  await interaction.update({
    embeds: [buildResultEmbed(`<@${interaction.user.id}> vouched <@${runnerId}> successfully!`)],
    components: [],
  });

  const staffVouchChannelId = (config.vouches || {}).staffVouchChannelId;
  if (!staffVouchChannelId) return;

  try {
    const channel = await interaction.client.channels.fetch(staffVouchChannelId);
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setDescription(`<@${interaction.user.id}> vouched <@${runnerId}>!`)
          .setColor(0xfee75c),
      ],
    });
  } catch (err) {
    console.error('Failed to post staff vouch announcement:', err);
  }
}

module.exports = { handleVouchSendButton };
