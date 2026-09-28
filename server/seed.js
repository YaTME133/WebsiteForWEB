import { db, initDb } from './db.js';
import bcrypt from 'bcrypt';

// Seed с опциями: по умолчанию пользователей НЕ создаём
// includeUsers можно передать явно или через env ALLOW_SAMPLE_USERS=true
export async function seed(options = {}) {
  const includeUsers = options.includeUsers ?? (String(process.env.ALLOW_SAMPLE_USERS || '').toLowerCase() === 'true')
  await initDb();
  const users = includeUsers ? [
    { email: 'student@example.com', password: 'Student123!', role: 'student' },
    { email: 'admin@example.com', password: 'Admin123!', role: 'admin' },
    { email: 'superadmin@example.com', password: 'SuperAdmin123!', role: 'superadmin' }
  ] : [];

  await new Promise((resolve, reject) => {
    db.serialize(async () => {
      const RESET = String(process.env.RESET_DB || '').toLowerCase() === 'true'
      if (RESET) {
        db.run('DELETE FROM users');
        db.run('DELETE FROM tasks');
        db.run('DELETE FROM solutions');
      }

      // Пользовательские аккаунты создаём только если разрешено
      if (users.length) {
        for (const u of users) {
          const hash = await bcrypt.hash(u.password, 10);
          await runAsync(
            'INSERT OR IGNORE INTO users (email, password_hash, role) VALUES (?,?,?)',
            [u.email, hash, u.role]
          );
        }
      }

      const sampleTasks = [
        { title: 'Сумма двух чисел', description: 'Вводятся два целых числа a и b через пробел. Выведите их сумму.', difficulty: 'easy', points: 5 },
        { title: 'Факториал', description: 'Дано целое n (n ≥ 0). Выведите n! (факториал n).', difficulty: 'medium', points: 10 },
        { title: 'Чётность числа', description: 'Дано целое n. Выведите "YES" если n чётное, иначе "NO".', difficulty: 'easy' },
        { title: 'Минимум из трёх', description: 'Даны три числа. Выведите минимальное из них.', difficulty: 'easy', points: 5 },
        { title: 'Сумма 1..n', description: 'Дано n. Посчитайте сумму чисел от 1 до n включительно.', difficulty: 'easy' },
        { title: 'Количество цифр', description: 'Дано целое n. Выведите количество цифр в его десятичной записи.', difficulty: 'easy' },
        { title: 'Разворот строки', description: 'Дана строка s. Выведите её в обратном порядке.', difficulty: 'easy' },
        { title: 'Палиндром', description: 'Дана строка s. Выведите "YES" если s — палиндром (без учёта регистра и пробелов), иначе "NO".', difficulty: 'medium', points: 10 },
        { title: 'Подсчёт слов', description: 'Дана строка s. Выведите количество слов (слова разделены пробелами).', difficulty: 'easy' },
        { title: 'Сумма элементов списка', description: 'Дан список целых чисел. Выведите сумму его элементов.', difficulty: 'easy', points: 5 },
        { title: 'Уникальные элементы', description: 'Дан список чисел. Выведите количество уникальных значений.', difficulty: 'medium', points: 10 },
        { title: 'Частоты символов', description: 'Дана строка s. Постройте словарь частот символов и выведите частоту для каждого символа в лексикографическом порядке.', difficulty: 'medium', points: 10 },
        { title: 'Фибоначчи', description: 'Дано n. Выведите n-е число Фибоначчи (F0=0, F1=1).', difficulty: 'medium', points: 10 },
        { title: 'Простое ли число', description: 'Дано n>1. Выведите "YES" если n — простое, иначе "NO".', difficulty: 'medium', points: 10 },
        { title: 'Сортировка', description: 'Дан список чисел. Выведите его в неубывающем порядке (без использования встроенного sort).', difficulty: 'medium', points: 12 },
        { title: 'Сумма матрицы', description: 'Дана прямоугольная матрица чисел. Выведите сумму всех её элементов.', difficulty: 'medium' },
        { title: 'Диагональная сумма', description: 'Дана квадратная матрица. Выведите сумму главной диагонали.', difficulty: 'easy', points: 5 },
        { title: 'Сжатие строки RLE', description: 'Дана строка s. Выполните простое RLE-сжатие (например, aaabb → a3b2).', difficulty: 'hard', points: 20 },
        { title: 'Бинарный поиск', description: 'Дан отсортированный список и число x. Определите, есть ли x в списке (бинарный поиск).', difficulty: 'hard', points: 20 },
        { title: 'Баланс скобок', description: 'Дана строка из символов ()[]{}. Проверьте корректность скобочной последовательности.', difficulty: 'hard', points: 20 }
      ];

      for (const t of sampleTasks) {
        const pts = Number.isFinite(t.points) ? t.points : (t.difficulty === 'easy' ? 5 : t.difficulty === 'medium' ? 10 : 20)
        // Вставляем задачу, если ещё нет задачи с таким title
        await runAsync(
          'INSERT INTO tasks (title, description, difficulty, points) SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE title = ?)',
          [t.title, t.description, t.difficulty, pts, t.title]
        );
      }

      // Темы
      const topics = [
        { name: 'База Питона', description: 'Основы синтаксиса, переменные, ввод/вывод', sort: 1 },
        { name: 'Строки и списки', description: 'Строковые операции, списки и базовые алгоритмы', sort: 2 },
        { name: 'Алгоритмы', description: 'Классические алгоритмы и структуры данных', sort: 3 },
        { name: 'Матрицы и числа', description: 'Задачи на матрицы и числовые вычисления', sort: 4 }
      ]
      for (const tp of topics) {
        await runAsync(
          'INSERT OR IGNORE INTO topics (name, description, sort_order) VALUES (?,?,?)',
          [tp.name, tp.description, tp.sort]
        )
      }

      async function topicIdByName(name) {
        return new Promise((resolve) => {
          db.get('SELECT id FROM topics WHERE name = ?', [name], (err, row) => resolve(row?.id || null))
        })
      }

      // Разносим существующие задачи по темам (по title)
      const mapping = [
        { topic: 'База Питона', titles: ['Сумма двух чисел','Чётность числа','Минимум из трёх','Сумма 1..n','Количество цифр'] },
        { topic: 'Строки и списки', titles: ['Разворот строки','Палиндром','Подсчёт слов','Уникальные элементы','Частоты символов'] },
        { topic: 'Алгоритмы', titles: ['Факториал','Сортировка','Сжатие строки RLE','Бинарный поиск','Баланс скобок'] },
        { topic: 'Матрицы и числа', titles: ['Фибоначчи','Простое ли число','Сумма матрицы','Диагональная сумма'] }
      ]
      for (const group of mapping) {
        const tid = await topicIdByName(group.topic)
        if (!tid) continue
        for (const title of group.titles) {
          await runAsync('UPDATE tasks SET topic_id = ? WHERE title = ? AND (topic_id IS NULL OR topic_id = 0)', [tid, title])
        }
      }

      resolve();
    });
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
