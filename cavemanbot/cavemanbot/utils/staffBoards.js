const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const points = require('./points');
const schematics = require('./schematics');
const giveawayStats = require('./giveawayStats');
const schematicCfg = require('../schematicConfig');
const { isStaff } = require('./permissions');

const MEDALS = ['🥇', '🥈', '🥉'];

function rankLines(entries, format) {
  return entries.map((entry, i) => {
    const rank = MEDALS[i] || `**${i + 1}.**`;
    return `${rank} <@${entry.userId}> — ${format(entry)}`;
  });
}

// One row with a button for every board. The board you're currently looking
// at has its button greyed out (disabled) so it can't be pressed.
function navRow(active) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('staff_lb_points')
      .setLabel('Staff Points')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(active === 'points'),
    new ButtonBuilder()
      .setCustomId('staff_lb_schematics')
      .setLabel('Schematic Posts')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(active === 'schematics'),
    new ButtonBuilder()
      .setCustomId('staff_lb_giveaways')
      .setLabel('Giveaways')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(active === 'giveaways')
  );
}

// The normal staff points board.
function buildPointsBoard() {
  const list = Object.entries(points.getAll())
    .map(([userId, pts]) => ({ userId, pts }))
    .filter((entry) => entry.pts > 0)
    .sort((a, b) => b.pts - a.pts);

  const description = list.length
    ? rankLines(list, (entry) => `${entry.pts} pts`).join('\n').slice(0, 4096)
    : 'No one has earned any points yet.';

  const embed = new EmbedBuilder()
    .setTitle('🏆 Staff Leaderboard')
    .setDescription(description)
    .setColor(0x2b2d31)
    .setFooter({ text: 'Earn points in tickets — Rename: 3 pts, Close: 2 pts' })
    .setTimestamp();

  return { embeds: [embed], components: [navRow('points')] };
}

// Points for someone's posts: their own rate from pointsPerPostOverrides if
// they have one, otherwise pointsPerPost. Rounded so 3 x 0.35 shows as 1.05.
function pointsFor(userId, posts) {
  const custom = (schematicCfg.pointsPerPostOverrides || {})[String(userId)];
  const rate = typeof custom === 'number' ? custom : schematicCfg.pointsPerPost;
  return Math.round(posts * rate * 100) / 100;
}

// Weekly schematic posts: every post is worth schematicCfg.pointsPerPost,
// except for people with their own rate in pointsPerPostOverrides.
function buildSchematicBoard() {
  const perPost = schematicCfg.pointsPerPost;
  const list = Object.entries(schematics.getWeekly())
    .map(([userId, posts]) => ({ userId, posts, pts: pointsFor(userId, posts) }))
    .filter((entry) => entry.posts > 0)
    .sort((a, b) => b.pts - a.pts || b.posts - a.posts);

  const description = list.length
    ? rankLines(list, (entry) => `${entry.posts} ${entry.posts === 1 ? 'post' : 'posts'} — ${entry.pts} pts`)
        .join('\n')
        .slice(0, 4096)
    : 'No schematics have been posted this week.';

  const embed = new EmbedBuilder()
    .setTitle('Schematic Posts Leaderboard')
    .setDescription(description)
    .setColor(0x2b2d31)
    .setFooter({ text: `Each schematic post earns ${perPost} pts — Resets every Monday at 1:00 AM` })
    .setTimestamp();

  return { embeds: [embed], components: [navRow('schematics')] };
}

// Weekly giveaways hosted per staff member (counted when /gcreate is used).
function buildGiveawayBoard() {
  const list = Object.entries(giveawayStats.getWeekly())
    .map(([userId, count]) => ({ userId, count }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  const description = list.length
    ? rankLines(list, (entry) => `${entry.count} ${entry.count === 1 ? 'giveaway' : 'giveaways'}`)
        .join('\n')
        .slice(0, 4096)
    : 'No giveaways have been hosted this week.';

  const embed = new EmbedBuilder()
    .setTitle('Giveaways Leaderboard')
    .setDescription(description)
    .setColor(0x2b2d31)
    .setFooter({ text: 'Counts giveaways you host — Resets every Monday at 1:00 AM' })
    .setTimestamp();

  return { embeds: [embed], components: [navRow('giveaways')] };
}

// Handles all three board buttons (staff only).
async function handleStaffBoardButton(interaction) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: 'You do not have permission to use this.', ephemeral: true });
  }
  let board;
  if (interaction.customId === 'staff_lb_schematics') board = buildSchematicBoard();
  else if (interaction.customId === 'staff_lb_giveaways') board = buildGiveawayBoard();
  else board = buildPointsBoard();
  await interaction.update(board);
}

module.exports = { buildPointsBoard, buildSchematicBoard, buildGiveawayBoard, handleStaffBoardButton };
