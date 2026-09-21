// Converts A-Z, a-z and 0-9 in a string to their Unicode "Mathematical Bold"
// lookalikes (𝐟𝐨𝐧𝐭) — this isn't markdown, it's just different characters,
// so it renders bold in every Discord client/font, including places markdown
// bold doesn't work (button labels, select menu options).
//
// IMPORTANT: only ever call this on plain bot-authored text — never on a
// mention (<@id>), a timestamp tag (<t:...:R>), a channel link (<#id>), or a
// raw ID/number a person might need to copy. Those rely on literal ASCII
// digits to render/parse correctly; swapping them for bold lookalikes would
// break them.
function bold(str) {
  if (!str) return str;
  return str.replace(/[A-Za-z0-9]/g, (ch) => {
    const code = ch.codePointAt(0);
    let base;
    if (ch >= 'A' && ch <= 'Z') base = 0x1d400 - 0x41;
    else if (ch >= 'a' && ch <= 'z') base = 0x1d41a - 0x61;
    else base = 0x1d7ce - 0x30;
    return String.fromCodePoint(code + base);
  });
}

module.exports = { bold };
