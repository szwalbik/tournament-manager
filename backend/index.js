require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const { Client, GatewayIntentBits } = require('discord.js');
const { setDiscordClient, setChannelId } = require('./discord-client');
const db = require('./db/database');

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
});

if (process.env.DISCORD_BOT_TOKEN) {
  discordBot.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
    console.warn('Discord bot login failed:', err.message);
  });
} else {
  console.warn('⚠️  DISCORD_BOT_TOKEN nie ustawiony — powiadomienia Discord wyłączone');
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend działa na http://localhost:${PORT}`);
});
