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

function renderBoardText(board) {
  const symbol = (v) => (v === 'X' ? '❌' : v === 'O' ? '⭕' : '⬜');
  let out = '';
  for (let r = 0; r < 3; r++) {
    out += board.slice(r * 3, r * 3 + 3).map(symbol).join(' ') + '\n';
  }
  return out;
}

// Every cell label is an emoji (❌ / ⭕ / ⬜) so every button renders the
// same width — mixing an emoji with a blank/zero-width label is what made
// buttons change size between empty and filled cells.
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
          .setLabel(val === 'X' ? '❌' : val === 'O' ? '⭕' : '⬜')
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
    .setColor(0xf1c40f)
    .setAuthor({ name: challenger.username, iconURL: challenger.displayAvatarURL() })
    .setTitle('⚔️ Tic Tac Toe Duel')
    .setDescription(
      `${opponent}, **${challenger}** has challenged you to a game of Tic Tac Toe!\n\nDo you accept?`
    )
    .setFooter({ text: 'This challenge expires in 60 seconds' })
    .setTimestamp();
}

function buildGameEmbed({ playerX, playerO, turn, board, result }) {
  const embed = new EmbedBuilder()
    .setTitle('🎮 Tic Tac Toe')
    .setDescription(`\`\`\`\n${renderBoardText(board)}\`\`\``)
    .addFields(
      { name: '❌ Player X', value: `${playerX}`, inline: true },
      { name: '⭕ Player O', value: `${playerO}`, inline: true },
    )
    .setTimestamp();

  if (result === 'draw') {
    embed.setColor(0x95a5a6).setFooter({ text: "It's a draw! 🤝" });
  } else if (result === 'X' || result === 'O') {
    const winner = result === 'X' ? playerX : playerO;
    embed.setColor(0x2ecc71)
      .setAuthor({ name: `${winner.username} wins! 🏆`, iconURL: winner.displayAvatarURL() })
      .setFooter({ text: 'GG! Use /tictactoe to play again' });
  } else {
    const current = turn === 'X' ? playerX : playerO;
    embed.setColor(turn === 'X' ? 0xe74c3c : 0x3498db)
      .setAuthor({ name: `${current.username}'s turn`, iconURL: current.displayAvatarURL() })
      .setFooter({ text: `Playing as ${turn}` });
  }

  return embed;
}

function expiredEmbed(opponent, challenger) {
  return new EmbedBuilder()
    .setColor(0x95a5a6)
    .setTitle('⏱️ Duel Expired')
    .setDescription(`${opponent} didn't respond in time. The duel from ${challenger} has expired.`);
}

function deniedEmbed(opponent, challenger) {
  return new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle('❌ Duel Denied')
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
      new ButtonBuilder().setCustomId('ttt_accept').setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji('✅'),
      new ButtonBuilder().setCustomId('ttt_deny').setLabel('Deny').setStyle(ButtonStyle.Danger).setEmoji('❌'),
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
        content: `${playerX} ⚔️ ${playerO}`,
        embeds: [buildGameEmbed({ playerX, playerO, turn, board, result })],
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
          embeds: [buildGameEmbed({ playerX, playerO, turn, board, result })],
          components: buildBoardButtons(board, !!result),
        });
      });

      gameCollector.on('end', async (_collected, reason) => {
        if (reason === 'time') {
          const timedOutEmbed = buildGameEmbed({ playerX, playerO, turn, board, result })
            .setColor(0x95a5a6)
            .setFooter({ text: '⏱️ Game timed out from inactivity' });
          await challengeMessage.edit({
            embeds: [timedOutEmbed],
            components: buildBoardButtons(board, true),
          }).catch((err) => console.error('[tictactoe] game timeout edit failed:', err));
        }
      });
    });

    challengeCollector.on('end', async (_collected, reason) => {
      // Only true if 60s passed and neither Accept nor Deny was ever clicked.
      console.log(`[tictactoe] challenge collector ended — responded: ${responded}, reason: ${reason}`);
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
