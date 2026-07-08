const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../tournament.db');
const sqlite = new sqlite3.Database(dbPath);

// Enable WAL mode for better performance
sqlite.run('PRAGMA journal_mode=WAL');
sqlite.run('PRAGMA foreign_keys=ON');

// Create schema
sqlite.serialize(() => {
  sqlite.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    discriminator TEXT,
    avatar TEXT,
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    title TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    accent_color TEXT DEFAULT '',
    custom_fields TEXT DEFAULT '[]',
    full_name TEXT DEFAULT ''
  )`);

  // --- Migracje: dołóż kolumny do już istniejących baz (np. wgranych z backupu) ---
  // SQLite nie wspiera "ADD COLUMN IF NOT EXISTS", więc łapiemy błąd "duplicate column".
  const profileMigrations = [
    "ALTER TABLE users ADD COLUMN title TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN accent_color TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN custom_fields TEXT DEFAULT '[]'",
    // Imię i nazwisko — wyświetlane zamiast nicku (nick zostaje widoczny pod spodem)
    "ALTER TABLE users ADD COLUMN full_name TEXT DEFAULT ''",
  ];
  profileMigrations.forEach(sql => {
    sqlite.run(sql, [], (err) => {
      if (err && !/duplicate column/i.test(err.message)) {
        console.warn('Migracja nieudana:', sql, err.message);
      }
    });
  });

  sqlite.run(`CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    representative_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (representative_id) REFERENCES users(id)
  )`);

  sqlite.run(`CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(team_id, user_id)
  )`);

  sqlite.run(`CREATE TABLE IF NOT EXISTS tournament_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);

  sqlite.run(`CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round INTEGER NOT NULL,
    match_number INTEGER NOT NULL,
    team1_id INTEGER,
    team2_id INTEGER,
    team1_score INTEGER,
    team2_score INTEGER,
    team1_confirmed INTEGER DEFAULT 0,
    team2_confirmed INTEGER DEFAULT 0,
    winner_id INTEGER,
    status TEXT DEFAULT 'scheduled',
    scheduled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team1_id) REFERENCES teams(id),
    FOREIGN KEY (team2_id) REFERENCES teams(id),
    FOREIGN KEY (winner_id) REFERENCES teams(id)
  )`);

  sqlite.run(`CREATE TABLE IF NOT EXISTS tournament_status (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    phase TEXT DEFAULT 'registration',
    started_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  sqlite.run(`CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id TEXT,
    actor_username TEXT,
    action TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  sqlite.run(`INSERT OR IGNORE INTO tournament_status (id, phase) VALUES (1, 'registration')`);
  sqlite.run(`INSERT OR IGNORE INTO tournament_settings (key, value) VALUES ('max_teams', '8')`);
  sqlite.run(`INSERT OR IGNORE INTO tournament_settings (key, value) VALUES ('tournament_name', 'Turniej Ping-Ponga')`);
  sqlite.run(`INSERT OR IGNORE INTO tournament_settings (key, value) VALUES ('discord_channel_id', '')`);
  sqlite.run(`INSERT OR IGNORE INTO tournament_settings (key, value) VALUES ('mode', 'teams')`);
  // 🔔 Powiadomienia webhookowe (Discord webhook URL lub dowolny generyczny endpoint HTTP)
  sqlite.run(`INSERT OR IGNORE INTO tournament_settings (key, value) VALUES ('webhook_url', '')`);
  // 💾 Automatyczne kopie zapasowe na Discord (kanał, na który bot wysyła plik z pełnym stanem bazy)
  sqlite.run(`INSERT OR IGNORE INTO tournament_settings (key, value) VALUES ('backup_channel_id', '')`);
  sqlite.run(`INSERT OR IGNORE INTO tournament_settings (key, value) VALUES ('auto_backup_enabled', '1')`);
  sqlite.run(`INSERT OR IGNORE INTO tournament_settings (key, value) VALUES ('last_backup_at', '')`);
  sqlite.run(`INSERT OR IGNORE INTO tournament_settings (key, value) VALUES ('last_restore_at', '')`);
});

// Promisified helpers so routes can use async/await
const db = {
  get: (sql, params = []) => new Promise((resolve, reject) => {
    sqlite.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  }),
  all: (sql, params = []) => new Promise((resolve, reject) => {
    sqlite.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  }),
  run: (sql, params = []) => new Promise((resolve, reject) => {
    sqlite.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastInsertRowid: this.lastID, changes: this.changes });
    });
  }),
  serialize: (fn) => sqlite.serialize(fn),
  exec: (sql) => new Promise((resolve, reject) => {
    sqlite.exec(sql, (err) => err ? reject(err) : resolve());
  }),
  dbPath,
};

module.exports = db;
