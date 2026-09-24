const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isBypassRole } = require('../utils/permissions');

// /builder guide — posts the Builder Guide / Training as plain text (no embed).
// Restricted to config.alwaysCanTypeRoleId (see utils/permissions.js#isBypassRole)
// or anyone with Administrator.
const BUILDER_GUIDE = `# 🧱 Builder Guide / Training

> **These rules apply to all Builders!**

### 💰 Payments

* Before starting **ANY build**, the customer must pay ***Exhale*** first.
* Builders **MUST use \`/track payment\`** for every build.
* If \`/track payment\` is not used, **you will NOT get paid**.
* **20% will be taken from all builds.**
* Payment is given **after the build is completed and the home is deleted.**

### 🛠️ Build Rules

* Builders may take a maximum of **2 builds at a time**.
* Taking more than 2 builds = **Immediate demotion**.
* The **first Builder to respond in a build ticket gets priority**.
* Fighting over builds = **Strike**.
* Builders should **ONLY respond to build tickets**.
* Always communicate with customers **professionally and respectfully**.

### 📋 Builder Commands

* 💳 \`/track payment\` — **MUST be used before starting every build.**
* ✅ \`/build finish\` — Use when the build is completed.
* 🏆 \`/build leaderboard\` — Check how many builds you have completed.
* ⭐ \`/vouch\` — Use when someone wants to vouch for you.

### ⏰ Deadlines

* All builds must be completed within **4 days**, unless an exception is approved.
* Failure to complete a build within 4 days may result in a **customer refund and immediate demotion**.

### 📈 Promotions

To get promoted, **stay active, complete builds, communicate professionally, and don't slack.**

> ❓ If you have any questions, contact Management.`;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('builder')
    .setDescription('Builder commands')
    .addSubcommand((sub) =>
      sub.setName('guide').setDescription('Post the Builder Guide / Training')
    )
    .setDMPermission(false),

  async execute(interaction) {
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isAdmin && !isBypassRole(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to use this.', ephemeral: true });
    }

    return interaction.reply({
      content: BUILDER_GUIDE,
      allowedMentions: { parse: [] },
    });
  },
};
