// =====================================================================
// SCHEMATIC AUTO-POST SETTINGS
// People forward (or post) a message with a schematic file in one of the
// "source" channels below. The bot copies the files and images out of it
// and re-posts them in the matching "destination" channel.
// Everything you might want to edit is in this file.
// =====================================================================
module.exports = {
  enabled: true,

  // source channel (where people forward) -> destination channel (where the bot posts)
  channels: {
    '1555536993394360411': '1534029833489612850',
    '1555537076076806255': '1534029837184925699',
    '1555537137451933797': '1534029841723162695',
    '1555537181362225152': '1534029845430931587',
    '1555537221644320868': '1534029848920457216',
    '1555537272479424563': '1534029852372631562',
    '1555537316229943336': '1534029860022911149',
  },

  // The "Original Creator" line is only added when a file name contains one
  // of these names. Left side = the name to look for in the file name (not
  // case sensitive), right side = that creator's Discord user id.
  // Example: a file called "voidview_christmas_tree.litematic" or
  // "Christmas Tree Gamble - voidview.litematic" credits that user.
  // The right side can be a Discord user id (the bot mentions them) OR plain
  // text (the bot just writes that name). To ping Zyrin, replace 'Zyrin'
  // with his Discord user id in quotes.
  creators: {
    voidview: '764663858815565865',
    zyrin: 'Zyrin',
    kyle: 'Kyle',
  },

  // Creators whose name should STAY in the title. Normally the creator's
  // name is cut out of the title ("voidview_christmas_tree" -> "Christmas
  // Tree"). For the names below it is kept, so "kyles regear" stays
  // "Kyles Regear" and still credits Kyle. Use the left-side name from
  // `creators` above.
  keepNameInTitle: ['kyle'],

  // Leaderboard: points each schematic post is worth for the person who
  // forwarded it. Set alsoAddToStaffPoints to true to ALSO add them to the
  // normal staff points (ticket points) board.
  pointsPerPost: 2,
  alsoAddToStaffPoints: false,

  // Every `adEvery` posts in a destination channel the bot sends the build
  // request message there. Every `pingEvery` posts it also pings pingId
  // (a role or a user - the bot works out which).
  adEvery: 10,
  ticketChannelId: '1534029797389504572',
  pingEvery: 30,
  pingId: '1534129618473193613',

  // Emojis used in the post.
  emojiNo: '<a:nooo:1555535760831283220>',
  emojiBlocks: '<:BlocksPlaced52234234:1533798033320575158>',

  // File types that count as images (everything else counts as "the file").
  imageExtensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'],
};
