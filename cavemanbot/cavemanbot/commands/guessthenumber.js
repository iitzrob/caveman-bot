const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const COOLDOWN_MS = 15 * 1000;
const GAME_TIMEOUT_MS = 60 * 1000;
const MIN_NUMBER = 1;
const MAX_NUMBER = 60;

const UP_EMOJI = '⬆️';
const DOWN_EMOJI = '⬇️';
const CORRECT_EMOJI = '✅';

// user id -> timestamp they can next use the command
const cooldowns = new Map();

function startEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Guess the Number')
    .setDescription(`I'm thinking of a number between **${MIN_NUMBER}** and **${MAX_NUMBER}**.`);
}

function wonEmbed(username, guesses, answer) {
  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Correct')
    .setDescription(`**${username}** found the number.`)
    .addFields(
      { name: 'Number', value: `${answer}`, inline: true },
      { name: 'Guesses', value: `${guesses}`, inline: true },
    );
}

function expiredEmbed(answer) {
  return new EmbedBuilder()
    .setColor(0x95a5a6)
    .setTitle('Guess the Number')
    .setDescription(`Time's up. The number was **${answer}**.`);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guessthenumber')
    .setDescription(`Guess a number between ${MIN_NUMBER} and ${MAX_NUMBER}`),

  async execute(interaction) {
    const user = interaction.user;

    const now = Date.now();
    const readyAt = cooldowns.get(user.id) || 0;
    if (now < readyAt) {
      const secondsLeft = Math.ceil((readyAt - now) / 1000);
      return interaction.reply({
        content: `Slow down — you can play again in ${secondsLeft}s.`,
        ephemeral: true,
      });
    }
    cooldowns.set(user.id, now + COOLDOWN_MS);

    const answer = Math.floor(Math.random() * (MAX_NUMBER - MIN_NUMBER + 1)) + MIN_NUMBER;
    let guesses = 0;
    let won = false;

    const gameMessage = await interaction.reply({
      embeds: [startEmbed()],
      fetchReply: true,
    });

    const collector = interaction.channel.createMessageCollector({
      filter: (m) => m.author.id === user.id && /^\d+$/.test(m.content.trim()),
      time: GAME_TIMEOUT_MS,
    });

    collector.on('collect', async (m) => {
      const guess = parseInt(m.content.trim(), 10);
      guesses += 1;

      if (guess === answer) {
        won = true;
        collector.stop('won');
        await m.react(CORRECT_EMOJI).catch(() => {});
        await m.reply({
          embeds: [wonEmbed(user.toString(), guesses, answer)],
        }).catch((err) => console.error('[guessthenumber] win reply failed:', err));
        return;
      }

      await m.react(guess < answer ? UP_EMOJI : DOWN_EMOJI).catch(() => {});
    });

    collector.on('end', async () => {
      if (!won) {
        await gameMessage.edit({
          embeds: [expiredEmbed(answer)],
        }).catch((err) => console.error('[guessthenumber] expired edit failed:', err));
      }
    });
  },
};
