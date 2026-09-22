const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
} = require('discord.js');
const ticketStore = require('./ticketStore');
const { buildDecisionRow } = require('./applicationDecision');

const QUESTION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes per question

function cancelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('application_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
  );
}

function yesNoSelectRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('application_yesno_select')
      .setPlaceholder('Select an answer')
      .addOptions(
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no' },
        { label: 'Cancel', value: 'cancel' }
      )
  );
}

function questionEmbed(question, index, total) {
  return new EmbedBuilder()
    .setTitle(`Question ${index} of ${total}`)
    .setDescription(question.text)
    .setColor(0x2b2d31);
}

// Asks a single question in `channel` (the applicant's DM channel) and waits
// for `userId` to answer it, either by typing a message or (for yes/no
// questions) picking an option from a dropdown. A Cancel button/option is
// always available.
async function askQuestion(channel, userId, question, index, total) {
  const embed = questionEmbed(question, index, total);

  if (question.type === 'yesno') {
    const qMsg = await channel.send({ embeds: [embed], components: [yesNoSelectRow()] });

    const selectInteraction = await qMsg
      .awaitMessageComponent({
        filter: (i) => i.user.id === userId && i.customId === 'application_yesno_select',
        time: QUESTION_TIMEOUT_MS,
      })
      .catch(() => null);

    if (!selectInteraction) {
      await qMsg.edit({ components: [] }).catch(() => {});
      return { cancelled: true, timedOut: true };
    }

    const choice = selectInteraction.values[0]; // 'yes' | 'no' | 'cancel'
    const label = choice === 'yes' ? 'Yes' : choice === 'no' ? 'No' : 'Cancel';

    // Swap the embed's description to show what they picked, and drop the
    // dropdown now that it's been answered.
    const answeredEmbed = EmbedBuilder.from(embed).setDescription(
      `${question.text}\n\n**Selected:** ${label}`
    );
    await selectInteraction.update({ embeds: [answeredEmbed], components: [] }).catch(() => {});

    if (choice === 'cancel') return { cancelled: true };
    return { answer: label };
  }

  const qMsg = await channel.send({ embeds: [embed], components: [cancelRow()] });

  const messagePromise = channel
    .awaitMessages({ filter: (m) => m.author.id === userId, max: 1, time: QUESTION_TIMEOUT_MS })
    .then((collected) => ({ type: 'message', collected }));

  const cancelPromise = qMsg
    .awaitMessageComponent({
      filter: (i) => i.user.id === userId && i.customId === 'application_cancel',
      time: QUESTION_TIMEOUT_MS,
    })
    .then((i) => ({ type: 'cancel', i }))
    .catch(() => ({ type: 'timeout' }));

  const result = await Promise.race([messagePromise, cancelPromise]);
  await qMsg.edit({ components: [] }).catch(() => {});

  if (result.type === 'cancel') {
    await result.i.deferUpdate().catch(() => {});
    return { cancelled: true };
  }

  if (result.type === 'timeout') return { cancelled: true, timedOut: true };

  const msg = result.collected.first();
  if (!msg) return { cancelled: true, timedOut: true };
  return { answer: msg.content || '*(no text — attachment or empty message)*' };
}

// Builds the "Submission Stats" field shown under the answers on the review
// embed: who submitted it, how long it took them, how long they've been in
// the guild, and when it landed. `startedAt` is the timestamp (ms) from when
// the applicant picked this application type in the panel — set in
// handlers/applicationHandlers.js when the appId is first created.
//
// Only the labels (UserId, Username, etc.) are wrapped in markdown bold —
// the values are left as plain ASCII since they contain a mention, a raw ID,
// and Discord timestamp tags, all of which need literal characters to render.
async function buildSubmissionStatsField(reviewChannel, user, startedAt) {
  const durationSec = Math.max(0, Math.round((Date.now() - startedAt) / 1000));

  let member = null;
  try {
    member = await reviewChannel.guild.members.fetch(user.id);
  } catch {
    // Applicant left the guild, or a fetch hiccup — just omit "Joined guild".
  }

  const lines = [
    `**UserId:** ${user.id}`,
    `**Username:** ${user.username}`,
    `**User:** ${user}`,
    `**Duration:** ${durationSec}s`,
  ];

  if (member?.joinedTimestamp) {
    lines.push(`**Joined guild:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`);
  }

  lines.push(`**Submitted:** <t:${Math.floor(Date.now() / 1000)}:R>`);

  return { name: 'Submission Stats', value: lines.join('\n') };
}

// Walks the user through every question in `appConfig.questions` over DM,
// then posts a summary embed with the Accept/Deny/Open-Ticket buttons into
// `reviewChannel` (an existing staff-only channel) for staff to act on.
//
// `opts`:
//   - reviewChannel: the guild channel to post the finished submission to
//   - pingRoleId: role to ping in reviewChannel when a submission lands (optional)
//   - appId: unique id for this application, used to tie the buttons back to
//            the right applicant since many submissions can share the same
//            reviewChannel
async function runApplicationFlow(dmChannel, user, appConfig, opts) {
  const { reviewChannel, pingRoleId, appId } = opts;
  const answers = [];
  const total = appConfig.questions.length;

  const meta = ticketStore.get(appId) || {};
  const startedAt = meta.openedAt || Date.now();

  for (let i = 0; i < total; i++) {
    const question = appConfig.questions[i];
    const result = await askQuestion(dmChannel, user.id, question, i + 1, total);

    if (result.cancelled) {
      await dmChannel.send(
        result.timedOut
          ? 'This application timed out due to inactivity.'
          : 'This application was cancelled.'
      );
      ticketStore.remove(appId);
      return;
    }

    answers.push({ question: question.text, answer: result.answer });
  }

  // Save the answers on the application's meta so the "Open a Ticket" button
  // (handled later, from the review message) can show them in the ticket too.
  ticketStore.update(appId, { answers });

  const statsField = await buildSubmissionStatsField(reviewChannel, user, startedAt);

  // Question text is bot-authored and wrapped in markdown bold; each answer is the
  // applicant's own typed text and is left exactly as they wrote it.
  const embed = new EmbedBuilder()
    .setTitle(`${appConfig.label} — Submission`)
    .setColor(0x2b2d31)
    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
    .setDescription(
      answers.map((a, i) => `**${i + 1}. ${a.question}**\n${a.answer}`).join('\n\n')
    )
    .addFields(statsField)
    .setFooter({ text: `User ID: ${user.id}` })
    .setTimestamp();

  await reviewChannel.send({
    content: pingRoleId ? `<@&${pingRoleId}>` : undefined,
    embeds: [embed],
    components: [buildDecisionRow(appId)],
  });

  await dmChannel.send(
    'Your application has been submitted. Staff will review it and follow up with you here.'
  );
}

module.exports = { runApplicationFlow };
