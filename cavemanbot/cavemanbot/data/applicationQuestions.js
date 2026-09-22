// Question text has no emojis by design, per spec ("make it send no emojis
// tho to make it look clean"). `type: 'yesno'` questions get Yes/No buttons
// instead of a text prompt; everything else waits for a typed reply.

const staffQuestions = [
  { text: "What's your IGN" },
  { text: 'Do you have 2FA enabled on your Discord account?', type: 'yesno' },
  { text: 'Do you have access to a microphone?', type: 'yesno' },
  { text: "What's your balance in DonutSMP" },
  { text: 'Why would you like to become a staff member?' },
  { text: 'Why do you think your application is better than others?' },
  { text: 'Do you have experience with being a staff member? If yes, explain where and what was ur rank (send server link)' },
  { text: 'What qualities do you think a staff member should have?' },
  { text: 'How often are you able to be active in this discord server?' },
];

const builderQuestions = [
  { text: 'What is your IGN' },
  { text: 'What is your balance on DonutSMP?' },
  { text: 'Do you have any prior experience in building? (any other servers) (send link)' },
  { text: 'How many vouches do you have and where are they?' },
  { text: 'How often are you able to build for people?' },
  { text: 'Do you understand that if you scam someone you will be demoted and get blacklisted forever on 50+ servers?' },
];

const partnerManagerQuestions = [
  { text: 'What servers are you PM (Partner Manager) in?' },
  { text: 'Do you know how to do waves?', type: 'yesno' },
  { text: "What's your IGN?" },
];

module.exports = {
  staff_helper: {
    label: 'Staff/Helper Applications',
    value: 'staff_helper',
    prefix: 'staff-app',
    questions: staffQuestions,
  },
  builder: {
    label: 'Builder Applications',
    value: 'builder',
    prefix: 'builder-app',
    questions: builderQuestions,
  },
  partner_manager: {
    label: 'Partner Manager Applications',
    value: 'partner_manager',
    prefix: 'partner-manager-app',
    questions: partnerManagerQuestions,
  },
};
