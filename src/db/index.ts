import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const dbPath = process.env.DATABASE_PATH || './data/app.db';

// Ensure the database file exists
const sqlite = new Database(dbPath);

// Wait for a competing writer instead of failing instantly with SQLITE_BUSY.
// This module writes at import time (the WAL pragma below, plus the seed and
// the ALTERs), and `next build` collects page data in three parallel worker
// processes that all import it against the same file — without a busy timeout
// whichever workers lose the race abort the build with "database is locked".
// It has to be set before any other statement to cover them all.
sqlite.pragma('busy_timeout = 10000');

// The busy timeout does not cover this one statement: switching journal mode
// needs a brief exclusive lock, and SQLite fails it immediately instead of
// invoking the busy handler. So retry it by hand, and if it still will not take,
// carry on in the default journal mode — WAL is a performance choice, not a
// correctness one, and it is not worth failing a build over.
for (let attempt = 0; ; attempt++) {
  try {
    sqlite.pragma('journal_mode = WAL');
    break;
  } catch (error) {
    if (attempt >= 20) {
      console.warn('[db] could not enable WAL mode, continuing without it:', error);
      break;
    }
    // Synchronous sleep — better-sqlite3 is synchronous, so there is no event
    // loop turn to yield to here.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  }
}

// Seed a local dev user so all project/tool inserts have a valid user_id
try {
  sqlite.exec(`
    INSERT OR IGNORE INTO users (id, email, name, email_verified, created_at, updated_at)
    VALUES ('dev-local', 'dev@localhost', 'Dev', 1, unixepoch(), unixepoch())
  `);
} catch { /* table may not exist yet on first boot */ }

// Additive schema migrations — safe to run on every startup (errors are swallowed)
const migrations = [
  'ALTER TABLE projects ADD COLUMN units TEXT DEFAULT \'in\'',
  'ALTER TABLE projects ADD COLUMN layout_overrides TEXT DEFAULT \'{}\'',
  'ALTER TABLE projects ADD COLUMN layout_excluded_keys TEXT DEFAULT \'[]\'',
  'ALTER TABLE projects ADD COLUMN layout_padding REAL DEFAULT 0.5',
  'ALTER TABLE projects ADD COLUMN layout_has_active INTEGER DEFAULT 0',
  'ALTER TABLE projects ADD COLUMN step_active_file_id TEXT',
  'ALTER TABLE stocks ADD COLUMN thickness REAL DEFAULT 0',
  'ALTER TABLE cuts ADD COLUMN thickness REAL DEFAULT 0',
  'ALTER TABLE cuts ADD COLUMN step_file_id TEXT',
  'ALTER TABLE cuts ADD COLUMN step_session_id TEXT',
  'ALTER TABLE cuts ADD COLUMN step_body_index INTEGER',
  'ALTER TABLE cuts ADD COLUMN step_face_index INTEGER',
  "ALTER TABLE cuts ADD COLUMN group_name TEXT DEFAULT ''",
  "ALTER TABLE projects ADD COLUMN group_multipliers TEXT DEFAULT '{}'",
  'ALTER TABLE accounts ADD COLUMN access_token_expires_at INTEGER',
  'ALTER TABLE accounts ADD COLUMN refresh_token_expires_at INTEGER',
  'ALTER TABLE accounts ADD COLUMN created_at INTEGER',
  'ALTER TABLE accounts ADD COLUMN updated_at INTEGER',
  'ALTER TABLE accounts ADD COLUMN password TEXT',
  'ALTER TABLE sessions ADD COLUMN updated_at INTEGER',
];
for (const sql of migrations) {
  try { sqlite.exec(sql); } catch { /* column already exists */ }
}

try {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS project_step_files (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      file_hash TEXT DEFAULT '',
      file_size INTEGER DEFAULT 0,
      body_state TEXT DEFAULT '[]',
      selected_body_index INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);
} catch {
  /* table may already exist */
}

export const db = drizzle(sqlite, { schema });
