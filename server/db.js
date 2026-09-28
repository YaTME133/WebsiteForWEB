import './config.js';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envDb = process.env.DB_PATH;
const DB_PATH = envDb
  ? (path.isAbsolute(envDb) ? envDb : path.join(__dirname, envDb))
  : path.join(__dirname, '..', 'database', 'database.sqlite');

// Ensure directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

sqlite3.verbose();
export const db = new sqlite3.Database(DB_PATH);

// Helpful log
if (process.env.NODE_ENV !== 'test') {
  console.log('SQLite DB file:', DB_PATH);
}

export function initDb() {
  return new Promise((resolve) => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student','admin','superadmin')),
      is_blocked INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      difficulty TEXT NOT NULL CHECK(difficulty IN ('easy','medium','hard')),
      topic_id INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(id),
      FOREIGN KEY(topic_id) REFERENCES topics(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS solutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','correct','wrong')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(task_id) REFERENCES tasks(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Migrations: add columns if missing
    function ensureColumn(table, column, defSql) {
      return new Promise((resolve) => {
        db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
          if (err) return resolve();
          const exists = (rows || []).some((r) => String(r.name).toLowerCase() === String(column).toLowerCase());
          if (exists) return resolve();
          db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${defSql}`, [], () => resolve());
        });
      });
    }

    // tasks.points: integer points for a task
    // solutions.awarded_points: integer points awarded for this submission
    Promise.all([
      ensureColumn('tasks', 'points', 'INTEGER NOT NULL DEFAULT 0'),
      ensureColumn('solutions', 'awarded_points', 'INTEGER NOT NULL DEFAULT 0'),
      ensureColumn('tasks', 'topic_id', 'INTEGER NULL'),
      ensureColumn('solutions', 'is_auto', 'INTEGER NOT NULL DEFAULT 0'),
      ensureColumn('solutions', 'batch_id', 'INTEGER NULL'),
      ensureColumn('tasks', 'correct_answer', 'TEXT NULL'),
      ensureColumn('topic_submissions', 'is_locked', 'INTEGER NOT NULL DEFAULT 0'),
      ensureColumn('topics', 'is_locked', 'INTEGER NOT NULL DEFAULT 1')
    ]).then(() => resolve());
  });
  });
}

// Create topics table outside serialize call to avoid FK reference issues; ensure existence early
db.run(`CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Лог модерации решений (одобрено/отклонено)
db.run(`CREATE TABLE IF NOT EXISTS moderation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  solution_id INTEGER NOT NULL,
  moderator_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('approved','rejected')),
  awarded_points INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(solution_id) REFERENCES solutions(id),
  FOREIGN KEY(moderator_id) REFERENCES users(id)
)`);

// Логи анти-списывания
db.run(`CREATE TABLE IF NOT EXISTS cheating_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  task_id INTEGER,
  event_type TEXT NOT NULL,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(task_id) REFERENCES tasks(id)
)`);

// Отправки целых тем (батчи)
db.run(`CREATE TABLE IF NOT EXISTS topic_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(topic_id) REFERENCES topics(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);
