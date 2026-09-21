// The 5 ticket categories shown as grey buttons on the ticket panel.
// `questions` (optional) are asked in a Discord form (modal) as soon as
// someone presses the button — answers get baked into the ticket's embed.
// `notes` (optional) is just an FYI line shown in the ticket, not a question.
module.exports = [
  {
    id: 'support',
    emoji: '<:63756redticket:1549053777854726246>',
    label: 'Support',
    description: 'Open this if you want help or assistance with anything.',
    questions: ['What do you need help with?', "What's your IGN?"],
  },
  {
    id: 'staff_report',
    emoji: '<:Scammer:1549428770325405706>',
    label: 'Staff Report',
    description: 'Open this if a staff / builder did something wrong.',
    questions: [
      'Are you reporting a staff or a member?',
      'What did they do?',
      'Do you have any proof?',
    ],
  },
  {
    id: 'buy_sell_spawner',
    emoji: '<:Spawner1:1549428700238315540>',
    label: 'Buy/Sell Spawner',
    description: 'Open this if you want to buy/sell spawners.',
    notes: 'Only buy/sell with users who have spawner perms.',
    questions: [
      'How many spawners are you buying/selling?',
      'Only buy/sell spawners with users who have spawner perms!',
    ],
  },
  {
    id: 'giveaway_claim',
    emoji: '<a:3899gift:1537021187450871859>',
    label: 'Giveaway Claim',
    description: 'Open this to claim a giveaway you won.',
    questions: ['How much have you won?', 'Who hosted the giveaway?'],
  },
  {
    id: 'giveaway_sponsor',
    emoji: '<:1st246234:1533798054681907291>',
    label: 'Giveaway Sponsor',
    description: 'Open this if you want to sponsor a giveaway.',
    questions: ['How much do you want to sponsor?', "What's your IGN?"],
  },
];
