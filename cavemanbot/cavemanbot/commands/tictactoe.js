const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],           // diagonals
];

const COOLDOWN_MS = 10 * 1000;
const CHALLENGE_TIMEOUT_MS = 60 * 1000;
const GAME_TIMEOUT_MS = 5 * 60 * 1000;

const ACCEPT_EMOJI = { id: '1533798048856281168', name: 'Tick234234' };
const DENY_EMOJI = { id: '1533798047618695308', name: 'Cross' };

// challenger id -> timestamp they can next use the command
const cooldowns = new Map();

function checkResult(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]; // 'X' or 'O'
    }
  }
  if (board.every((cell) => cell)) return 'draw';
  return null;
}

// Every cell uses a visible single-character label (X, O, or a placeholder
// dot) so all 9 buttons stay the same size — a blank/invisible label on
// empty cells is what made buttons resize as the board filled in.
function buildBoardButtons(board, locked) {
  const rows = [];
  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      const val = board[i];
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`ttt_${i}`)
          .setLabel(val || '·')
          .setStyle(
            val === 'X' ? ButtonStyle.Danger
              : val === 'O' ? ButtonStyle.Primary
                : ButtonStyle.Secondary
          )
          .setDisabled(!!val || locked)
      );
    }
    rows.push(row);
  }
  return rows;
}

function buildChallengeEmbed(challenger, opponent) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Tic Tac Toe')
    .setDescription(`${opponent}, ${challenger} wants to play. Do you accept?`)
    .setFooter({ text: 'Expires in 60s' });
}

function buildGameEmbed({ playerX, playerO, turn, result }) {
  const embed = new EmbedBuilder()
    .setTitle('Tic Tac Toe')
    .addFields(
      { name: 'X', value: `${playerX}`, inline: true },
      { name: 'O', value: `${playerO}`, inline: true },
    );

  if (result === 'draw') {
    embed.setColor(0x95a5a6).setFooter({ text: "It's a draw" });
  } else if (result === 'X' || result === 'O') {
    const winner = result === 'X' ? playerX : playerO;
    embed.setColor(0x2ecc71).setFooter({ text: `${winner.username} wins` });
  } else {
    const current = turn === 'X' ? playerX : playerO;
    embed.setColor(turn === 'X' ? 0xe74c3c : 0x3498db)
      .setFooter({ text: `${current.username}'s turn (${turn})` });
  }

  return embed;
}

function expiredEmbed(opponent, challenger) {
  return new EmbedBuilder()
    .setColor(0x95a5a6)
    .setTitle('Tic Tac Toe')
    .setDescription(`${opponent} didn't respond in time. Challenge from ${challenger} has expired.`);
}

function deniedEmbed(opponent, challenger) {
  return new EmbedBuilder()
    .setColor(0x95a5a6)
    .setTitle('Tic Tac Toe')
    .setDescription(`${opponent} denied the challenge from ${challenger}.`);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tictactoe')
    .setDescription('Challenge someone to a game of Tic Tac Toe')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Who do you want to play against?')
        .setRequired(true)
    ),

  async execute(interaction) {
    const challenger = interaction.user;
    const opponent = interaction.options.getUser('user');

    if (opponent.bot) {
      return interaction.reply({ content: "You can't challenge a bot.", ephemeral: true });
    }
    if (opponent.id === challenger.id) {
      return interaction.reply({ content: "You can't challenge yourself.", ephemeral: true });
    }

    const now = Date.now();
    const readyAt = cooldowns.get(challenger.id) || 0;
    if (now < readyAt) {
      const secondsLeft = Math.ceil((readyAt - now) / 1000);
      return interaction.reply({
        content: `Slow down — you can send another challenge in ${secondsLeft}s.`,
        ephemeral: true,
      });
    }
    cooldowns.set(challenger.id, now + COOLDOWN_MS);

    const acceptRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ttt_accept').setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji(ACCEPT_EMOJI),
      new ButtonBuilder().setCustomId('ttt_deny').setLabel('Deny').setStyle(ButtonStyle.Danger).setEmoji(DENY_EMOJI),
    );

    const challengeMessage = await interaction.reply({
      content: `${opponent}`,
      embeds: [buildChallengeEmbed(challenger, opponent)],
      components: [acceptRow],
      fetchReply: true,
    });

    // Tracks whether the opponent has already accepted/denied, so the
    // timeout branch can never fire after a real response was handled.
    let responded = false;

    const challengeCollector = challengeMessage.createMessageComponentCollector({
      time: CHALLENGE_TIMEOUT_MS,
      filter: (i) => i.customId === 'ttt_accept' || i.customId === 'ttt_deny',
    });

    challengeCollector.on('collect', async (i) => {
      if (i.user.id !== opponent.id) {
        return i.reply({ content: "This challenge isn't for you.", ephemeral: true });
      }

      responded = true;
      challengeCollector.stop('responded');

      if (i.customId === 'ttt_deny') {
        return i.update({
          content: null,
          embeds: [deniedEmbed(opponent, challenger)],
          components: [],
        });
      }

      // Accepted — start the game
      const board = Array(9).fill(null);
      const startsFirst = Math.random() < 0.5 ? challenger : opponent;
      const playerX = startsFirst;
      const playerO = startsFirst.id === challenger.id ? opponent : challenger;

      let turn = 'X';
      let result = null;

      await i.update({
        content: `${playerX} vs ${playerO}`,
        embeds: [buildGameEmbed({ playerX, playerO, turn, result })],
        components: buildBoardButtons(board, false),
      });

      const gameCollector = challengeMessage.createMessageComponentCollector({
        time: GAME_TIMEOUT_MS,
        filter: (btn) => btn.customId.startsWith('ttt_') && btn.customId !== 'ttt_accept' && btn.customId !== 'ttt_deny',
      });

      gameCollector.on('collect', async (btn) => {
        const expectedPlayer = turn === 'X' ? playerX : playerO;

        if (btn.user.id !== expectedPlayer.id) {
          const inGame = btn.user.id === challenger.id || btn.user.id === opponent.id;
          return btn.reply({
            content: inGame ? "It's not your turn." : "This isn't your game.",
            ephemeral: true,
          });
        }

        const index = parseInt(btn.customId.split('_')[1], 10);
        if (board[index]) {
          return btn.deferUpdate();
        }

        board[index] = turn;
        result = checkResult(board);

        if (!result) {
          turn = turn === 'X' ? 'O' : 'X';
        } else {
          gameCollector.stop('finished');
        }

        await btn.update({
          embeds: [buildGameEmbed({ playerX, playerO, turn, result })],
          components: buildBoardButtons(board, !!result),
        });
      });

      gameCollector.on('end', async (_collected, reason) => {
        if (reason === 'time') {
          const timedOutEmbed = buildGameEmbed({ playerX, playerO, turn, result })
            .setColor(0x95a5a6)
            .setFooter({ text: 'Game timed out' });
          await challengeMessage.edit({
            embeds: [timedOutEmbed],
            components: buildBoardButtons(board, true),
          }).catch((err) => console.error('[tictactoe] game timeout edit failed:', err));
        }
      });
    });

    challengeCollector.on('end', async () => {
      if (!responded) {
        await challengeMessage.edit({
          content: null,
          embeds: [expiredEmbed(opponent, challenger)],
          components: [],
        }).catch((err) => console.error('[tictactoe] expired edit failed:', err));
      }
    });
  },
};
