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

function checkResult(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]; // 'X' or 'O'
    }
  }
  if (board.every((cell) => cell)) return 'draw';
  return null;
}

function buildBoard(board, locked) {
  const rows = [];
  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      const val = board[i];
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`ttt_${i}`)
          .setLabel(val || '\u200b') // zero-width space keeps empty cells same size
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

function buildEmbed({ playerX, playerO, turn, board, result }) {
  const embed = new EmbedBuilder()
    .setTitle('🎮 Tic Tac Toe')
    .addFields(
      { name: '❌ X', value: `${playerX}`, inline: true },
      { name: 'VS', value: '\u200b', inline: true },
      { name: '⭕ O', value: `${playerO}`, inline: true },
    );

  if (result === 'draw') {
    embed.setColor(0x95a5a6).setDescription("**It's a draw!** 🤝");
  } else if (result === 'X' || result === 'O') {
    const winner = result === 'X' ? playerX : playerO;
    embed.setColor(0x2ecc71).setDescription(`**${winner} wins!** 🎉`);
  } else {
    const current = turn === 'X' ? playerX : playerO;
    embed.setColor(0x5865f2).setDescription(`It's ${current}'s turn — playing **${turn}**`);
  }

  return embed;
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
      return interaction.reply({ content: "You can't play against a bot.", ephemeral: true });
    }
    if (opponent.id === challenger.id) {
      return interaction.reply({ content: "You can't play against yourself.", ephemeral: true });
    }

    const board = Array(9).fill(null);

    // Coin flip for who plays X (goes first)
    const startsFirst = Math.random() < 0.5 ? challenger : opponent;
    const playerX = startsFirst;
    const playerO = startsFirst.id === challenger.id ? opponent : challenger;

    let turn = 'X';
    let result = null;

    const message = await interaction.reply({
      embeds: [buildEmbed({ playerX, playerO, turn, board, result })],
      components: buildBoard(board, false),
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      time: 5 * 60 * 1000, // 5 minute inactivity timeout
    });

    collector.on('collect', async (i) => {
      const expectedPlayer = turn === 'X' ? playerX : playerO;

      // Wrong turn, or someone who isn't in this game at all
      if (i.user.id !== expectedPlayer.id) {
        const inGame = i.user.id === challenger.id || i.user.id === opponent.id;
        return i.reply({
          content: inGame ? "It's not your turn." : "This isn't your game.",
          ephemeral: true,
        });
      }

      const index = parseInt(i.customId.split('_')[1], 10);
      if (board[index]) {
        return i.deferUpdate(); // cell already taken, ignore silently
      }

      board[index] = turn;
      result = checkResult(board);

      if (!result) {
        turn = turn === 'X' ? 'O' : 'X';
      } else {
        collector.stop('finished');
      }

      await i.update({
        embeds: [buildEmbed({ playerX, playerO, turn, board, result })],
        components: buildBoard(board, !!result),
      });
    });

    collector.on('end', async (_collected, reason) => {
      if (reason === 'time') {
        const timedOutEmbed = buildEmbed({ playerX, playerO, turn, board, result })
          .setColor(0x95a5a6)
          .setDescription('⏱️ Game timed out from inactivity.');
        await message.edit({
          embeds: [timedOutEmbed],
          components: buildBoard(board, true),
        }).catch(() => {});
      }
    });
  },
};
