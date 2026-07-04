const express = require('express');
const db = require('../db/database');

const router = express.Router();

// Publiczne, podstawowe informacje o turnieju — dostępne bez logowania.
// Dzięki temu strona główna i lista zawodników wiedzą czy turniej jest
// w trybie drużynowym czy solo, jaka jest faza itd., bez potrzeby
// uprawnień administratora.
router.get('/settings', async (req, res) => {
  try {
    const settings = await db.all('SELECT key, value FROM tournament_settings');
    const map = {};
    settings.forEach(s => { map[s.key] = s.value; });
    const status = await db.get('SELECT phase, started_at FROM tournament_status WHERE id = 1');
    const teamsCount = await db.get('SELECT COUNT(*) as count FROM teams');

    res.json({
      phase: status?.phase || 'registration',
      started_at: status?.started_at || null,
      mode: map.mode === 'solo' ? 'solo' : 'teams',
      tournament_name: map.tournament_name || 'Turniej Ping-Ponga',
      max_teams: parseInt(map.max_teams || '8'),
      teams_count: teamsCount?.count || 0,
    });
  } catch {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
