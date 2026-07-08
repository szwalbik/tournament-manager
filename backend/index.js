require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const { Client, GatewayIntentBits } = require('discord.js');
const { setDiscordClient, setChannelId } = require('./discord-client');
const db = require('./db/database');
const { autoHealOnBoot, startPeriodicBackup, backupToDiscord } = require('./services/backup');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Ufaj reverse proxy hostingu (Render, Railway itd.),
// żeby "secure" cookies działały poprawnie za HTTPS.
if (isProduction) {
  app.set('trust proxy', 1);
}

// W produkcji frontend jest serwowany przez ten sam serwer/domenę,
// więc CORS nie jest już potrzebny do komunikacji front<->back.
// Zostawiamy go na wypadek, gdybyś kiedyś chciał hostować osobno.
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', require('./routes/auth'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/public', require('./routes/public'));
app.use('/api/profile', require('./routes/profile'));

app.get('/health', (req, res) => res.json({ ok: true }));

// --- Serwowanie zbudowanego frontendu (produkcja) ---
// Dzięki temu frontend i backend działają na jednej domenie/porcie,
// więc nie ma problemów z CORS ani z cookies między różnymi domenami.
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

// Wszystkie ścieżki, które nie są /api, /auth ani /health,
// zwracają index.html — dzięki temu działa routing po stronie
// klienta (react-router-dom), np. po odświeżeniu strony na /teams.
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path === '/health') {
    return next();
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// Start Discord bot
const discordBot = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

discordBot.on('clientReady', async () => {
  console.log(`✅ Discord bot zalogowany jako ${discordBot.user.tag}`);
  setDiscordClient(discordBot);

  // Load channel ID from DB
  try {
    const setting = await db.get("SELECT value FROM tournament_settings WHERE key = 'discord_channel_id'");
    if (setting?.value) {
      setChannelId(setting.value);
      console.log(`📢 Kanał powiadomień: ${setting.value}`);
    }
  } catch (err) {
    console.warn('Nie udało się załadować channel ID:', err.message);
  }

  // 💾 Jeśli baza jest pusta (świeży/wyzerowany dysk po restarcie hostingu),
  // spróbuj automatycznie odtworzyć ostatni stan z kopii na Discordzie.
  await autoHealOnBoot();

  // Okresowy backup "na wszelki wypadek" — nawet jeśli coś przeoczy
  // wywołanie backupu po konkretnej akcji.
  startPeriodicBackup(15);
});

if (process.env.DISCORD_BOT_TOKEN) {
  discordBot.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
    console.warn('Discord bot login failed:', err.message);
  });
} else {
  console.warn('⚠️  DISCORD_BOT_TOKEN nie ustawiony — powiadomienia Discord wyłączone (backup i restore również wymagają bota)');
}

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`🚀 Backend działa na http://localhost:${PORT}`);
});

// 🏓 Self-ping / keep-alive — na darmowych planach (Render itp.) serwis
// usypia po ok. 15 minutach bezczynności. Jeśli ustawiona jest zmienna
// SELF_URL (lub Render automatycznie ustawi RENDER_EXTERNAL_URL), backend
// co kilka minut odpytuje sam siebie o /health, żeby ograniczyć usypianie.
// To NIE gwarantuje 100% dostępności (płatne plany i tak usypiają po czasie
// niezależnie od ruchu), ale realnie zmniejsza częstotliwość restartów —
// a każdy restart to potencjalna utrata danych z dysku efemerycznego.
const selfUrl = process.env.SELF_URL || process.env.RENDER_EXTERNAL_URL;
if (selfUrl) {
  setInterval(() => {
    fetch(`${selfUrl.replace(/\/$/, '')}/health`).catch(() => {});
  }, 4 * 60 * 1000);
  console.log(`🏓 Keep-alive self-ping włączony: ${selfUrl}`);
} else {
  console.log('ℹ️  Keep-alive wyłączony (ustaw SELF_URL, żeby ograniczyć usypianie na darmowym hostingu)');
}

// 🛑 Graceful shutdown — hosting może wysłać SIGTERM przed restartem/redeployem.
// Próbujemy zdążyć z ostatnim backupem, zanim proces faktycznie się zakończy.
let shuttingDown = false;
async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} otrzymany — próbuję wykonać ostatni backup przed zamknięciem...`);
  try {
    const result = await Promise.race([
      backupToDiscord('shutdown'),
      new Promise(resolve => setTimeout(() => resolve({ ok: false, error: 'timeout' }), 8000)),
    ]);
    console.log(result.ok ? '✅ Backup przed zamknięciem wykonany.' : `⚠️  Backup przed zamknięciem nieudany: ${result.error}`);
  } catch (err) {
    console.warn('Błąd backupu przy zamykaniu:', err.message);
  } finally {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000);
  }
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
