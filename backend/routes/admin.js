const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { setChannelId, notifyTournamentStart } = require('../discord-client');

const router = express.Router();

router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await db.all('SELECT * FROM tournament_settings');
    const status = await db.get('SELECT * FROM tournament_status WHERE id = 1');
    const adminUsers = await db.all('SELECT id, username, avatar FROM users WHERE is_admin = 1');
    res.json({ settings, status, adminUsers });
  } catch {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.put('/settings', requireAdmin, async (req, res) => {
  const { max_teams, tournament_name, discord_channel_id, mode } = req.body;
  try {
    const status = await db.get('SELECT phase FROM tournament_status WHERE id = 1');
    if (max_teams) await db.run("UPDATE tournament_settings SET value = ? WHERE key = 'max_teams'", [String(max_teams)]);
    if (tournament_name) await db.run("UPDATE tournament_settings SET value = ? WHERE key = 'tournament_name'", [tournament_name]);
    if (discord_channel_id !== undefined) {
      await db.run("UPDATE tournament_settings SET value = ? WHERE key = 'discord_channel_id'", [discord_channel_id]);
      setChannelId(discord_channel_id);
    }
    if (mode !== undefined) {
      if (!['teams', 'solo'].includes(mode)) return res.status(400).json({ error: 'Nieprawidłowy tryb turnieju' });
      const currentMode = await db.get("SELECT value FROM tournament_settings WHERE key = 'mode'");
      const isActualChange = (currentMode?.value || 'teams') !== mode;
      if (isActualChange && status.phase !== 'registration') {
        return res.status(400).json({ error: 'Tryb turnieju można zmienić tylko przed rozpoczęciem' });
      }
      if (isActualChange) {
        await db.run("UPDATE tournament_settings SET value = ? WHERE key = 'mode'", [mode]);
      }
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.post('/admins', requireAdmin, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Podaj Discord User ID' });
  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'Użytkownik nie istnieje (musi się najpierw zalogować)' });
    await db.run('UPDATE users SET is_admin = 1 WHERE id = ?', [userId]);
    res.json({ success: true, username: user.username });
  } catch {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.delete('/admins/:userId', requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const selfId = req.session.user.id;
  if (userId === selfId) return res.status(400).json({ error: 'Nie możesz usunąć własnych uprawnień' });
  try {
    await db.run('UPDATE users SET is_admin = 0 WHERE id = ?', [userId]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Shared bracket generation logic
async function generateBracket() {
  const teams = await db.all('SELECT * FROM teams');
  if (teams.length < 2) throw new Error('Potrzeba co najmniej 2 drużyn');

  const shuffled = teams.sort(() => Math.random() - 0.5);
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(shuffled.length)));
  const totalRounds = Math.log2(bracketSize);

  await db.run('DELETE FROM matches');

  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    for (let matchNum = 1; matchNum <= matchesInRound; matchNum++) {
      await db.run("INSERT INTO matches (round, match_number, status) VALUES (?, ?, 'scheduled')", [round, matchNum]);
    }
  }

  const firstRoundMatches = await db.all('SELECT * FROM matches WHERE round = 1 ORDER BY match_number');

  for (let i = 0; i < firstRoundMatches.length; i++) {
    const match = firstRoundMatches[i];
    const team1 = shuffled[i * 2] || null;
    const team2 = shuffled[i * 2 + 1] || null;
    await db.run('UPDATE matches SET team1_id = ?, team2_id = ? WHERE id = ?',
      [team1?.id || null, team2?.id || null, match.id]);
    if (team1 && !team2) {
      await db.run('UPDATE matches SET winner_id = ?, status = ? WHERE id = ?', [team1.id, 'finished', match.id]);
      const nextMatch = await db.get('SELECT * FROM matches WHERE round = 2 AND match_number = ?',
        [Math.ceil(match.match_number / 2)]);
      if (nextMatch) {
        const slot = match.match_number % 2 === 1 ? 'team1_id' : 'team2_id';
        await db.run(`UPDATE matches SET ${slot} = ? WHERE id = ?`, [team1.id, nextMatch.id]);
      }
    }
  }

  return { shuffled, firstRoundMatches, totalRounds };
}

router.post('/start', requireAdmin, async (req, res) => {
  try {
    const status = await db.get('SELECT phase FROM tournament_status WHERE id = 1');
    if (status.phase !== 'registration') return res.status(400).json({ error: 'Turniej już się rozpoczął' });

    const { shuffled, firstRoundMatches, totalRounds } = await generateBracket();
    await db.run("UPDATE tournament_status SET phase = 'active', started_at = CURRENT_TIMESTAMP WHERE id = 1");

    const nameSetting = await db.get("SELECT value FROM tournament_settings WHERE key = 'tournament_name'");
    const pairs = firstRoundMatches.map((m, i) => ({
      team1: shuffled[i * 2]?.name,
      team2: shuffled[i * 2 + 1]?.name || null,
      bye: !shuffled[i * 2 + 1]
    }));

    notifyTournamentStart(nameSetting?.value || 'Turniej', pairs);
    res.json({ success: true, rounds: totalRounds });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera: ' + err.message });
  }
});

router.post('/reset', requireAdmin, async (req, res) => {
  try {
    await db.run('DELETE FROM matches');
    await db.run('DELETE FROM team_members');
    await db.run('DELETE FROM teams');
    await db.run("UPDATE tournament_status SET phase = 'registration', started_at = NULL WHERE id = 1");
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// 🎮 DEMO — załaduj przykładowe drużyny i wygeneruj drabinkę
router.post('/demo', requireAdmin, async (req, res) => {
  try {
    // Reset first
    await db.run('DELETE FROM matches');
    await db.run('DELETE FROM team_members');
    await db.run('DELETE FROM teams');
    await db.run("UPDATE tournament_status SET phase = 'registration', started_at = NULL WHERE id = 1");

    const demoTeams = [
      'Czerwone Smoki', 'Niebieskie Orły', 'Zielone Wilki', 'Złote Lwy',
      'Czarne Pantery', 'Białe Rekiny', 'Srebrne Błyskawice', 'Fioletowe Kobry'
    ];

    // Use logged-in admin as representative for all demo teams
    const repId = req.session.user.id;

    for (const name of demoTeams) {
      const result = await db.run('INSERT INTO teams (name, representative_id) VALUES (?, ?)', [name, repId]);
      await db.run('INSERT INTO team_members (team_id, user_id, status) VALUES (?, ?, ?)',
        [result.lastInsertRowid, repId, 'accepted']);
    }

    // Generate bracket
    const { shuffled, firstRoundMatches, totalRounds } = await generateBracket();
    await db.run("UPDATE tournament_status SET phase = 'active', started_at = CURRENT_TIMESTAMP WHERE id = 1");

    const nameSetting = await db.get("SELECT value FROM tournament_settings WHERE key = 'tournament_name'");
    const pairs = firstRoundMatches.map((m, i) => ({
      team1: shuffled[i * 2]?.name,
      team2: shuffled[i * 2 + 1]?.name || null,
      bye: !shuffled[i * 2 + 1]
    }));

    notifyTournamentStart(`[DEMO] ${nameSetting?.value || 'Turniej'}`, pairs);
    res.json({ success: true, teams: demoTeams.length, rounds: totalRounds });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera: ' + err.message });
  }
});

router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await db.all('SELECT id, username, avatar, is_admin, created_at FROM users ORDER BY created_at ASC');
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
