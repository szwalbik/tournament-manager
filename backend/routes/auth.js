const express = require('express');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const db = require('../db/database');

const router = express.Router();

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_CALLBACK_URL || 'http://localhost:3001/auth/discord/callback',
  scope: ['identify']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const existingUser = await db.get('SELECT * FROM users WHERE id = ?', [profile.id]);
    const countRow = await db.get('SELECT COUNT(*) as count FROM users');
    const isFirstUser = countRow.count === 0;

    if (!existingUser) {
      await db.run(
        'INSERT INTO users (id, username, discriminator, avatar, is_admin) VALUES (?, ?, ?, ?, ?)',
        [profile.id, profile.username, profile.discriminator || '0', profile.avatar, isFirstUser ? 1 : 0]
      );
    } else {
      await db.run(
        'UPDATE users SET username = ?, discriminator = ?, avatar = ? WHERE id = ?',
        [profile.username, profile.discriminator || '0', profile.avatar, profile.id]
      );
    }

    const user = await db.get('SELECT * FROM users WHERE id = ?', [profile.id]);
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    done(null, user || false);
  } catch (err) {
    done(err);
  }
});

router.get('/discord', passport.authenticate('discord'));

router.get('/discord/callback',
  passport.authenticate('discord', { failureRedirect: (process.env.FRONTEND_URL || 'http://localhost:3000') + '/?error=auth' }),
  (req, res) => {
    req.session.user = req.user;
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000');
  }
);

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

router.get('/me', async (req, res) => {
  if (!req.session.user) return res.json({ user: null });
  try {
    const user = await db.get('SELECT id, username, avatar, is_admin, title, accent_color, full_name FROM users WHERE id = ?', [req.session.user.id]);
    res.json({ user: user || null });
  } catch {
    res.json({ user: null });
  }
});

module.exports = router;
