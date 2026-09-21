const { AttachmentBuilder } = require('discord.js');

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Pages backwards through `channel`'s full message history (Discord only
// returns 100 at a time) and returns them oldest-first.
async function fetchAllMessages(channel) {
  const all = [];
  let before;

  for (;;) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (!batch.size) break;
    all.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }

  return all.reverse();
}

// Builds a simple, self-contained HTML transcript of `channel` and returns
// it as a discord.js AttachmentBuilder, ready to send/DM.
async function buildTranscript(channel) {
  const messages = await fetchAllMessages(channel);

  const rows = messages
    .map((m) => {
      const time = new Date(m.createdTimestamp).toLocaleString();
      const author = escapeHtml(m.author?.tag || 'Unknown');
      const content = escapeHtml(m.content || '').replace(/\n/g, '<br>') || '<i>(no text content)</i>';
      const attachments = m.attachments.size
        ? '<br>' +
          [...m.attachments.values()]
            .map((a) => `📎 <a href="${a.url}">${escapeHtml(a.name)}</a>`)
            .join('<br>')
        : '';
      const embedNote = m.embeds.length ? '<br><i>[embed content omitted]</i>' : '';

      return `
        <div class="message">
          <div class="meta"><span class="author">${author}</span><span class="time">${time}</span></div>
          <div class="content">${content}${attachments}${embedNote}</div>
        </div>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Transcript — #${escapeHtml(channel.name)}</title>
<style>
  body { background:#313338; color:#dbdee1; font-family: Arial, sans-serif; padding: 20px; }
  h1 { color: #fff; font-size: 1.3em; }
  .message { border-bottom: 1px solid #3f4147; padding: 8px 0; }
  .author { font-weight: bold; color: #fff; }
  .time { font-size: 0.75em; color: #949ba4; margin-left: 8px; }
  .content { margin-top: 2px; white-space: pre-wrap; word-wrap: break-word; }
  a { color: #00a8fc; }
</style>
</head>
<body>
<h1>Transcript — #${escapeHtml(channel.name)}</h1>
<p>${messages.length} message(s)</p>
${rows}
</body>
</html>`;

  return new AttachmentBuilder(Buffer.from(html, 'utf8'), {
    name: `transcript-${channel.name}.html`,
  });
}

module.exports = { buildTranscript };
