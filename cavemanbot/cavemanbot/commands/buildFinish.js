const { SlashCommandBuilder } = require('discord.js');
const { requestBuildFinish } = require('../utils/buildFinishActions');

// /build-finish — staff-only, and only usable inside a ticket channel. Posts
// an Agree/Disagree prompt for the ticket opener to confirm the build is
// actually done; see utils/buildFinishActions.js for the cooldown, admin
// bypass, and confirmation logic.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('build-finish')
    .setDescription('Ask the ticket opener to confirm you finished their build'),

  async execute(interaction) {
    await requestBuildFinish(interaction);
  },
};
