const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isBypassRole } = require('../utils/permissions');

// /helper guide — posts the Helper Guide / Training as plain text (no embed).
// Restricted to config.alwaysCanTypeRoleId (see utils/permissions.js#isBypassRole)
// or anyone with Administrator.
const HELPER_GUIDE = `# 🛡️ Helper Guide / Training

> **All staff roles except Builders must follow these requirements!**

### 🎫 Staff Duties

* Be **active daily** and manage tickets.
* Respond to tickets and help members with their issues.
* Use Tickety commands such as \`/ticket rename\` and \`/ticket close\`.
* Host **3–4 giveaways per week**, with a minimum of **5M** using \`/gcreate\`.

### 📊 Staff Points

* 📝 \`/ticket rename\` = **+3 points**
* 🔒 \`/ticket close\` = **+2 points**
* ⭐ You **must earn at least 25 points every week**.
* 🔄 Points **reset every Monday**.
* 💬 Use \`/vouch\` for staff vouches.
* 🏆 Use \`/staffvouch leaderboard\` to check your position.

### ⚠️ Activity & Promotions

Not being active, helping members, managing tickets, or hosting giveaways may result in a **strike followed by a demotion**.

Promotions are decided by the **Owner/Managers** based on your activity, effort, consistency, and contribution to the server.

> ❤️ Keep working hard and stay active—your effort is noticed!`;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('helper')
    .setDescription('Helper commands')
    .addSubcommand((sub) =>
      sub.setName('guide').setDescription('Post the Helper Guide / Training')
    )
    .setDMPermission(false),

  async execute(interaction) {
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isAdmin && !isBypassRole(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this.', ephemeral: true });
    }

    return interaction.reply({
      content: HELPER_GUIDE,
      allowedMentions: { parse: [] },
    });
  },
};
