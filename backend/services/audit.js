// 📜 Prosty dziennik aktywności (audit log)
//
// Zapisuje kto i co zrobił w systemie — przydatne dla adminów, żeby wiedzieć
// kto dodał kogo do adminów, kto zresetował turniej, kto usunął drużynę itd.
// Trzymane w tej samej bazie co reszta danych, więc jest też objęte
// systemem kopii zapasowych na Discordzie.

const db = require('../db/database');

const MAX_ENTRIES = 500;

async function logAction(actor, action, details = '') {
  try {
    await db.run(
      'INSERT INTO audit_log (actor_id, actor_username, action, details) VALUES (?, ?, ?, ?)',
      [actor?.id || null, actor?.username || 'System', action, details]
    );
    // Trzymaj tabelę w rozsądnym rozmiarze
    await db.run(
      `DELETE FROM audit_log WHERE id NOT IN (
        SELECT id FROM audit_log ORDER BY id DESC LIMIT ${MAX_ENTRIES}
      )`
    );
  } catch (err) {
    console.warn('Nie udało się zapisać wpisu audit log:', err.message);
  }
}

async function getRecentLogs(limit = 100) {
  return db.all('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?', [limit]);
}

module.exports = { logAction, getRecentLogs };
