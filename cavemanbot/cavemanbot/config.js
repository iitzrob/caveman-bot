// Only the token / client id / guild id come from Railway (Variables tab).
// Everything else is set directly below — edit the values in this file.
try {
  require('dotenv').config();
} catch {
  // dotenv not installed - fine on Railway, where variables are injected directly.
}

module.exports = {
  // ---- These three come from Railway's Variables tab ----
  token: process.env.BOT_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,

  // ---- Everything below: edit these values directly ----

  // ---- Welcome message ----
  // Sent as a plain text message (NOT an embed) whenever someone joins.
  // - enabled: set to false to turn this off entirely.
  // - channelId: paste the channel to post welcome messages in.
  // - message: {user} mentions the new member, {guild} is the server name,
  //   {ordinal} is their spot in the member count (e.g. "42nd").
  welcome: {
    enabled: true,
    channelId: '1534029743433715872',
    message: 'Welcome {user} to {guild}. You are the {ordinal} member. We hope you have a great time!',
  },

  // The text shown in the embed when /ticket-panel is run. Edit this
  // directly to change the wording — it's sent exactly as written below.
  // The buttons themselves (labels + emoji) still come from
  // data/ticketCategories.js, this is just the description text above them.
  ticketPanelDescription:
`### <:63756redticket:1549053777854726246> Support

> **Open this if you want help or assistance with anything.**

### <:Scammer:1549428770325405706> Staff Report

> **Open this if a staff / builder did something wrong.**

### <:Spawner1:1549428700238315540> Buy/Sell Spawner

> **Open this if you want to buy/sell spawners.**

### <a:3899gift:1537021187450871859> Giveaway Claim

> **Open this to claim a giveaway you won.**

### <:1st246234:1533798054681907291> Giveaway Sponsor

> **Open this if you want to sponsor a giveaway.**`,

  staffRoleId: '1534029589569998888',

  // ---- Vouches ----
  // - channelId: channel where people type "vouch @user" / "scam vouch @user".
  // - scammerRoleId: role given out by /scam-vouch add.
  // - staffVouchChannelId: channel /vouch-send announces confirmed vouches to.
  // - reportCategoryId: category the scam-report ticket gets created under.
  //   Leave '' for no category.
  // - reportPingRoleId: role pinged in the scam-report ticket, on top of
  //   staffRoleId. Leave '' to only ping staffRoleId.
  // - higherUpsRoleId: only members with this role (or staff/Administrator)
  //   can run /scam-vouch. Leave '' to let any staff member use it.
  vouches: {
    channelId: '1534029822509187174',
    scammerRoleId: '1534029592824643734',
    staffVouchChannelId: '1551828897920974909',
    reportCategoryId: '',
    reportPingRoleId: '',
    higherUpsRoleId: '',
  },

  // Role that always keeps SendMessages in a support ticket, even after
  // it's claimed and every other role gets locked out. This role is also
  // granted access to every new ticket when it's created.
  alwaysCanTypeRoleId: '1534029586231332986',

  // Channel where a copy of every ticket's transcript gets posted when it's
  // closed (in addition to DMing it to whoever opened the ticket).
  ticketLogChannelId: '1534030311992721478',

  // Per-ticket-type settings. Keys must match the `id` values in
  // data/ticketCategories.js. Each one can go to its own category channel
  // and ping any number of roles. Leave pingRoleIds as [] to only ping
  // staffRoleId.
  ticketCategories: {
    support: {
      categoryId: '1534029665382170814',
      pingRoleIds: ['1534029589569998888', '1534029586231332986'],
    },
    staff_report: {
      categoryId: '1534029678682181703',
      pingRoleIds: ['1534029589569998888', '1534029586231332986'],
    },
    buy_sell_spawner: {
      categoryId: '1534029675804889108',
      pingRoleIds: ['1534029589569998888', '1534029586231332986'],
    },
    giveaway_claim: {
      categoryId: '1534029669140271275',
      pingRoleIds: ['1534029589569998888', '1534029586231332986'],
    },
    giveaway_sponsor: {
      categoryId: '1534029672407367690',
      pingRoleIds: ['1534029589569998888', '1534029586231332986'],
    },

    // ---- Services panel (/service-panel) ----
    // Keys match the `id` values in data/serviceCategories.js.
    // - emoji: shown on the button AND next to the name in the panel embed.
    //   Normal emojis always show; custom server emojis only show in the
    //   embed text if the bot is in the server that owns them.
    // - categoryId: paste the Discord category for each service here. While
    //   it's '' the ticket channels are created with no category.
    // - pingRoleIds: every service ticket pings all of these roles.
    build: {
      emoji: '🏗️',
      categoryId: '1534029693697921225',
      pingRoleIds: [
        '1534057976208560228',
        '1534029545957625978',
        '1534029542707171418',
        '1534484843101032538',
        '1534029586231332986',
      ],
    },
    dig: {
      emoji: '⛏️',
      categoryId: '1534029697099370597',
      pingRoleIds: [
        '1534057976208560228',
        '1534029545957625978',
        '1534029542707171418',
        '1534484843101032538',
        '1534029586231332986',
      ],
    },
    mapart: {
      emoji: '🗺️',
      categoryId: '1534029700601610401',
      pingRoleIds: [
        '1534057976208560228',
        '1534029545957625978',
        '1534029542707171418',
        '1534484843101032538',
        '1534029586231332986',
      ],
    },
    regears: {
      emoji: '🛡️',
      categoryId: '1534029704275955713',
      pingRoleIds: [
        '1534057976208560228',
        '1534029545957625978',
        '1534029542707171418',
        '1534484843101032538',
        '1534029586231332986',
      ],
    },
  },

  // Title of the embed posted by /service-panel.
  servicePanelTitle: "Donut District's DonutSMP Services",

  // Per-application-type settings. Keys must match the keys in
  // data/applicationQuestions.js (staff_helper, builder, partner_manager).
  // - reviewChannelId: an EXISTING channel (NOT a category) where finished
  //   applications get posted with Accept/Decline buttons. Make this
  //   staff-only — applicants never see it, they answer questions over DM
  //   with the bot instead.
  // - pingRoleId: role pinged in reviewChannelId when a submission lands,
  //   and also the role pinged in the ticket created by the "Open a Ticket"
  //   button on an application
  // - acceptedRoleId: role given to the applicant when Accepted (leave '' to skip)
  // - ticketCategoryId: category the "Open a Ticket" button creates its
  //   channel under (staff can open this from the application review message
  //   to pull the applicant into a channel before deciding)
  applicationCategories: {
    staff_helper: {
      reviewChannelId: '1534029928683798640',
      pingRoleId: '1534029586231332986',
      acceptedRoleId: '1535942602258522132',
      ticketCategoryId: '1534867123266912299',
    },
    builder: {
      reviewChannelId: '1534029932563529828',
      pingRoleId: '1534029586231332986',
      acceptedRoleId: '1535942667375087639',
      ticketCategoryId: '1534917203768643775',
    },
    partner_manager: {
      reviewChannelId: '1551789080050671748',
      pingRoleId: '1534029586231332986',
      acceptedRoleId: '1534499230406938684',
      ticketCategoryId: '1551789632956665957',
    },
  },

  // ---- Levels ----
  // - channelId: where "<user> has reached level N" messages get posted.
  // - maxLevel: XP stops at this level (no more level-up messages after it).
  // - xpMin / xpMax: XP given per message (random in this range), at most
  //   once every cooldownSeconds per person. Tuned so level 10 takes about
  //   6.2 hours of chatting non-stop (one qualifying message every
  //   cooldownSeconds) — 10-18 XP per message (avg 14) with a 60 second
  //   cooldown. Real progress will be slower since nobody chats
  //   nonstop; treat this as the fastest-possible pace, not the typical one.
  //   (Arcane's own defaults are 15-40 XP with a 60 second cooldown, which
  //   reaches level 10 in about 3.2 hours nonstop.)
  // - xpChannelIds: leave [] so messages in every channel count, or list
  //   channel ids to ONLY count messages in those channels.
  // Chatting inside ticket channels never earns XP.
  levels: {
    channelId: '1534029753948831776',
    maxLevel: 500,
    xpMin: 10,
    xpMax: 18,
    cooldownSeconds: 60,
    xpChannelIds: [],

    // Role rewards: paste the role ID for each level (leave '' to skip a
    // level). On a level-up the member gets the highest reward role they've
    // reached. The bot needs the Manage Roles permission, and its own role
    // must sit ABOVE these roles in Server Settings > Roles.
    roleRewards: {
      3: '1534061530713292892',
      6: '1534061673525280918',
      9: '1534061765082742875',
      12: '1534061849832718397',
      15: '1534061982926241793',
      18: '1534062082050363472',
      21: '1534062335738511463',
      24: '1534064671462654052',
      27: '1534064768472715316',
      30: '1534064837988978829',  
    },
    // false = keep only the highest reward role (lower ones get removed).
    // true = keep every reward role they've earned.
    stackRoleRewards: false,
  },

  // ---- Sticky roles ----
  // When someone leaves and rejoins, the bot gives back the roles they had.
  // - enabled: set to false to turn this off.
  // - ignoreRoleIds: roles that should NOT come back (paste role ids, e.g. your
  //   staff roles, if you'd rather hand those out again by hand).
  stickyRoles: {
    enabled: true,
    ignoreRoleIds: [],
  },

  // ---- Payment tracker (/track payment) ----
  // The bot finds out how much money the payer and the receiver have by
  // running the Donut Stats bot's !stats command (https://www.donutstats.net/)
  // and reading its reply. It does that when the payment is started and again
  // every pollSeconds, until the amount has moved or the time runs out.
  //
  // Setup: this bot has to be in the server where the Donut Stats bot is, and
  // needs View Channel, Send Messages and Read Message History in the channel
  // below (plus Manage Messages if you want it to clean up after itself).
  // Use a channel nobody else chats in — the bot posts "!stats <name>" there.
  // Run /track test to check the setup.
  //
  // - statsChannelId: the channel (in the Donut Stats server) where the bot
  //   runs the command. Right-click the channel > Copy Channel ID.
  // - statsBotId: the Donut Stats bot's user id. Optional, but stops the bot
  //   from mistaking some other bot's message for the answer.
  // - statsCommand: what gets typed before the name.
  // - replyTimeoutSeconds: how long to wait for the Donut Stats bot to answer.
  // - deleteMessages: true = the bot deletes its "!stats" message and the
  //   answer afterwards (only works where it has Manage Messages).
  // - moneyRegex: leave '' to auto-detect "Money: ..." in the reply. If
  //   /track test can't read the reply, put your own pattern here as a string.
  //   Group 1 must be the number and group 2 the optional k/m/b suffix.
  // - staffOnly: true = only staff can run /track payment.
  // - pollSeconds: how often balances are re-checked (minimum 20). Each check
  //   is two !stats commands per payment, so keep this reasonable.
  // - maxActive: most payments that can be tracked at the same time.
  // - maxDurationDays: longest "time to pay" someone can set.
  // - requireBoth: true = the payer's money must go DOWN and the receiver's
  //   money must go UP by the amount before it counts as paid (safest — one
  //   side alone can move for other reasons, like /sell or /shop).
  //   false = either side moving by the amount is enough.
  // Trackers only resolve automatically (paid via the balance check, or
  // expired if time runs out) — the only button on one is Cancel.
  payments: {
    statsChannelId: '1551805869862162512',
    statsBotId: '1321520416677695559',
    statsCommand: '!stats',
    replyTimeoutSeconds: 20,
    deleteMessages: true,
    moneyRegex: '',
    staffOnly: true,
    pollSeconds: 30,
    maxActive: 10,
    maxDurationDays: 7,
    requireBoth: true,
  },

  // Timezone for the weekly points reset (Monday 1:00 AM).
  timezone: 'Europe/Berlin',
};
