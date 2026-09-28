# Copilot Instructions for this repo

This guide gives AI coding agents the minimum, project-specific context to be effective here. Keep answers focused, practical, and consistent with existing patterns.

## Architecture snapshot
- Frontend (root): React + Vite + TailwindCSS
  - Dev server: Vite at 5173 with proxy to backend for `/api` (see `vite.config.js`).
  - Entry: `index.html` -> `src/main.jsx` -> `src/App.jsx`.
  - UI components in `src/components`, pages in `src/pages`.
  - Styling via Tailwind (`tailwind.config.js`, `postcss.config.js`) and utility classes in `src/index.css`.
- Backend (`/server`): Node.js + Express + SQLite
  - Entry: `server/server.js`; DB: `server/db.js`; auth/JWT: `server/auth.js`;
  - SQLite file at `database/database.sqlite` (configurable via `DB_PATH`).
  - API base path is `/api`.

## Dev workflows
- Install deps and run both client and server:
  - Windows PowerShell:
    - `npm install; cd server; npm install; cd ..; npm run dev:all`
  - Bash:
    - `npm install && (cd server && npm install) && npm run dev:all`
- Frontend-only: `npm run dev` or `npm run dev:client`
- Backend-only: `npm run dev:server` (runs `npm --prefix server run dev`)
- Build frontend: `npm run build` -> output in `dist/`
- Production serve (optional): set `SERVE_CLIENT=true` in `server/.env` and run `node server/server.js`, or from root `npm run start:prod`.

## Routing and UI conventions (frontend)
- React Router used in `src/App.jsx`:
  - Routes: `/` (Home), `/tasks` (Tasks), `/progress` (My Progress), `/task/:id`, `/login`, `/register`, `/admin`, `/superadmin`.
  - Guarded routes via `<Protected roles={...}>` using `useAuth()` from `src/auth.jsx`.
- Layout & header: `src/components/Header.jsx` with centered nav and profile dropdown (`DropdownMenu.jsx`).
  - Brand: "YaTME133" left, nav center, profile right; active links use `border-b-2 border-violet-400`.
- Visual style:
  - Dark theme background `#0f0f13` (also `bg-zinc-900`), white text, violet accents (`text-violet-400 hover:text-violet-300`).
  - Rounded `rounded-2xl`, shadows `shadow-lg`, transitions `transition-colors duration-300`.
  - Shared utilities in `src/index.css`: `.btn`, `.input`, `.card`, `.link`.
  - Inter font loaded in `index.html`.

## Auth and API usage
- Auth context: `src/auth.jsx` manages `token` and `user` in localStorage. Methods: `login`, `register`, `logout`.
- API helper: `src/lib/api.js`.
  - Base URL: `import.meta.env.VITE_API_BASE` or `/api` (Vite proxy) or fallback to `http://localhost:4000/api` when `file:` protocol.
  - Use `api.get/post/patch/put/delete(path, [body], [token])` and pass `Authorization: Bearer <token>` when needed.

## Backend API shape (for reference)
- Auth: POST `/api/auth/register`, POST `/api/auth/login`, GET `/api/auth/me`.
- Tasks: GET `/api/tasks`, GET `/api/tasks/:id`, POST/PUT/DELETE (admin/superadmin).
- Solutions: POST `/api/solutions` (authorized), GET `/api/solutions` (admin/superadmin), GET `/api/solutions/my`, PATCH `/api/solutions/:id/status`.
- Roles: `student`, `admin`, `superadmin`; blocking via `is_blocked`.

## Env & ports
- Frontend: optional `.env` with `VITE_API_BASE`.
- Server `.env` (see `server/.env.example`): `PORT`, `JWT_SECRET`, `DB_PATH`, `CORS_ORIGIN`, `SERVE_CLIENT`.
- Defaults: client 5173, server 4000. If 4000 is busy, adjust `PORT` or kill the PID.

## Patterns to follow
- Use Tailwind utility classes; match existing accent colors and rounded/shadow styles.
- Keep routes and auth guard consistent with `src/App.jsx` and `src/auth.jsx`.
- For new API calls, use `src/lib/api.js`; avoid duplicating fetch logic.
- Reuse components (`Header`, `ProgressBar`) and class patterns from current files.

## Gotchas
- Tailwind directives in `src/index.css` are processed by PostCSS during build; VS Code may show false warnings for `@tailwind`/`@apply`.
- DB path handling uses `server/db.js` with `DB_PATH` env; avoid hardcoding absolute paths.
- CORS is permissive in dev; for prod set `CORS_ORIGIN` properly.
