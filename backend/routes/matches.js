const express = require('express');
const db = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { notifyResultSubmitted, notifyMatchFinished } = require('../discord-client');
const { scheduleBackup } = require('../services/backup');
const { sendWebhook } = require('../services/webhook');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const matches = await db.all(`
      SELECT m.*,
        t1.name as team1_name, t2.name as team2_name,
        w.name as winner_name
      FROM matches m
      LEFT JOIN teams t1 ON m.team1_id = t1.id
      LEFT JOIN teams t2 ON m.team2_id = t2.id
      LEFT JOIN teams w ON m.winner_id = w.id
      ORDER BY m.round ASC, m.match_number ASC
    `);
    res.json(matches);
  } catch {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.post('/:id/result', requireAuth, async (req, res) => {
  const matchId = req.params.id;
  const { team1_score, team2_score } = req.body;
  const userId = req.session.user.id;
  if (team1_score === undefined || team2_score === undefined)
    return res.status(400).json({ error: 'Podaj wyniki obu drużyn' });
  try {
    const match = await db.get(`
      SELECT m.*, t1.name as team1_name, t2.name as team2_name,
        t1.representative_id as t1_rep, t2.representative_id as t2_rep
      FROM matches m
      LEFT JOIN teams t1 ON m.team1_id = t1.id
      LEFT JOIN teams t2 ON m.team2_id = t2.id
      WHERE m.id = ?
    `, [matchId]);
    if (!match) return res.status(404).json({ error: 'Mecz nie istnieje' });
    if (match.status === 'finished') return res.status(400).json({ error: 'Mecz już zakończony' });
    const isTeam1Rep = match.t1_rep === userId;
    const isTeam2Rep = match.t2_rep === userId;
    if (!isTeam1Rep && !isTeam2Rep)
      return res.status(403).json({ error: 'Tylko przedstawiciele drużyn mogą zgłaszać wyniki' });

    if (isTeam1Rep) {
      await db.run('UPDATE matches SET team1_score = ?, team2_score = ?, team1_confirmed = 1 WHERE id = ?',
        [team1_score, team2_score, matchId]);
    } else {
      await db.run('UPDATE matches SET team1_score = ?, team2_score = ?, team2_confirmed = 1 WHERE id = ?',
        [team1_score, team2_score, matchId]);
    }

    const updated = await db.get('SELECT * FROM matches WHERE id = ?', [matchId]);

    if (updated.team1_confirmed && updated.team2_confirmed) {
      const winnerId = updated.team1_score > updated.team2_score ? updated.team1_id : updated.team2_id;
      await db.run('UPDATE matches SET status = ?, winner_id = ? WHERE id = ?', ['finished', winnerId, matchId]);
      await advanceWinner(matchId, winnerId);
      const winner = await db.get('SELECT name FROM teams WHERE id = ?', [winnerId]);
      notifyMatchFinished(match.team1_name, match.team2_name, updated.team1_score, updated.team2_score, winner.name, match.round, false);
      sendWebhook('match_finished', {
        mecz: `${match.team1_name} vs ${match.team2_name}`,
        wynik: `${updated.team1_score}:${updated.team2_score}`,
        zwycięzca: winner.name, runda: match.round
      });
    } else {
      const submitter = isTeam1Rep ? match.team1_name : match.team2_name;
      notifyResultSubmitted(match.team1_name, match.team2_name, team1_score, team2_score, submitter);
      sendWebhook('result_submitted', {
        mecz: `${match.team1_name} vs ${match.team2_name}`,
        wynik: `${team1_score}:${team2_score}`, zgłosił: submitter
      });
    }
    scheduleBackup('auto');
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.post('/:id/admin-result', requireAdmin, async (req, res) => {
  const matchId = req.params.id;
  const { team1_score, team2_score } = req.body;
  try {
    const match = await db.get(`
      SELECT m.*, t1.name as team1_name, t2.name as team2_name
      FROM matches m
      LEFT JOIN teams t1 ON m.team1_id = t1.id
      LEFT JOIN teams t2 ON m.team2_id = t2.id
      WHERE m.id = ?
    `, [matchId]);
    if (!match) return res.status(404).json({ error: 'Mecz nie istnieje' });
    const winnerId = team1_score > team2_score ? match.team1_id : match.team2_id;
    await db.run(
      'UPDATE matches SET team1_score = ?, team2_score = ?, team1_confirmed = 1, team2_confirmed = 1, status = ?, winner_id = ? WHERE id = ?',
      [team1_score, team2_score, 'finished', winnerId, matchId]
    );
    await advanceWinner(matchId, winnerId);
    const winner = await db.get('SELECT name FROM teams WHERE id = ?', [winnerId]);
    notifyMatchFinished(match.team1_name, match.team2_name, team1_score, team2_score, winner.name, match.round, true);
    sendWebhook('match_finished', {
      mecz: `${match.team1_name} vs ${match.team2_name}`,
      wynik: `${team1_score}:${team2_score}`,
      zwycięzca: winner.name, runda: match.round, tryb: 'admin'
    });
    scheduleBackup('auto');
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

async function advanceWinner(matchId, winnerId) {
  const match = await db.get('SELECT * FROM matches WHERE id = ?', [matchId]);
  const nextRound = match.round + 1;
  const nextMatchNumber = Math.ceil(match.match_number / 2);
  const nextMatch = await db.get('SELECT * FROM matches WHERE round = ? AND match_number = ?', [nextRound, nextMatchNumber]);
  if (nextMatch) {
    const slot = match.match_number % 2 === 1 ? 'team1_id' : 'team2_id';
    await db.run(`UPDATE matches SET ${slot} = ? WHERE id = ?`, [winnerId, nextMatch.id]);
  }
}

module.exports = router;
