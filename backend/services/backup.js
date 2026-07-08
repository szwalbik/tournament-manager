// 💾 System kopii zapasowych "na Discordzie"
//
// Problem: darmowy hosting (Render/Railway free tier) ma NIETRWAŁY dysk —
// po restarcie/usypianiu serwisu plik tournament.db bywa zerowany.
//
// Rozwiązanie: zamiast płacić za trwały dysk albo zakładać konto w kolejnej
// usłudze, wykorzystujemy bota Discord, który i tak już jest częścią appki.
// Co jakiś czas (i po ważnych akcjach) cały stan bazy jest eksportowany do
// JSON-a i wysyłany jako załącznik na wybrany kanał Discord. Przy starcie
// serwera — jeśli baza jest pusta (świeży restart na zerowym dysku) —
// aplikacja sama pobiera najnowszy plik z tego kanału i odtwarza dane.
//
// Dzięki temu restart/usunięcie dysku przez hosting przestaje być groźne:
// najgorszy wypadek to utrata zmian z ostatnich ~kilkunastu minut.

const db = require('../db/database');
const { sendFileToChannel, fetchLatestBackupFile, isBotReady } = require('../discord-client');

const BACKUP_FILE_PREFIX = 'tourneymanager-backup';
const TABLES_IN_EXPORT_ORDER = [
  'users', 'teams', 'team_members', 'tournament_settings',
  'tournament_status', 'matches', 'audit_log',
];

let backupTimer = null;
let backupInFlight = false;
let lastAutoBackupAt = 0;
const MIN_AUTO_BACKUP_INTERVAL_MS = 60 * 1000; // nie częściej niż raz na minutę

async function getSetting(key) {
  const row = await db.get('SELECT value FROM tournament_settings WHERE key = ?', [key]);
  return row?.value || '';
}

async function setSetting(key, value) {
  await db.run(
    "INSERT INTO tournament_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}

async function getBackupChannelId() {
  const backupChannel = await getSetting('backup_channel_id');
  if (backupChannel) return backupChannel;
  // Fallback: jeśli nie ustawiono osobnego kanału backupu, użyj kanału powiadomień.
  return getSetting('discord_channel_id');
}

// --- EKSPORT ---
async function exportSnapshot() {
  const tables = {};
  for (const table of TABLES_IN_EXPORT_ORDER) {
    tables[table] = await db.all(`SELECT * FROM ${table}`);
  }
  return {
    format: 'tourneymanager-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

// --- IMPORT ---
// Nadpisuje całą bazę danymi z backupu. Kolejność ma znaczenie ze względu
// na klucze obce (users -> teams -> team_members -> matches).
async function importSnapshot(snapshot) {
  if (!snapshot || !snapshot.tables) throw new Error('Nieprawidłowy plik kopii zapasowej');

  await db.run('PRAGMA foreign_keys = OFF');
  try {
    // Czyścimy w odwrotnej kolejności zależności
    for (const table of [...TABLES_IN_EXPORT_ORDER].reverse()) {
      if (table === 'tournament_status') continue; // ma stały wiersz z id=1, nadpiszemy przez UPSERT
      await db.run(`DELETE FROM ${table}`);
    }

    for (const table of TABLES_IN_EXPORT_ORDER) {
      const rows = snapshot.tables[table] || [];
      for (const row of rows) {
        const columns = Object.keys(row);
        if (columns.length === 0) continue;
        const placeholders = columns.map(() => '?').join(', ');
        const updateClause = columns.map(c => `${c} = excluded.${c}`).join(', ');
        const pkCol = table === 'tournament_settings' ? 'key' : 'id';
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
          ON CONFLICT(${pkCol}) DO UPDATE SET ${updateClause}`;
        await db.run(sql, columns.map(c => row[c]));
      }
    }
  } finally {
    await db.run('PRAGMA foreign_keys = ON');
  }
}

// --- WYSYŁKA DO DISCORDA ---
async function backupToDiscord(trigger = 'manual') {
  if (backupInFlight) return { ok: false, error: 'Backup już w trakcie' };
  const autoEnabled = (await getSetting('auto_backup_enabled')) !== '0';
  if (trigger === 'auto' && !autoEnabled) return { ok: false, error: 'Auto-backup wyłączony' };
  if (!isBotReady()) return { ok: false, error: 'Bot Discord nie jest zalogowany' };

  const channelId = await getBackupChannelId();
  if (!channelId) return { ok: false, error: 'Nie ustawiono kanału backupu ani kanału powiadomień' };

  backupInFlight = true;
  try {
    const snapshot = await exportSnapshot();
    const buffer = Buffer.from(JSON.stringify(snapshot, null, 2), 'utf-8');
    const filename = `${BACKUP_FILE_PREFIX}-${Date.now()}.json`;
    const teamsCount = snapshot.tables.teams?.length || 0;
    const usersCount = snapshot.tables.users?.length || 0;
    const label = trigger === 'auto' ? '⏱️ Automatyczna kopia zapasowa' : '💾 Ręczna kopia zapasowa';
    const content = `${label} — ${usersCount} użytkowników, ${teamsCount} drużyn/zawodników.`;
    const result = await sendFileToChannel(channelId, buffer, filename, content);
    if (result.ok) {
      await setSetting('last_backup_at', new Date().toISOString());
      lastAutoBackupAt = Date.now();
    }
    return result;
  } finally {
    backupInFlight = false;
  }
}

// Łączy wiele wyzwalaczy w jeden backup (np. 5 akcji w 20 sekund = 1 wysyłka),
// żeby nie zasypywać kanału Discord i nie łapać rate-limitów.
function scheduleBackup(trigger = 'auto') {
  if (backupTimer) return;
  backupTimer = setTimeout(async () => {
    backupTimer = null;
    try {
      await backupToDiscord(trigger);
    } catch (err) {
      console.warn('Zaplanowany backup nie powiódł się:', err.message);
    }
  }, 20 * 1000);
}

// --- ODTWARZANIE Z DISCORDA ---
async function restoreFromDiscord() {
  if (!isBotReady()) return { ok: false, error: 'Bot Discord nie jest zalogowany' };
  const channelId = await getBackupChannelId();
  if (!channelId) return { ok: false, error: 'Nie ustawiono kanału backupu ani kanału powiadomień' };

  const fileResult = await fetchLatestBackupFile(channelId, BACKUP_FILE_PREFIX);
  if (!fileResult.ok) return fileResult;

  let snapshot;
  try {
    snapshot = JSON.parse(fileResult.text);
  } catch {
    return { ok: false, error: 'Plik kopii zapasowej jest uszkodzony (nieprawidłowy JSON)' };
  }

  await importSnapshot(snapshot);
  await setSetting('last_restore_at', new Date().toISOString());
  return { ok: true, restoredFrom: fileResult.createdAt, exportedAt: snapshot.exportedAt };
}

// Sprawdza, czy warto automatycznie odtworzyć dane przy starcie serwera
// (np. po restarcie hostingu, który wyzerował dysk).
async function autoHealOnBoot() {
  try {
    const countRow = await db.get('SELECT COUNT(*) as count FROM users');
    if (countRow.count > 0) return { ok: false, error: 'Baza nie jest pusta — pomijam auto-restore' };
    const result = await restoreFromDiscord();
    if (result.ok) {
      console.log(`♻️  Auto-restore: przywrócono dane z Discorda (kopia z ${result.restoredFrom})`);
    } else {
      console.log(`ℹ️  Auto-restore pominięty: ${result.error}`);
    }
    return result;
  } catch (err) {
    console.warn('Auto-restore nie powiódł się:', err.message);
    return { ok: false, error: err.message };
  }
}

function startPeriodicBackup(intervalMinutes = 15) {
  setInterval(async () => {
    if (Date.now() - lastAutoBackupAt < MIN_AUTO_BACKUP_INTERVAL_MS) return;
    try {
      await backupToDiscord('auto');
    } catch (err) {
      console.warn('Okresowy backup nie powiódł się:', err.message);
    }
  }, intervalMinutes * 60 * 1000);
}

module.exports = {
  exportSnapshot,
  importSnapshot,
  backupToDiscord,
  scheduleBackup,
  restoreFromDiscord,
  autoHealOnBoot,
  startPeriodicBackup,
  getBackupChannelId,
};
