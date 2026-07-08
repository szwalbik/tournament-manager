const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

let discordClient = null;
let channelId = null;

function setDiscordClient(client) {
  discordClient = client;
}

function setChannelId(id) {
  channelId = id;
}

// Udostępnia surowego klienta Discord (np. modułowi backupu, żeby mógł
// pobrać dowolny kanał, niekoniecznie ten od powiadomień).
function getClient() {
  return discordClient;
}

function isBotReady() {
  return !!(discordClient && discordClient.isReady && discordClient.isReady());
}

// 📎 Wysyła dowolny plik (Buffer) jako załącznik na wskazany kanał.
// Używane przez system automatycznych kopii zapasowych.
async function sendFileToChannel(targetChannelId, buffer, filename, content) {
  if (!discordClient || !targetChannelId) return { ok: false, error: 'Bot lub kanał nieskonfigurowany' };
  try {
    const channel = await discordClient.channels.fetch(targetChannelId);
    if (!channel) return { ok: false, error: 'Nie znaleziono kanału' };
    const attachment = new AttachmentBuilder(buffer, { name: filename });
    const message = await channel.send({ content, files: [attachment] });
    return { ok: true, messageId: message.id };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// 📥 Pobiera najnowszy plik kopii zapasowej z kanału (wysłany przez bota tej appki).
async function fetchLatestBackupFile(targetChannelId, filePrefix) {
  if (!discordClient || !targetChannelId) return { ok: false, error: 'Bot lub kanał nieskonfigurowany' };
  try {
    const channel = await discordClient.channels.fetch(targetChannelId);
    if (!channel) return { ok: false, error: 'Nie znaleziono kanału' };
    const messages = await channel.messages.fetch({ limit: 50 });
    const withBackup = [...messages.values()]
      .filter(m => m.author?.id === discordClient.user?.id)
      .map(m => ({ msg: m, attachment: [...m.attachments.values()].find(a => a.name?.startsWith(filePrefix)) }))
      .filter(x => x.attachment)
      .sort((a, b) => b.msg.createdTimestamp - a.msg.createdTimestamp);

    if (withBackup.length === 0) return { ok: false, error: 'Brak plików kopii zapasowej na tym kanale' };

    const latest = withBackup[0];
    const res = await fetch(latest.attachment.url);
    if (!res.ok) return { ok: false, error: `Nie udało się pobrać pliku (${res.status})` };
    const text = await res.text();
    return { ok: true, text, createdAt: latest.msg.createdAt };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Kolory embedów
const COLORS = {
  blue:   0x5865F2,
  green:  0x3ECF8E,
  gold:   0xF0B429,
  red:    0xF87171,
  purple: 0x9B59B6,
  orange: 0xE67E22,
};

async function sendEmbed(embed) {
  if (!discordClient || !channelId) return;
  try {
    const channel = await discordClient.channels.fetch(channelId);
    if (channel) await channel.send({ embeds: [embed] });
  } catch (err) {
    console.warn('Discord notification failed:', err.message);
  }
}

// 🆕 Nowa drużyna
async function notifyTeamRegistered(teamName, repUsername) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.blue)
    .setTitle('🆕 Nowa drużyna zarejestrowana')
    .addFields(
      { name: 'Drużyna', value: `**${teamName}**`, inline: true },
      { name: 'Kapitan', value: repUsername, inline: true }
    )
    .setTimestamp();
  await sendEmbed(embed);
}

// 📩 Prośba o dołączenie
async function notifyJoinRequest(username, teamName) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.purple)
    .setTitle('📩 Prośba o dołączenie do drużyny')
    .setDescription(`**${username}** chce dołączyć do drużyny **${teamName}**`)
    .setFooter({ text: 'Kapitan może zaakceptować lub odrzucić na stronie' })
    .setTimestamp();
  await sendEmbed(embed);
}

// ✅ Gracz dołączył
async function notifyMemberJoined(username, teamName) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.green)
    .setTitle('✅ Gracz dołączył do drużyny')
    .addFields(
      { name: 'Gracz', value: username, inline: true },
      { name: 'Drużyna', value: `**${teamName}**`, inline: true }
    )
    .setTimestamp();
  await sendEmbed(embed);
}

// 🚪 Gracz opuścił
async function notifyMemberLeft(username, teamName) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.orange)
    .setTitle('🚪 Gracz opuścił drużynę')
    .addFields(
      { name: 'Gracz', value: username, inline: true },
      { name: 'Drużyna', value: teamName, inline: true }
    )
    .setTimestamp();
  await sendEmbed(embed);
}

// 👢 Gracz wyrzucony
async function notifyMemberKicked(username, teamName) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.red)
    .setTitle('👢 Gracz wyrzucony z drużyny')
    .addFields(
      { name: 'Gracz', value: username, inline: true },
      { name: 'Drużyna', value: teamName, inline: true }
    )
    .setTimestamp();
  await sendEmbed(embed);
}

// 🏆 Turniej rozpoczęty + losowanie
async function notifyTournamentStart(tournamentName, matchPairs) {
  const pairLines = matchPairs.map((p, i) =>
    p.bye
      ? `\`${i + 1}.\` **${p.team1}** — *bye (automatyczny awans)*`
      : `\`${i + 1}.\` **${p.team1}** ⚔️ **${p.team2}**`
  ).join('\n');

  const embed = new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle(`🏆 ${tournamentName} — Turniej Rozpoczęty!`)
    .setDescription('Losowanie par zostało przeprowadzone. Niech najlepsi wygrają!')
    .addFields({ name: '⚔️ Pary I Rundy', value: pairLines || 'Brak par' })
    .setFooter({ text: 'Zgłaszaj wyniki na stronie turnieju' })
    .setTimestamp();
  await sendEmbed(embed);
}

// 📋 Wynik zgłoszony (oczekuje potwierdzenia)
async function notifyResultSubmitted(team1, team2, score1, score2, submittingTeam) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.purple)
    .setTitle('📋 Wynik zgłoszony — oczekuje potwierdzenia')
    .addFields(
      { name: 'Mecz', value: `**${team1}** vs **${team2}**`, inline: false },
      { name: 'Zgłoszony wynik', value: `**${score1} : ${score2}**`, inline: true },
      { name: 'Zgłosiła', value: submittingTeam, inline: true }
    )
    .setFooter({ text: 'Druga drużyna musi potwierdzić wynik na stronie' })
    .setTimestamp();
  await sendEmbed(embed);
}

// 🏁 Mecz zakończony
async function notifyMatchFinished(team1, team2, score1, score2, winner, round, byAdmin) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.green)
    .setTitle(`🏁 Mecz zakończony${byAdmin ? ' (Admin)' : ''}`)
    .addFields(
      { name: '⚔️ Mecz', value: `**${team1}** vs **${team2}**`, inline: false },
      { name: '📊 Wynik', value: `**${score1} : ${score2}**`, inline: true },
      { name: '🏆 Zwycięzca', value: `**${winner}**`, inline: true },
      { name: '🔢 Runda', value: `${round}`, inline: true }
    )
    .setTimestamp();
  await sendEmbed(embed);
}

// Legacy fallback (na wszelki wypadek)
async function sendDiscordNotification(message) {
  if (!discordClient || !channelId) return;
  try {
    const channel = await discordClient.channels.fetch(channelId);
    if (channel) await channel.send(message);
  } catch (err) {
    console.warn('Discord notification failed:', err.message);
  }
}

module.exports = {
  setDiscordClient,
  setChannelId,
  getClient,
  isBotReady,
  sendFileToChannel,
  fetchLatestBackupFile,
  sendDiscordNotification,
  notifyTeamRegistered,
  notifyJoinRequest,
  notifyMemberJoined,
  notifyMemberLeft,
  notifyMemberKicked,
  notifyTournamentStart,
  notifyResultSubmitted,
  notifyMatchFinished,
};
