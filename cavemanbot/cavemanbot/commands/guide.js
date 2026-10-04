const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const createStore = require('../utils/jsonStore');
const config = require('../config');
const { isBypassRole } = require('../utils/permissions');

// /guide config — posts a panel with two buttons (Helper Guide / Builder Guide).
// Each button opens a form where the text of /helper guide or /builder guide
// can be changed. Edited text is saved in data/guides.json; until someone
// edits a guide, the default text below is used.
// (This file also holds the button/form handling, which index.js calls.)

const store = createStore('guides.json', {});
const MAX_LENGTH = 2000; // Discord's limit for a normal message
const LABELS = { helper: 'Helper Guide', builder: 'Builder Guide' };

const DEFAULTS = {
  helper: `# 🛡️ Helper Guide / Training

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

> ❤️ Keep working hard and stay active—your effort is noticed!`,
  builder: `# 🧱 Builder Guide / Training

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

> ❓ If you have any questions, contact Management.`,
};

function isGuideType(type) {
  return type === 'helper' || type === 'builder';
}

function getGuide(type) {
  const saved = store.get(type);
  return typeof saved === 'string' && saved.trim() ? saved : DEFAULTS[type];
}

// Who can open /guide config and edit the guides: Administrators, the
// bypass role (config.alwaysCanTypeRoleId) and the application role
// (the pingRoleId of any entry in config.applicationCategories).
function canEditGuides(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (isBypassRole(member)) return true;
  return Object.values(config.applicationCategories || {}).some(
    (c) => c && c.pingRoleId && member.roles.cache.has(c.pingRoleId)
  );
}

const NO_PERMISSION = { content: 'You do not have permission to use this.', ephemeral: true };

// Button on the panel -> opens a form with the current text filled in.
async function handleGuideEditButton(interaction) {
  const type = interaction.customId.split(':')[1];
  if (!isGuideType(type)) return;
  if (!canEditGuides(interaction.member)) return interaction.reply(NO_PERMISSION);

  const input = new TextInputBuilder()
    .setCustomId('guide_text')
    .setLabel(`${LABELS[type]} text`)
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(1)
    .setMaxLength(MAX_LENGTH)
    .setRequired(true)
    .setValue(getGuide(type).slice(0, MAX_LENGTH));

  const modal = new ModalBuilder()
    .setCustomId(`guide_modal:${type}`)
    .setTitle(`Edit ${LABELS[type]}`)
    .addComponents(new ActionRowBuilder().addComponents(input));

  return interaction.showModal(modal);
}

// The form was submitted -> save the new text.
async function handleGuideModalSubmit(interaction) {
  const type = interaction.customId.split(':')[1];
  if (!isGuideType(type)) return;
  if (!canEditGuides(interaction.member)) return interaction.reply(NO_PERMISSION);

  const text = interaction.fields.getTextInputValue('guide_text').trim();
  if (!text) {
    return interaction.reply({ content: 'The guide cannot be empty.', ephemeral: true });
  }

  store.set(type, text);
  return interaction.reply({
    content: `${LABELS[type]} updated. It will show up next time someone runs /${type} guide.`,
    ephemeral: true,
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guide')
    .setDescription('Guide settings')
    .addSubcommand((sub) =>
      sub.setName('config').setDescription('Edit the Helper Guide and Builder Guide text')
    )
    .setDMPermission(false),

  async execute(interaction) {
    if (!canEditGuides(interaction.member)) return interaction.reply(NO_PERMISSION);

    const embed = new EmbedBuilder()
      .setTitle('Guide Config')
      .setDescription(
        'Press a button below to change the text of that guide.\n\n' +
          '**Helper Guide** is what `/helper guide` posts.\n' +
          '**Builder Guide** is what `/builder guide` posts.'
      )
      .setColor(0x2b2d31);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('guide_edit:helper').setLabel('Helper Guide').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('guide_edit:builder').setLabel('Builder Guide').setStyle(ButtonStyle.Primary)
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  },

  // used by helper.js / builder.js / index.js
  getGuide,
  handleGuideEditButton,
  handleGuideModalSubmit,
};
