const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const GAME_TIMEOUT_MS = 60 * 1000;
const MIN_NUMBER = 1;
const MAX_NUMBER = 60;

const UP_EMOJI = '⬆️';
const DOWN_EMOJI = '⬇️';
const CORRECT_EMOJI = '✅';

// channel id -> true while a game is running there
const activeGames = new Map();

function startEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Guess the Number')
    .setDescription(`I'm thinking of a number between **${MIN_NUMBER}** and **${MAX_NUMBER}**. Anyone in the channel can guess.`);
}

function wonEmbed(username, guesses, answer) {
  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Correct')
    .setDescription(`**${username}** found the number.`)
    .addFields(
      { name: 'Number', value: `${answer}`, inline: true },
      { name: 'Total guesses', value: `${guesses}`, inline: true },
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
    .setName('groupguess')
    .setDescription(`Start a number guessing game (${MIN_NUMBER}-${MAX_NUMBER}) anyone in the channel can play`),

  async execute(interaction) {
    const channelId = interaction.channelId;

    if (activeGames.get(channelId)) {
      return interaction.reply({
        content: 'A game is already running in this channel.',
        ephemeral: true,
      });
    }
    activeGames.set(channelId, true);

    const answer = Math.floor(Math.random() * (MAX_NUMBER - MIN_NUMBER + 1)) + MIN_NUMBER;
    let guesses = 0;
    let won = false;

    const gameMessage = await interaction.reply({
      embeds: [startEmbed()],
      fetchReply: true,
    });

    const collector = interaction.channel.createMessageCollector({
      filter: (m) => !m.author.bot && /^\d+$/.test(m.content.trim()),
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
          embeds: [wonEmbed(m.author.toString(), guesses, answer)],
        }).catch((err) => console.error('[groupguess] win reply failed:', err));
        return;
      }

      await m.react(guess < answer ? UP_EMOJI : DOWN_EMOJI).catch(() => {});
    });

    collector.on('end', async () => {
      activeGames.delete(channelId);
      if (!won) {
        await gameMessage.edit({
          embeds: [expiredEmbed(answer)],
        }).catch((err) => console.error('[groupguess] expired edit failed:', err));
      }
    });
  },
};
