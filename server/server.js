import './config.js';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import { db, initDb } from './db.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { seed } from './seed.js';
import { signToken, authMiddleware, requireRole } from './auth.js';

const app = express();
const PORT = process.env.PORT || 4000;

// CORS: более гибкая настройка для разработки
const ENV_ORIGIN = process.env.CORS_ORIGIN; // можно задать в server/.env
const envOrigins = (ENV_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const isDev = process.env.NODE_ENV !== 'production';
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // для curl/Postman
  if (ENV_ORIGIN === '*') return callback(null, true);
  if (envOrigins.length && envOrigins.includes(origin)) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (/^http:\/\/192\.168\.[0-9]+\.[0-9]+:5173$/.test(origin)) return callback(null, true);
      if (/^http:\/\/10\.[0-9]+\.[0-9]+\.[0-9]+:5173$/.test(origin)) return callback(null, true);
      if (isDev) return callback(null, true); // максимально лояльно в dev
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

await initDb();

// Helper: promisified db ops
function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}
function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// Seed endpoint (dev only)
app.post('/api/dev/seed', async (req, res) => {
  try {
    await seed();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Seed failed' });
  }
});

// AUTH
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const exists = await getAsync('SELECT id FROM users WHERE email = ?', [email]);
    if (exists) return res.status(400).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const result = await runAsync('INSERT INTO users (email, password_hash, role) VALUES (?,?,?)', [email, hash, 'student']);
    const user = await getAsync('SELECT id, email, role, is_blocked FROM users WHERE id = ?', [result.lastID]);
    const token = signToken(user);
    res.json({ token, user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await getAsync('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    if (user.is_blocked) return res.status(403).json({ error: 'User is blocked' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, is_blocked: user.is_blocked } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await getAsync('SELECT id, email, role, is_blocked FROM users WHERE id = ?', [req.user.id]);
  res.json({ user });
});

// USERS: просмотр доступен admin и superadmin; управление — только superadmin
app.get('/api/users', authMiddleware, requireRole('admin', 'superadmin'), async (req, res) => {
  const users = await allAsync('SELECT id, email, role, is_blocked, created_at FROM users ORDER BY id');
  res.json({ users });
});

app.patch('/api/users/:id/role', authMiddleware, requireRole('superadmin'), async (req, res) => {
  const { role } = req.body;
  const { id } = req.params;
  if (!['student', 'admin', 'superadmin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  await runAsync('UPDATE users SET role = ? WHERE id = ?', [role, id]);
  const user = await getAsync('SELECT id, email, role, is_blocked FROM users WHERE id = ?', [id]);
  res.json({ user });
});

app.patch('/api/users/:id/block', authMiddleware, requireRole('superadmin'), async (req, res) => {
  const { is_blocked } = req.body;
  const { id } = req.params;
  await runAsync('UPDATE users SET is_blocked = ? WHERE id = ?', [is_blocked ? 1 : 0, id]);
  const user = await getAsync('SELECT id, email, role, is_blocked FROM users WHERE id = ?', [id]);
  res.json({ user });
});

// Reset student's password (admin & superadmin). Admins may reset only for students.
app.patch('/api/users/:id/password', authMiddleware, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
    }
    const target = await getAsync('SELECT id, role FROM users WHERE id = ?', [id]);
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
    // Admin может менять пароль только студентам; супер‑админ — любым (по требованию можно ограничить)
    if (req.user.role === 'admin' && target.role !== 'student') {
      return res.status(403).json({ error: 'Сброс пароля доступен администратору только для студентов' });
    }
    const hash = await bcrypt.hash(String(password), 10);
    await runAsync('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Не удалось обновить пароль' });
  }
});

// Delete user (superadmin only)
app.delete('/api/users/:id', authMiddleware, requireRole('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    // prevent deleting self
    if (String(req.user.id) === String(id)) {
      return res.status(400).json({ error: 'Нельзя удалить свой аккаунт' });
    }
    const u = await getAsync('SELECT id, role FROM users WHERE id = ?', [id]);
    if (!u) return res.status(404).json({ error: 'Пользователь не найден' });
    // optional: protect last superadmin
    if (u.role === 'superadmin') {
      const others = await allAsync("SELECT id FROM users WHERE role = 'superadmin' AND id <> ?", [id]);
      if (others.length === 0) return res.status(400).json({ error: 'Нельзя удалить единственного главного администратора' });
    }
    // cleanup related rows
    await runAsync('DELETE FROM solutions WHERE user_id = ?', [id]);
    await runAsync('UPDATE tasks SET created_by = NULL WHERE created_by = ?', [id]);
    await runAsync('DELETE FROM users WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Не удалось удалить пользователя' });
  }
});

// TASKS
app.get('/api/tasks', async (req, res) => {
  const tasks = await allAsync('SELECT id, title, description, difficulty, points, topic_id, created_at, correct_answer FROM tasks ORDER BY id DESC');
  res.json({ tasks });
});

app.get('/api/tasks/:id', async (req, res) => {
  const task = await getAsync('SELECT id, title, description, difficulty, points, topic_id, created_at, correct_answer FROM tasks WHERE id = ?', [req.params.id]);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json({ task });
});

// Topics with tasks
app.get('/api/topics', async (req, res) => {
  const topics = await allAsync('SELECT id, name, description, sort_order, COALESCE(is_locked,0) as is_locked FROM topics ORDER BY sort_order, id');
  const tasks = await allAsync('SELECT id, title, description, difficulty, points, topic_id, correct_answer FROM tasks ORDER BY id');
  const byTopic = new Map();
  for (const t of topics) byTopic.set(t.id, { ...t, tasks: [] });
  for (const task of tasks) {
    if (task.topic_id && byTopic.has(task.topic_id)) byTopic.get(task.topic_id).tasks.push(task);
  }
  res.json({ topics: Array.from(byTopic.values()) });
});

// Topic stats (admin area)
app.get('/api/topics/:id/stats', authMiddleware, requireRole('admin', 'superadmin'), async (req, res) => {
  const id = Number(req.params.id)
  const tp = await getAsync('SELECT id FROM topics WHERE id = ?', [id])
  if (!tp) return res.status(404).json({ error: 'Topic not found' })
  const tCountRow = await getAsync('SELECT COUNT(*) as cnt FROM tasks WHERE topic_id = ?', [id])
  const sCountRow = await getAsync(
    'SELECT COUNT(s.id) as cnt FROM solutions s JOIN tasks t ON t.id = s.task_id WHERE t.topic_id = ?',
    [id]
  )
  res.json({ tasks_count: Number(tCountRow?.cnt || 0), solutions_count: Number(sCountRow?.cnt || 0) })
});

// Single topic by id with tasks
app.get('/api/topics/:id', async (req, res) => {
  const id = Number(req.params.id)
  const tp = await getAsync('SELECT id, name, description, sort_order, COALESCE(is_locked,0) as is_locked FROM topics WHERE id = ?', [id])
  if (!tp) return res.status(404).json({ error: 'Topic not found' })
  const tasks = await allAsync('SELECT id, title, description, difficulty, points, topic_id, correct_answer FROM tasks WHERE topic_id = ? ORDER BY id', [id])
  res.json({ topic: { ...tp, tasks } })
});

// Student submits entire topic as a batch
app.post('/api/topics/:id/submit', authMiddleware, requireRole('student','admin','superadmin'), async (req, res) => {
  const topicId = Number(req.params.id)
  const tp = await getAsync('SELECT id, COALESCE(is_locked,0) as is_locked FROM topics WHERE id = ?', [topicId])
  if (!tp) return res.status(404).json({ error: 'Topic not found' })
  // Запрет студентам, если тема заблокирована
  if (tp.is_locked && req.user.role === 'student') return res.status(403).json({ error: 'Тема ещё не доступна для прохождения' })
  const { answers, reason } = req.body || {}
  if (!answers || typeof answers !== 'object') return res.status(400).json({ error: 'answers object required' })
  // block duplicate submissions while previous is pending
  const existing = await getAsync('SELECT id FROM topic_submissions WHERE topic_id = ? AND user_id = ? AND status = ? ORDER BY id DESC LIMIT 1', [topicId, req.user.id, 'pending'])
  if (existing) return res.status(400).json({ error: 'У вас уже есть отправка этой темы на проверке. Дождитесь решения администратора.' })
  const tks = await allAsync('SELECT id FROM tasks WHERE topic_id = ? ORDER BY id', [topicId])
  if (!tks.length) return res.status(400).json({ error: 'No tasks in topic' })
  // create batch
  const b = await runAsync('INSERT INTO topic_submissions (topic_id, user_id, status) VALUES (?,?,?)', [topicId, req.user.id, 'pending'])
  const batchId = b.lastID
  // create solutions linked to batch (pending)
  let created = 0
  const isAuto = String(reason || '').toLowerCase() === 'auto_fail' ? 1 : 0
  for (const row of tks) {
    const code = String(answers[row.id] || '').trim()
    if (!code) { continue }
    const ins = await runAsync('INSERT INTO solutions (task_id, user_id, code, status, batch_id, is_auto) VALUES (?,?,?,?,?,?)', [row.id, req.user.id, code, 'pending', batchId, isAuto])
    if (ins?.lastID) created++
  }
  const payload = await getAsync('SELECT * FROM topic_submissions WHERE id = ?', [batchId])
  res.status(201).json({ submission: payload, createdSolutions: created })
})

// Admin: lock/unlock topic
app.patch('/api/topics/:id/lock', authMiddleware, requireRole('admin','superadmin'), async (req, res) => {
  const id = Number(req.params.id)
  const { is_locked } = req.body || {}
  const tp = await getAsync('SELECT id FROM topics WHERE id = ?', [id])
  if (!tp) return res.status(404).json({ error: 'Topic not found' })
  await runAsync('UPDATE topics SET is_locked = ? WHERE id = ?', [is_locked ? 1 : 0, id])
  const updated = await getAsync('SELECT id, name, description, sort_order, COALESCE(is_locked,0) as is_locked FROM topics WHERE id = ?', [id])
  res.json({ topic: updated })
})

app.post('/api/tasks', authMiddleware, requireRole('admin', 'superadmin'), async (req, res) => {
  const { title, description, difficulty, points, topic_id, correct_answer } = req.body;
  if (!title || !description || !['easy','medium','hard'].includes(difficulty)) {
    return res.status(400).json({ error: 'Invalid task payload' });
  }
  const pts = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
  const topicId = (topic_id === null || topic_id === undefined || topic_id === '') ? null : Number(topic_id);
  const result = await runAsync('INSERT INTO tasks (title, description, difficulty, points, topic_id, created_by, correct_answer) VALUES (?,?,?,?,?,?,?)', [title, description, difficulty, pts, topicId, req.user.id, (correct_answer ?? null)]);
  const task = await getAsync('SELECT * FROM tasks WHERE id = ?', [result.lastID]);
  res.status(201).json({ task });
});

app.put('/api/tasks/:id', authMiddleware, requireRole('admin', 'superadmin'), async (req, res) => {
  const { title, description, difficulty, points, topic_id, correct_answer } = req.body;
  const { id } = req.params;
  const task = await getAsync('SELECT * FROM tasks WHERE id = ?', [id]);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const diff = difficulty || task.difficulty;
  if (!['easy','medium','hard'].includes(diff)) return res.status(400).json({ error: 'Invalid difficulty' });
  const pts = (points === undefined || points === null) ? task.points : Math.max(0, Math.floor(Number(points)));
  const topicId = (topic_id === undefined) ? task.topic_id : ((topic_id === null || topic_id === '') ? null : Number(topic_id));
  await runAsync('UPDATE tasks SET title = ?, description = ?, difficulty = ?, points = ?, topic_id = ?, correct_answer = ? WHERE id = ?', [title || task.title, description || task.description, diff, pts, topicId, (correct_answer === undefined ? task.correct_answer : (correct_answer ?? null)), id]);
  const updated = await getAsync('SELECT * FROM tasks WHERE id = ?', [id]);
  res.json({ task: updated });
});

app.delete('/api/tasks/:id', authMiddleware, requireRole('admin', 'superadmin'), async (req, res) => {
  const { id } = req.params;
  await runAsync('DELETE FROM tasks WHERE id = ?', [id]);
  res.json({ ok: true });
});

// SOLUTIONS
app.post('/api/solutions', authMiddleware, requireRole('student', 'admin', 'superadmin'), async (req, res) => {
  const { task_id, code, reason } = req.body;
  if (!task_id || !code) return res.status(400).json({ error: 'task_id and code required' });
  const task = await getAsync('SELECT id FROM tasks WHERE id = ?', [task_id]);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const isAuto = String(reason || '').toLowerCase() === 'auto_fail' ? 1 : 0
  const result = await runAsync('INSERT INTO solutions (task_id, user_id, code, status, is_auto) VALUES (?,?,?,?,?)', [task_id, req.user.id, code, 'pending', isAuto]);
  const sol = await getAsync('SELECT * FROM solutions WHERE id = ?', [result.lastID]);
  res.status(201).json({ solution: sol });
});

app.get('/api/solutions', authMiddleware, requireRole('admin', 'superadmin'), async (req, res) => {
  // legacy endpoint (per-solution). Keep for compatibility
  const rows = await allAsync(`SELECT s.*, u.email as user_email, t.title as task_title, t.points as task_points
    FROM solutions s
    JOIN users u ON u.id = s.user_id
    JOIN tasks t ON t.id = s.task_id
    WHERE COALESCE(s.is_auto,0) = 0 AND s.batch_id IS NULL
    ORDER BY s.created_at DESC`);
  res.json({ solutions: rows });
});

// Admin: list topic submissions (batches)
app.get('/api/topicSubmissions', authMiddleware, requireRole('admin','superadmin'), async (_req, res) => {
  const rows = await allAsync(`
    SELECT b.*, u.email as user_email, tp.name as topic_name,
           (SELECT COUNT(*) FROM solutions s WHERE s.batch_id = b.id) as answers_count,
           (SELECT COUNT(*) FROM solutions s WHERE s.batch_id = b.id AND COALESCE(s.is_auto,0)=1) as auto_fail_count
    FROM topic_submissions b
    JOIN users u ON u.id = b.user_id
    JOIN topics tp ON tp.id = b.topic_id
    ORDER BY b.created_at DESC, b.id DESC
  `)
  res.json({ submissions: rows })
})

// Admin: delete a topic submission and its solutions
app.delete('/api/topicSubmissions/:id', authMiddleware, requireRole('admin','superadmin'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const b = await getAsync('SELECT * FROM topic_submissions WHERE id = ?', [id])
    if (!b) return res.status(404).json({ error: 'Submission not found' })
    // remove solutions first
    await runAsync('DELETE FROM solutions WHERE batch_id = ?', [id])
    // then remove batch
    await runAsync('DELETE FROM topic_submissions WHERE id = ?', [id])
    res.status(204).end()
  } catch (e) {
    console.error('Delete submission failed:', e)
    res.status(500).json({ error: 'Failed to delete submission' })
  }
})

// Admin: moderate batch -> apply to solutions in batch
app.patch('/api/topicSubmissions/:id/status', authMiddleware, requireRole('admin','superadmin'), async (req, res) => {
  const id = Number(req.params.id)
  const { status } = req.body || {}
  if (!['approved','rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' })
  const b = await getAsync('SELECT * FROM topic_submissions WHERE id = ?', [id])
  if (!b) return res.status(404).json({ error: 'Submission not found' })
  await runAsync('UPDATE topic_submissions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id])
  // update solutions
  const sols = await allAsync('SELECT * FROM solutions WHERE batch_id = ?', [id])
  for (const s of sols) {
    let awarded = 0
    let newStatus = status === 'approved' ? 'correct' : 'wrong'
    if (newStatus === 'correct') {
      const t = await getAsync('SELECT points FROM tasks WHERE id = ?', [s.task_id])
      awarded = Math.max(0, Number(t?.points || 0))
    }
    await runAsync("UPDATE solutions SET status = ?, awarded_points = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [newStatus, awarded, s.id])
    await runAsync('INSERT INTO moderation_history (solution_id, moderator_id, action, awarded_points) VALUES (?,?,?,?)', [s.id, req.user.id, newStatus === 'correct' ? 'approved' : 'rejected', awarded])
  }
  res.json({ ok: true })
})

// Batch details: admins can view any, student can view own
app.get('/api/topicSubmissions/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id)
  const b = await getAsync(`
    SELECT b.*, u.email as user_email, tp.name as topic_name
    FROM topic_submissions b
    JOIN users u ON u.id = b.user_id
    JOIN topics tp ON tp.id = b.topic_id
    WHERE b.id = ?
  `, [id])
  if (!b) return res.status(404).json({ error: 'Submission not found' })
  // access control: admin/superadmin or owner
  const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')
  const isOwner = req.user && Number(req.user.id) === Number(b.user_id)
  if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Forbidden' })
  const solutions = await allAsync(`
    SELECT s.*, t.title as task_title, t.points as task_points, t.description as task_description, t.correct_answer as task_correct_answer
    FROM solutions s
    JOIN tasks t ON t.id = s.task_id
    WHERE s.batch_id = ?
    ORDER BY s.id
  `, [id])
  res.json({ submission: b, solutions })
})

// Student: list own topic submissions
app.get('/api/my/topicSubmissions', authMiddleware, async (req, res) => {
  const rows = await allAsync(`
    SELECT b.*, tp.name as topic_name,
           (SELECT COUNT(*) FROM solutions s WHERE s.batch_id = b.id) as answers_count,
           (SELECT COUNT(*) FROM solutions s WHERE s.batch_id = b.id AND COALESCE(s.is_auto,0)=1) as auto_fail_count
    FROM topic_submissions b
    JOIN topics tp ON tp.id = b.topic_id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC, b.id DESC
  `, [req.user.id])
  res.json({ submissions: rows })
})

app.get('/api/solutions/my', authMiddleware, async (req, res) => {
  const rows = await allAsync(`SELECT s.*, t.title as task_title, t.points as task_points FROM solutions s JOIN tasks t ON t.id = s.task_id WHERE s.user_id = ? ORDER BY s.created_at DESC`, [req.user.id]);
  res.json({ solutions: rows });
});

app.patch('/api/solutions/:id/status', authMiddleware, requireRole('admin', 'superadmin'), async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  if (!['pending','correct','wrong'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  // if approving, set awarded_points to task.points; else 0
  const sol0 = await getAsync('SELECT * FROM solutions WHERE id = ?', [id]);
  if (!sol0) return res.status(404).json({ error: 'Solution not found' });
  let awarded = 0;
  if (status === 'correct') {
    const t = await getAsync('SELECT points FROM tasks WHERE id = ?', [sol0.task_id]);
    awarded = Math.max(0, Number(t?.points || 0));
  }
  await runAsync("UPDATE solutions SET status = ?, awarded_points = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [status, awarded, id]);
  const sol = await getAsync('SELECT * FROM solutions WHERE id = ?', [id]);
  // Лог модерации
  const action = status === 'correct' ? 'approved' : 'rejected'
  await runAsync('INSERT INTO moderation_history (solution_id, moderator_id, action, awarded_points) VALUES (?,?,?,?)', [id, req.user.id, action, awarded])

  // Если это часть пакета — возможно обновить статус всего пакета
  if (sol.batch_id) {
    const pending = await getAsync('SELECT COUNT(*) as c FROM solutions WHERE batch_id = ? AND status = ?',[sol.batch_id,'pending'])
    if (Number(pending?.c || 0) === 0) {
      const wrong = await getAsync('SELECT COUNT(*) as c FROM solutions WHERE batch_id = ? AND status = ?',[sol.batch_id,'wrong'])
      const newStatus = Number(wrong?.c || 0) > 0 ? 'rejected' : 'approved'
      await runAsync('UPDATE topic_submissions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, sol.batch_id])
    }
  }
  res.json({ solution: sol });
});

// История модерации: список
app.get('/api/moderation/history', authMiddleware, requireRole('admin', 'superadmin'), async (_req, res) => {
  const rows = await allAsync(`
    SELECT h.*, s.user_id, s.task_id, s.status as solution_status, s.code,
           u.email as user_email, m.email as moderator_email,
           t.title as task_title, t.points as task_points
    FROM moderation_history h
    JOIN solutions s ON s.id = h.solution_id
    JOIN users u ON u.id = s.user_id
    JOIN users m ON m.id = h.moderator_id
    JOIN tasks t ON t.id = s.task_id
    ORDER BY h.created_at DESC, h.id DESC
  `)
  res.json({ history: rows })
})

// История модерации: очистка
app.delete('/api/moderation/history', authMiddleware, requireRole('superadmin'), async (_req, res) => {
  await runAsync('DELETE FROM moderation_history', [])
  res.status(204).end()
})

// Anti-cheat: логирование событий
app.post('/api/cheatingAttempts', authMiddleware, async (req, res) => {
  try {
    const { taskId, eventType, details } = req.body || {}
    if (!eventType) return res.status(400).json({ error: 'eventType required' })
    const det = details ? JSON.stringify(details) : null
    const result = await runAsync('INSERT INTO cheating_attempts (user_id, task_id, event_type, details) VALUES (?,?,?,?)', [req.user.id, taskId || null, String(eventType), det])
    const row = await getAsync('SELECT * FROM cheating_attempts WHERE id = ?', [result.lastID])
    res.status(201).json({ attempt: row })
  } catch (e) {
    console.error('cheatingAttempts log failed:', e)
    res.status(500).json({ error: 'Failed to log event' })
  }
})

// Anti-cheat: просмотр логов (admin/superadmin)
app.get('/api/cheatingAttempts', authMiddleware, requireRole('admin', 'superadmin'), async (req, res) => {
  const rows = await allAsync(`SELECT c.*, u.email as user_email, t.title as task_title FROM cheating_attempts c
    LEFT JOIN users u ON u.id = c.user_id
    LEFT JOIN tasks t ON t.id = c.task_id
    ORDER BY c.created_at DESC, c.id DESC`)
  res.json({ attempts: rows })
})

// Topics CRUD (admin/superadmin)
app.post('/api/topics', authMiddleware, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { name, description, sort_order } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Название обязательно' });
    const order = Number.isFinite(Number(sort_order)) ? Math.floor(Number(sort_order)) : 0;
    const result = await runAsync('INSERT INTO topics (name, description, sort_order) VALUES (?,?,?)', [name.trim(), description || null, order]);
    const topic = await getAsync('SELECT id, name, description, sort_order FROM topics WHERE id = ?', [result.lastID]);
    res.status(201).json({ topic });
  } catch (e) {
    console.error('Create topic failed:', e);
    if (e && e.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: 'Тема с таким названием уже существует' });
    }
    res.status(500).json({ error: 'Не удалось создать тему' });
  }
});

app.put('/api/topics/:id', authMiddleware, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, sort_order } = req.body;
    const tp = await getAsync('SELECT * FROM topics WHERE id = ?', [id]);
    if (!tp) return res.status(404).json({ error: 'Topic not found' });
    const n = (name === undefined || name === null || !String(name).trim()) ? tp.name : String(name).trim();
    const d = (description === undefined) ? tp.description : (description || null);
    const o = (sort_order === undefined || sort_order === null || Number.isNaN(Number(sort_order))) ? (tp.sort_order ?? 0) : Math.floor(Number(sort_order));
    await runAsync('UPDATE topics SET name = ?, description = ?, sort_order = ? WHERE id = ?', [n, d, o, id]);
    const topic = await getAsync('SELECT id, name, description, sort_order FROM topics WHERE id = ?', [id]);
    res.json({ topic });
  } catch (e) {
    console.error('Update topic failed:', e);
    if (e && e.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: 'Конфликт данных темы' });
    }
    res.status(500).json({ error: 'Не удалось обновить тему' });
  }
});

app.delete('/api/topics/:id', authMiddleware, requireRole('admin', 'superadmin'), async (req, res) => {
  const { id } = req.params;
  const tp = await getAsync('SELECT * FROM topics WHERE id = ?', [id]);
  if (!tp) return res.status(404).json({ error: 'Topic not found' });
  // collect tasks of the topic
  const tks = await allAsync('SELECT id FROM tasks WHERE topic_id = ?', [id]);
  const taskIds = tks.map(t => t.id)
  if (taskIds.length) {
    const placeholders = taskIds.map(() => '?').join(',')
    // delete solutions of these tasks
    await runAsync(`DELETE FROM solutions WHERE task_id IN (${placeholders})`, taskIds)
    // delete tasks themselves
    await runAsync(`DELETE FROM tasks WHERE id IN (${placeholders})`, taskIds)
  }
  // finally delete topic
  await runAsync('DELETE FROM topics WHERE id = ?', [id]);
  res.json({ ok: true });
});

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  // Автосидинг отключён по умолчанию. Включайте через AUTO_SEED=true.
  if (String(process.env.AUTO_SEED || '').toLowerCase() === 'true') {
    try {
      await seed({ includeUsers: String(process.env.ALLOW_SAMPLE_USERS || '').toLowerCase() === 'true' });
      console.log('Seeded sample data (AUTO_SEED)');
    } catch (e) { console.error('Seed failed:', e); }
  }
});

// Optionally serve built client in production
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serveClient = String(process.env.SERVE_CLIENT || '').toLowerCase() === 'true';
if (serveClient) {
  const distPath = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving client from', distPath);
  } else {
    console.warn('SERVE_CLIENT is true, but dist/ not found. Build client first with "npm run build" in project root.');
  }
}
