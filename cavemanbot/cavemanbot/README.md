# CavemanBot

A Discord bot with:
- A 5-button ticket panel (Support, Staff Report, Buy/Sell Spawner, Giveaway Claim, Giveaway Sponsor)
- A dropdown-based application system (Staff/Helper + Builder), asking each question one at a time with a Cancel button
- A points system: **+2** for closing a ticket, **+3** for renaming one
- `/point-leaderboard`, which asks which role to track, then posts one embed with everyone's points
- Points auto-reset every **Monday at 1:00 AM** (EU time by default)
- A plain-text welcome message posted to a channel of your choice whenever someone joins (see `welcome` in `config.js`)

> **Note:** every role ID and channel ID in `config.js` has been cleared out on
> purpose (copied from another bot's setup) — go through `config.js` and paste
> in your own server's role/category/channel IDs before running this.

## 1. Install

```bash
npm install
```

## 2. Create the bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. **Bot** tab → Reset Token, copy it → this is your `BOT_TOKEN`.
3. On the same **Bot** tab, turn ON:
   - **Server Members Intent** (needed for the leaderboard)
   - **Message Content Intent** (needed to read applicants' typed answers)
4. **OAuth2 → URL Generator**: check `bot` and `applications.commands`, and under Bot Permissions check at least:
   `Manage Channels`, `View Channels`, `Send Messages`, `Embed Links`, `Read Message History`.
   Use the generated URL to invite the bot to your server.

## 3. Configure

```bash
cp .env.example .env
```

Fill in:
- `BOT_TOKEN` — from step 2
- `CLIENT_ID` — Developer Portal → General Information → Application ID
- `GUILD_ID` — your server ID (enable Developer Mode in Discord → right-click your server icon → Copy Server ID)
- `STAFF_ROLE_ID` — the role allowed to close/rename tickets and view the leaderboard (right-click the role → Copy Role ID)
- `TICKET_CATEGORY_ID` / `APPLICATION_CATEGORY_ID` — the category channels new ticket/application channels should be created under (right-click a category → Copy Channel ID). Optional — leave blank to create them at the top level.
- `TIMEZONE` — defaults to `Europe/Berlin`. Change if your "EU time" means a different zone (e.g. `Europe/London`).

## 4. Deploy slash commands & run

```bash
npm run deploy   # registers the slash commands to your server
npm start        # logs the bot in
```

## 5. Post the panels

In whichever channels you want, run:
- `/ticket-panel` — posts the 5-button ticket panel
- `/application-panel` — posts the rules + Staff/Helper vs Builder dropdown

Both commands require **Manage Server** permission to run.

## How it works

- **Tickets**: clicking a button creates a private channel (visible to the opener + staff role), with a "Close Ticket" button inside.
- **Applications**: picking an option from the dropdown creates a private channel and the bot asks each question one at a time. The applicant just types their answer to move on, or presses **Cancel** to stop (channel is deleted). Two of the staff questions (2FA / microphone) show Yes/No buttons instead of asking for typed text, matching the original form.
- **Closing / renaming**: staff use the **Close Ticket** button or `/ticket-close` (+2 points to whoever closes it), and `/ticket-rename <name>` (+3 points to whoever renames it). Both only work inside a bot-created ticket/application channel, and only for members with the staff role (or Administrator).
- **Leaderboard**: `/point-leaderboard` asks you to pick a role, then posts one embed listing every member with that role and their current points, sorted highest to lowest.
- **Weekly reset**: a scheduled job wipes all points back to 0 every Monday at 1:00 AM in the configured timezone.

## Data storage

Points and open-ticket tracking are stored in plain JSON files under `data/` (`points.json`, `tickets.json`) — no database setup needed. If you deploy to a host with an ephemeral filesystem (e.g. some free-tier platforms), make sure `data/` is on a persistent volume, or points will reset on every restart/redeploy.

## Customizing

- Ticket categories: `data/ticketCategories.js`
- Application questions: `data/applicationQuestions.js`
- Points values: `CLOSE_POINTS` / `RENAME_POINTS` in `utils/ticketActions.js`
- Reset schedule: the cron expression `'0 1 * * 1'` in `index.js` (currently Monday 1:00 AM)
