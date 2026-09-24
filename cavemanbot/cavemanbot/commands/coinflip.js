const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');

const PICK_TIMEOUT_MS = 30 * 1000;
const FLIP_DELAY_MS = 1800;

const SPIN_MENTION = '<a:933416goldenspincoin:1552534300161867776>';
const HEADS_MENTION = '<:60581heads:1552534716169584710>';
const TAILS_MENTION = '<:41056tails:1552534688546168944>';

const HEADS_EMOJI = { id: '1552534716169584710', name: '60581heads' };
const TAILS_EMOJI = { id: '1552534688546168944', name: '41056tails' };

function pickEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Coin Flip')
    .setDescription('Pick a side');
}

function flippingEmbed() {
  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('Coin Flip')
    .setDescription(`${SPIN_MENTION} Flipping...`);
}

function resultEmbed(choice, outcome, username) {
  const outcomeMention = outcome === 'heads' ? HEADS_MENTION : TAILS_MENTION;
  const won = choice === outcome;
  return new EmbedBuilder()
    .setColor(won ? 0x2ecc71 : 0xe74c3c)
    .setTitle('Coin Flip')
    .setDescription(`${outcomeMention} It's **${outcome}**`)
    .setFooter({ text: won ? `${username} guessed right` : `${username} guessed wrong` });
}

function expiredEmbed() {
  return new EmbedBuilder()
    .setColor(0x95a5a6)
    .setTitle('Coin Flip')
    .setDescription("Didn't pick in time.");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Flip a coin and guess heads or tails'),

  async execute(interaction) {
    const user = interaction.user;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('coin_heads')
        .setLabel('Heads')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(HEADS_EMOJI),
      new ButtonBuilder()
        .setCustomId('coin_tails')
        .setLabel('Tails')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(TAILS_EMOJI),
    );

    const message = await interaction.reply({
      embeds: [pickEmbed()],
      components: [row],
      fetchReply: true,
    });

    let responded = false;

    const collector = message.createMessageComponentCollector({
      time: PICK_TIMEOUT_MS,
      max: 1,
      filter: (i) => i.customId === 'coin_heads' || i.customId === 'coin_tails',
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== user.id) {
        return i.reply({ content: "This isn't your coin flip.", ephemeral: true });
      }

      responded = true;
      const choice = i.customId === 'coin_heads' ? 'heads' : 'tails';

      await i.update({
        embeds: [flippingEmbed()],
        components: [],
      });

      await new Promise((resolve) => setTimeout(resolve, FLIP_DELAY_MS));

      const outcome = Math.random() < 0.5 ? 'heads' : 'tails';

      await message.edit({
        embeds: [resultEmbed(choice, outcome, user.username)],
      }).catch((err) => console.error('[coinflip] result edit failed:', err));
    });

    collector.on('end', async () => {
      if (!responded) {
        await message.edit({
          embeds: [expiredEmbed()],
          components: [],
        }).catch((err) => console.error('[coinflip] expired edit failed:', err));
      }
    });
  },
};
