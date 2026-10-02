const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const points = require('./points');
const schematics = require('./schematics');
const schematicCfg = require('../schematicConfig');

const MEDALS = ['🥇', '🥈', '🥉'];

function rankLines(entries, format) {
  return entries.map((entry, i) => {
    const rank = MEDALS[i] || `**${i + 1}.**`;
    return `${rank} <@${entry.userId}> — ${format(entry)}`;
  });
}

// The normal staff points board (same look as before) plus a button that
// switches the message over to the schematic posts board.
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

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('staff_lb_schematics')
      .setLabel('Schematic Posts')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

// Weekly schematic posts: every post is worth schematicCfg.pointsPerPost.
function buildSchematicBoard() {
  const perPost = schematicCfg.pointsPerPost;
  const list = Object.entries(schematics.getWeekly())
    .map(([userId, posts]) => ({ userId, posts, pts: posts * perPost }))
    .filter((entry) => entry.posts > 0)
    .sort((a, b) => b.posts - a.posts);

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

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('staff_lb_points')
      .setLabel('Staff Points')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = { buildPointsBoard, buildSchematicBoard };
