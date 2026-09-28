# Учебная платформа для задач по Python

Технологии:
- Фронтенд: React + Vite + TailwindCSS
- Бэкенд: Node.js + Express + SQLite
- Авторизация: JWT
- Хэширование паролей: bcrypt
- CORS для запросов с фронтенда

## Структура
```
/project
  /src       # React + Vite + Tailwind
  /server    # Node.js + Express + SQLite
  /database  # database.sqlite
  index.html
  package.json      # фронтенд (Vite) в корне
  vite.config.js
  tailwind.config.js
  postcss.config.js
```

## Быстрый старт (разработка)
1. Установить зависимости и запустить оба сервиса одновременно.

В PowerShell (Windows):
```
npm install; cd server; npm install; cd ..; npm run dev:all
```
В bash (macOS/Linux):
```
npm install
(cd server && npm install)
npm run dev:all
```

По умолчанию:
- Сервер: http://localhost:4000
- Клиент: http://localhost:5173

Если порт 4000 занят:
- Остановите предыдущий node-процесс или измените PORT в `server/.env`.
- Проверка порта в PowerShell:
```
netstat -ano | findstr :4000
tasklist | findstr <PID>
```
Временно запустить сервер на другом порту (например, 5000):
```
# Для текущей сессии PowerShell:
cd server; $env:PORT=5000; node server.js
# Или установить переменную пользователя (потребуется новый сеанс PowerShell):
cd server; setx PORT 5000; node server.js
```

## Роли и тестовые пользователи
- student: student@example.com / Student123!
- admin: admin@example.com / Admin123!
- superadmin: superadmin@example.com / SuperAdmin123!

## Маршруты сервера (кратко)
- POST /api/auth/register — регистрация (email, password)
- POST /api/auth/login — вход (email, password)
- GET  /api/auth/me — профиль текущего пользователя
- GET  /api/users — список пользователей (superadmin)
- PATCH /api/users/:id/role — смена роли (superadmin)
- PATCH /api/users/:id/block — блокировка/разблокировка (superadmin)
- GET  /api/tasks — все задачи
- GET  /api/tasks/:id — одна задача
- POST /api/tasks — создать задачу (admin/superadmin)
- PUT  /api/tasks/:id — обновить задачу (admin/superadmin)
- DELETE /api/tasks/:id — удалить задачу (admin/superadmin)
- POST /api/solutions — отправить решение (авторизованные)
- GET  /api/solutions — все решения (admin/superadmin)
- GET  /api/solutions/my — мои решения (авторизованные)
- PATCH /api/solutions/:id/status — сменить статус (admin/superadmin)

## Переменные окружения (опционально)
В `server/.env` можно настроить:
```
JWT_SECRET=supersecret_jwt_key
PORT=4000
DB_PATH=../database/database.sqlite
CORS_ORIGIN=http://localhost:5173
# Раздавать собранный клиент сервером (после npm run build в корне)
SERVE_CLIENT=false
```
Если `.env` нет, работают значения по умолчанию.

В корне можно задать `VITE_API_BASE` для клиента (по умолчанию `/api`):
```
VITE_API_BASE=/api
```

## Продакшен-сборка
1. Собрать клиент:
```
npm run build
```
2. Запустить сервер (опционально включить раздачу клиентской сборки):
```
cd server
npm install --production
# в server/.env:
# SERVE_CLIENT=true
node server.js
```
Сервер будет отдавать содержимое папки `dist` (SPA fallback включён).

Альтернативно из корня:
```
npm run start:prod
```
