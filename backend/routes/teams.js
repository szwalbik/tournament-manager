const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const {
  notifyTeamRegistered, notifyJoinRequest, notifyMemberJoined,
  notifyMemberLeft, notifyMemberKicked
} = require('../discord-client');
const { scheduleBackup } = require('../services/backup');
const { sendWebhook } = require('../services/webhook');
const { logAction } = require('../services/audit');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const teams = await db.all(`
      SELECT t.*, u.username as rep_username, u.avatar as rep_avatar,
        COUNT(CASE WHEN tm.status = 'accepted' THEN 1 END) as member_count
      FROM teams t
      JOIN users u ON t.representative_id = u.id
      LEFT JOIN team_members tm ON t.id = tm.team_id
      GROUP BY t.id
      ORDER BY t.created_at ASC
    `);
    const teamsWithMembers = await Promise.all(teams.map(async team => {
      const members = await db.all(`
        SELECT u.id, u.username, u.avatar, tm.status
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ?
      `, [team.id]);
      return { ...team, members };
    }));
    res.json(teamsWithMembers);
  } catch {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  try {
    const modeSetting = await db.get("SELECT value FROM tournament_settings WHERE key = 'mode'");
    const isSolo = modeSetting?.value === 'solo';

    const existing = await db.get('SELECT id FROM teams WHERE representative_id = ?', [userId]);
    if (existing) return res.status(400).json({ error: isSolo ? 'Już bierzesz udział w turnieju' : 'Już jesteś przedstawicielem drużyny' });
    const phase = await db.get('SELECT phase FROM tournament_status WHERE id = 1');
    if (phase.phase !== 'registration') return res.status(400).json({ error: 'Rejestracja jest zamknięta' });
    const maxTeamsSetting = await db.get("SELECT value FROM tournament_settings WHERE key = 'max_teams'");
    const maxTeams = parseInt(maxTeamsSetting?.value || '8');
    const countRow = await db.get('SELECT COUNT(*) as count FROM teams');
    if (countRow.count >= maxTeams) return res.status(400).json({ error: `Osiągnięto maksymalną liczbę ${isSolo ? 'zawodników' : 'drużyn'} (${maxTeams})` });

    let name;
    if (isSolo) {
      // W trybie solo drużyna = jeden zawodnik, nazwa to jego Discordowy nick.
      const player = await db.get('SELECT username FROM users WHERE id = ?', [userId]);
      name = player.username;
      const nameTaken = await db.get('SELECT id FROM teams WHERE name = ?', [name]);
      if (nameTaken) name = `${name}#${userId.slice(-4)}`;
    } else {
      const { name: teamName } = req.body;
      if (!teamName || teamName.trim().length < 2)
        return res.status(400).json({ error: 'Nazwa drużyny musi mieć co najmniej 2 znaki' });
      name = teamName.trim();
    }

    const result = await db.run('INSERT INTO teams (name, representative_id) VALUES (?, ?)', [name, userId]);
    await db.run('INSERT OR IGNORE INTO team_members (team_id, user_id, status) VALUES (?, ?, ?)', [result.lastInsertRowid, userId, 'accepted']);
    const team = await db.get('SELECT * FROM teams WHERE id = ?', [result.lastInsertRowid]);
    const user = await db.get('SELECT username FROM users WHERE id = ?', [userId]);
    notifyTeamRegistered(name, user.username);
    sendWebhook('team_registered', { drużyna: name, kapitan: user.username });
    logAction(user, 'team_registered', `${isSolo ? 'Zawodnik' : 'Drużyna'}: ${name}`);
    scheduleBackup('auto');
    res.json(team);
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Ta nazwa jest już zajęta' });
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.post('/:id/join', requireAuth, async (req, res) => {
  const teamId = req.params.id;
  const userId = req.session.user.id;
  try {
    const modeSetting = await db.get("SELECT value FROM tournament_settings WHERE key = 'mode'");
    if (modeSetting?.value === 'solo') return res.status(400).json({ error: 'Turniej solo — brak dołączania do zawodników' });
    const team = await db.get('SELECT * FROM teams WHERE id = ?', [teamId]);
    if (!team) return res.status(404).json({ error: 'Drużyna nie istnieje' });
    const alreadyMember = await db.get('SELECT * FROM team_members WHERE user_id = ?', [userId]);
    if (alreadyMember) return res.status(400).json({ error: 'Już należysz do drużyny lub masz oczekujące zaproszenie' });
    await db.run('INSERT INTO team_members (team_id, user_id, status) VALUES (?, ?, ?)', [teamId, userId, 'pending']);
    const user = await db.get('SELECT username FROM users WHERE id = ?', [userId]);
    notifyJoinRequest(user.username, team.name);
    scheduleBackup('auto');
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: 'Nie możesz dołączyć do tej drużyny' });
  }
});

router.post('/:id/members/:userId/respond', requireAuth, async (req, res) => {
  const { id: teamId, userId } = req.params;
  const { action } = req.body;
  const repId = req.session.user.id;
  try {
    const team = await db.get('SELECT * FROM teams WHERE id = ?', [teamId]);
    if (!team) return res.status(404).json({ error: 'Drużyna nie istnieje' });
    if (team.representative_id !== repId) return res.status(403).json({ error: 'Tylko przedstawiciel może zarządzać członkami' });
    if (action === 'accept') {
      await db.run("UPDATE team_members SET status = 'accepted' WHERE team_id = ? AND user_id = ?", [teamId, userId]);
      const user = await db.get('SELECT username FROM users WHERE id = ?', [userId]);
      notifyMemberJoined(user.username, team.name);
      sendWebhook('member_joined', { gracz: user.username, drużyna: team.name });
    } else {
      await db.run('DELETE FROM team_members WHERE team_id = ? AND user_id = ?', [teamId, userId]);
    }
    scheduleBackup('auto');
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.post('/:id/leave', requireAuth, async (req, res) => {
  const teamId = req.params.id;
  const userId = req.session.user.id;
  try {
    const team = await db.get('SELECT * FROM teams WHERE id = ?', [teamId]);
    if (!team) return res.status(404).json({ error: 'Drużyna nie istnieje' });
    if (team.representative_id === userId)
      return res.status(400).json({ error: 'Kapitan nie może opuścić drużyny. Najpierw usuń drużynę.' });
    const membership = await db.get(
      "SELECT * FROM team_members WHERE team_id = ? AND user_id = ? AND status = 'accepted'",
      [teamId, userId]
    );
    if (!membership) return res.status(400).json({ error: 'Nie jesteś członkiem tej drużyny' });
    await db.run('DELETE FROM team_members WHERE team_id = ? AND user_id = ?', [teamId, userId]);
    const user = await db.get('SELECT username FROM users WHERE id = ?', [userId]);
    notifyMemberLeft(user.username, team.name);
    scheduleBackup('auto');
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.post('/:id/members/:userId/kick', requireAuth, async (req, res) => {
  const { id: teamId, userId } = req.params;
  const requesterId = req.session.user.id;
  try {
    const team = await db.get('SELECT * FROM teams WHERE id = ?', [teamId]);
    if (!team) return res.status(404).json({ error: 'Drużyna nie istnieje' });
    const requester = await db.get('SELECT is_admin FROM users WHERE id = ?', [requesterId]);
    if (!requester?.is_admin && team.representative_id !== requesterId)
      return res.status(403).json({ error: 'Tylko kapitan lub admin może wyrzucać graczy' });
    if (userId === team.representative_id)
      return res.status(400).json({ error: 'Nie można wyrzucić kapitana' });
    await db.run('DELETE FROM team_members WHERE team_id = ? AND user_id = ?', [teamId, userId]);
    const kicked = await db.get('SELECT username FROM users WHERE id = ?', [userId]);
    notifyMemberKicked(kicked?.username, team.name);
    sendWebhook('member_kicked', { gracz: kicked?.username, drużyna: team.name });
    scheduleBackup('auto');
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  const teamId = req.params.id;
  const userId = req.session.user.id;
  try {
    const user = await db.get('SELECT is_admin FROM users WHERE id = ?', [userId]);
    const team = await db.get('SELECT * FROM teams WHERE id = ?', [teamId]);
    if (!team) return res.status(404).json({ error: 'Drużyna nie istnieje' });
    if (!user.is_admin && team.representative_id !== userId)
      return res.status(403).json({ error: 'Brak uprawnień' });
    await db.run('DELETE FROM team_members WHERE team_id = ?', [teamId]);
    await db.run('DELETE FROM teams WHERE id = ?', [teamId]);
    logAction(req.session.user, 'team_deleted', `Usunięto drużynę: ${team.name}`);
    scheduleBackup('auto');
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
