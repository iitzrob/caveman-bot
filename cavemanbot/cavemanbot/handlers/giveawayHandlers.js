const { store, ENTER_ID, activeContent, activeEmbed, activeRow } = require('../utils/giveaways');

// Enter / leave a giveaway by clicking the button.
async function handleGiveawayButton(interaction) {
  if (interaction.customId !== ENTER_ID) return;

  const g = store.get(interaction.message.id);
  if (!g) {
    return interaction.reply({ content: 'I can’t find that giveaway.', ephemeral: true });
  }
  if (g.ended || g.endsAt <= Date.now()) {
    return interaction.reply({ content: 'This giveaway has already ended.', ephemeral: true });
  }

  const entered = g.entries.includes(interaction.user.id);
  g.entries = entered
    ? g.entries.filter((id) => id !== interaction.user.id)
    : [...g.entries, interaction.user.id];
  store.set(g.messageId, g);

  await interaction.update({
    content: activeContent(),
    embeds: [activeEmbed(g)],
    components: [activeRow(g)],
  });
  await interaction
    .followUp({
      content: entered ? 'You left the giveaway.' : 'You’re in! Good luck 🎉',
      ephemeral: true,
    })
    .catch(() => {});
}

module.exports = { handleGiveawayButton };
