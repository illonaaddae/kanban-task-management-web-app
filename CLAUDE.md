# CLAUDE.md - Full-Stack Kanban (FEM35 / Lab 06)

Guides Claude Code while adding an Express backend to the **existing**
`kanban-task-management-web-app` repo and migrating the frontend off Appwrite.
The frontend stays at the repo root; the new backend lives in **`server/`**.
Do not restructure or break the existing React app - it has working auth flows,
Zustand slices, dnd-kit drag-and-drop, and Vitest tests.

## Writing style (applies to everything)

**Never use em dashes (U+2014) or en dashes (U+2013).** Named by codepoint here on
purpose, because writing the characters out is exactly what this forbids.

They are banned in UI copy, code comments, commit messages, the README, and PR
descriptions. Use a plain hyphen `-`, a comma, a colon, or two sentences instead.
They read as machine-written and are not wanted anywhere in this project.

This includes the typographic "empty cell" placeholder in tables: use `-`.

Check before committing:

```bash
grep -rn $'\u2014\|\u2013' src server/src README.md
```

## What already exists (respect these seams)

- **Frontend:** React 19 + TypeScript + Vite, Zustand slice store
  (`src/store/store.ts` composing `authSlice`/`boardSlice`/`taskSlice`),
  dnd-kit, react-router 7, react-hot-toast. (`src/store/kanbanStore.ts` and
  `src/context/*` are legacy - don't build on them.)
- **Auth seam:** `src/services/authService.ts` is a factory returning an
  `AuthService` implementation (`AppwriteAuthService` | `MockAuthService`)
  chosen by `VITE_USE_APPWRITE`. We add **`ApiAuthService`** implementing the
  same interface and extend the factory (`VITE_AUTH_PROVIDER=api|appwrite|mock`,
  default `api`).
- **Data seam:** all data access goes through `src/services/boardService.ts`
  (wrapping `boardApi.ts`/`taskApi.ts`). Rewrite the internals of those two
  files to call our API; keep function signatures so the store barely changes.
- **Current frontend shapes:** `Board { id, name, columns[] }`,
  `Column { id?, name, tasks[] }`, `Task { id, title, description, status,
  subtasks[{ title, isCompleted }] }` - `status` is the **column name** and
  there is no `position`. The backend must both serve the lab's normalized
  model AND give the frontend a nested board shape (see "Full board endpoint").

## Stack (backend - mirror Lab 4/5 patterns)

**TypeScript** (strict, CommonJS output, `tsx` for dev / `tsc` for build - the
lab's `.js` filenames below are all `.ts`), Node + Express **5**, MongoDB
(Atlas) via Mongoose, **Zod 4** validation with the reusable
`validate(schema, source)` middleware, layered architecture
(routes → controllers → services → repositories), `AppError`/`catchAsync`,
central `errorHandler`, envelopes `{ status: "success", data }` /
`{ status: "error", message, details? }`, Pino logging, env validation at
startup [Lab 2 fix], Jest + Supertest + mongodb-memory-server, `/health`
endpoint. `bcrypt` (cost 12) + `jsonwebtoken` (access 1h + refresh 7d,
rotation - reuse Lab 3 conventions: generic 401 on bad credentials, payload
`{ id, role, tokenVersion }` only, 401 vs 403 precision).

## server/ structure

```
server/
├── src/
│   ├── config/        env.ts, db.ts, logger.ts
│   ├── models/        User.ts, Board.ts, Column.ts, Task.ts, ActivityLog.ts
│   ├── repositories/  userRepository.ts, boardRepository.ts, columnRepository.ts, taskRepository.ts, activityRepository.ts
│   ├── services/      authService.ts, boardService.ts, columnService.ts, taskService.ts, activityService.ts
│   ├── controllers/   (one per route file)
│   ├── routes/        authRoutes.ts, boardRoutes.ts, columnRoutes.ts, taskRoutes.ts, userRoutes.ts, healthRoutes.ts
│   ├── middlewares/   auth.ts, boardAccess.ts, validate.ts, errorHandler.ts, notFound.ts
│   ├── schemas/       (Zod)
│   ├── utils/         AppError.ts, catchAsync.ts, generateTokens.ts
│   ├── seed/seed.ts
│   ├── app.ts         (exports the app; no listen)
│   └── server.ts      (entry: connect, listen, signal handlers)
├── src/tests/         env.setup.ts, globalSetup.ts, globalTeardown.ts, setup.ts, unit/, integration/, fixtures/
├── .env / .env.example
├── jest.config.js     (ts-jest)
├── nodemon.json       (execs tsx src/server.ts)
├── tsconfig.json / tsconfig.build.json
└── package.json       (separate from the frontend package.json)
```

Entry point lives at `src/server.ts` and compiles to `dist/server.js` - so
`npm start` is `node dist/server.js`, not `node server.js`. Everything under
`src/tests/` is excluded from the build via `tsconfig.build.json`.

### Toolchain gotchas already hit (don't re-discover these)

- **Express 5 `req.query` is a getter with no setter** - assigning it throws.
  `validate.ts` writes the parsed query back with `Object.defineProperty`.
- **Express 5 dropped bare `"*"` mount paths** (path-to-regexp upgrade) -
  `notFound` is mounted as `app.use(notFound)` with no path.
- **Zod 4**: errors are `err.issues` with `path: (string|number)[]`; string
  formats moved to top level (`z.url()`, `z.email()`).
- **Empty env vars**: `FOO=` yields `""`, not absent, which fails
  `.min(1).optional()`. `env.ts` strips empty strings before parsing.
- **Port 5000 is unusable on macOS** (Control Center AirPlay Receiver answers
  with a bodyless 403 that reads like a CORS error). Default is **5050**.
- **jest + mongodb-memory-server**: one server per run via `globalSetup`, not
  one per suite - per-suite spawns blow the 10s start timeout. Each worker
  gets its own `dbName`.

## Models

**User** - `name`, `email` (unique, lowercase), `password` (bcrypt, `select:false`,
**not required** when `googleId` present), `role` enum `admin|editor|viewer`
default `editor` (global role; `admin` is platform admin for the existing
Admin page), `themePreference` enum `light|dark` default `light`, `avatar`
(String, optional), `googleId` (sparse unique), `tokenVersion`. Hash in
`pre("save")` only when modified; `comparePassword`; strip password in `toJSON`.

**Board** - `title` (required), `owner` (ref User, indexed),
`collaborators: [{ user: ref User, role: enum editor|viewer }]`. No embedded
columns - columns are their own collection.

**Column** - `title`, `boardId` (ref, indexed), `position` (Number).

**Task** - `title` (required), `description` (default ""), `boardId` (indexed),
`columnId` (ref, indexed), `position` (Number), `status` (String - kept in sync
with the column title so the existing frontend keeps working), `assignedTo`
(ref User, optional), `dueDate` (Date, optional),
`subtasks: [{ title, isCompleted }]`, timestamps.

**ActivityLog** (bonus) - `boardId`, `user` (ref), `action` (String, e.g.
`"task.moved"`), `message` (human string: "Task moved to Done by Illona"),
`meta` (Mixed), timestamps. Written from the service layer; `GET /boards/:id/activity`.

## RBAC (20% of grade - two levels, be precise)

1. **Global role** (User.role): `admin` bypasses board checks (full access);
   `editor`/`viewer` are defaults for board-level resolution.
2. **Board-level access** resolved by `boardAccess(minRole)` middleware, which
   runs after `auth`, loads the board (404 first, then permission [Lab 3
   lesson: existence → 404 before ownership → 403]), and computes the
   effective role: `owner` (board.owner === user) > collaborator entry role >
   none (→ 403).

| Action                                   | viewer | editor | owner | admin |
|------------------------------------------|--------|--------|-------|-------|
| View board/columns/tasks/activity        | ✓      | ✓      | ✓     | ✓     |
| Create/edit/move/delete tasks & columns  | ✗ 403  | ✓      | ✓     | ✓     |
| Rename board, manage collaborators, delete board | ✗ | ✗ 403 | ✓     | ✓     |

Column and task routes resolve the board via the resource's `boardId`, then run
the same access check - a task ID from someone else's board must 403 (not 404-leak).

## API endpoints

Auth: `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` ·
`POST /auth/logout` · `GET /auth/me` · `GET /auth/google` +
`GET /auth/google/callback` (see OAuth section).

Boards: `GET /boards` (own + shared) · `POST /boards` · `GET /boards/:id` ·
`PUT /boards/:id` · `DELETE /boards/:id` (cascade columns/tasks/activity) ·
`GET /boards/:id/full` (nested shape below) · `POST /boards/:id/collaborators`
(`{ email, role }` - invite by email, 404 unknown user, 409 duplicate) ·
`PATCH /boards/:id/collaborators/:userId` · `DELETE /boards/:id/collaborators/:userId` ·
`GET /boards/:id/activity` (paginated [Lab 2 fix: page/limit + metadata]).

Columns: `POST /boards/:id/columns` · `PUT /columns/:id` · `DELETE /columns/:id`
· `PATCH /boards/:id/columns/reorder` (`{ orderedColumnIds: [] }`).

Tasks: `POST /tasks` (`{ boardId, columnId, title, ... }`) · `GET /tasks/:id` ·
`PUT /tasks/:id` (+ accept `PATCH` for partial [Lab 2 fix]) · `DELETE /tasks/:id` ·
**`PATCH /tasks/:id/move`** (`{ columnId, position }`).

Users: `GET /users` (admin only) · `PATCH /users/me` (`name`,
`themePreference`, `avatar`) - theme persistence bonus.

Health: `GET /health` (status/uptime/timestamp, for Render health checks).

### Full board endpoint (the frontend-compat contract)

`GET /boards/:id/full` returns:

```json
{ "status": "success", "data": { "id", "name", "myRole": "owner",
  "collaborators": [{ "user": { "id", "name", "email" }, "role": "editor" }],
  "columns": [{ "id", "name", "position",
    "tasks": [{ "id", "title", "description", "status", "position",
                "assignedTo", "dueDate", "subtasks": [] }] }] } }
```

Built in the service with `Promise.all` (columns + tasks queries), tasks
grouped by `columnId`, both sorted by `position`. `name` mirrors `title` in
JSON output so existing frontend types keep working - do the mapping
server-side in one place, not scattered through the frontend.

### Move semantics (drag-and-drop persistence)

`PATCH /tasks/:id/move { columnId, position }`:

1. Validate target column exists and belongs to the same board.
2. Decrement `position` of tasks after the old slot in the source column.
3. Increment `position` of tasks at/after the new slot in the target column.
4. Set the task's `columnId`, `position`, and `status` = target column title.
5. Use `bulkWrite` for the shifts; log `task.moved` activity.

Reordering within one column is the same endpoint with the same `columnId`.

## Validation (Zod)

Registration: name required, valid email, password min 8. Login: email +
password required. Role fields validated against enums everywhere
(collaborator role, user role, themePreference). Boards/columns/tasks: required
fields, ObjectId params via `idParamSchema`, move payload requires valid
`columnId` + `position` int ≥0, dueDate coerced date, subtasks array shape.
Structured `details: [{ field, message }]` on 400s.

## Testing (Jest + Supertest + mongodb-memory-server - reuse Lab 5 setup)

- Auth: register 201 / duplicate 409 / bad login → generic 401 / me with token.
- Protected routes: no token 401 · viewer mutating 403 · non-collaborator
  reading someone's board 403 · owner-only actions as editor 403.
- CRUD: boards, columns, tasks happy paths + validation 400s (assert `details`).
- Move: create 2 columns + 3 tasks, move across, assert both columns'
  positions are contiguous and `status` updated.
- Full board endpoint shape.
- Helper: `registerAndLogin(app)` returning `{ token, user }` to keep tests DRY.

## Google OAuth on Express (replaces the Appwrite OAuth)

Hand-rolled authorization-code flow - no passport:

- `GET /auth/google` → 302 to `accounts.google.com/o/oauth2/v2/auth` with
  `client_id`, `redirect_uri` (backend callback), `response_type=code`,
  `scope=openid email profile`, `state` (random, stored in a short-lived
  httpOnly cookie, verified on callback - CSRF protection).
- `GET /auth/google/callback` → verify `state`, exchange `code` at
  `oauth2.googleapis.com/token` (server-side fetch with `client_secret`),
  fetch userinfo, then **upsert**: match by `googleId`, else by verified email
  (link), else create (`role: editor`, no password). Issue our own JWTs and
  302 to `${FRONTEND_URL}/login#token=<access>&refresh=<refresh>` (hash
  fragment, not query - keeps tokens out of server logs).
- Frontend `Login.tsx`: on mount, read tokens from `location.hash`, store,
  clear the hash, fetch `/auth/me`. The Google button becomes a plain link to
  `${VITE_API_URL}/auth/google`. Remove/hide the Slack button (out of scope -
  say so in the README).
- Google Cloud Console setup (manual): OAuth client, authorized redirect URIs
  for localhost + Render URL. **This is the first thing to cut if time runs
  short** - everything else must work without it (email/password is the graded
  path).

## Frontend integration (10% - but it's the point of the lab)

- `src/services/api.ts`: fetch wrapper - `VITE_API_URL` base, JSON headers,
  Bearer token from storage, on 401 try one refresh then logout, unwrap the
  `{ status, data }` envelope, throw `Error(message)` from error envelopes.
- `ApiAuthService implements AuthService` (login/register/logout/
  getCurrentUser/updateProfile via the API; `loginWithGoogle` = redirect;
  `loginWithSlack` = throw "not supported"; `handleOAuthCallback` = hash-token
  handling). Factory: `VITE_AUTH_PROVIDER` env (`api` default; keep `mock` for
  Vitest).
- Rewrite `boardApi.ts`/`taskApi.ts` internals to API calls, keeping exported
  signatures; `getBoards` now uses `GET /boards` + `GET /boards/:id/full`.
- Extend `src/types`: `Task` gains `columnId?`, `position?`, `assignedTo?`,
  `dueDate?`; `Column` gains `id`, `position`. Keep all additions optional so
  existing components compile untouched.
- **Drag-and-drop:** find the dnd-kit `onDragEnd` handlers; after the
  optimistic store update, call `taskApi.moveTask(taskId, columnId, position)`;
  on failure, toast + refetch the board (rollback).
- **New UI (keep minimal):** due-date input + assignee select (from board
  collaborators) in Add/Edit task modals; ViewTaskModal shows both; a "Share"
  modal on the board header (invite by email + role, list + remove
  collaborators, owner-only); read-only mode when `myRole === "viewer"`
  (hide add/edit/delete affordances, disable drag).
- **Theme:** on toggle, if authenticated, fire-and-forget
  `PATCH /users/me { themePreference }`; on login apply the server value.
- Existing Vitest suites must stay green (they use the mock service).

## Env & deployment

- `server/.env`: `NODE_ENV, PORT, DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN,
  JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES_IN, FRONTEND_URL, GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, LOG_LEVEL` - Zod-validated at
  startup, `.env.example` committed. Google keys optional in the schema (app
  boots without OAuth).
- **CORS:** `cors({ origin: FRONTEND_URL })` - with Bearer tokens (not
  cookies) no credentials flag is needed; still lock the origin.
- **Backend → Render:** Web Service, root directory `server/`, build
  `npm ci && npm run build`, start `node dist/server.js`, health check path
  `/health`, env vars in dashboard, `DATABASE_URL` → Atlas (reuse the Lab 5
  cluster, new database name `kanban`). Note: free tier spins down when idle -
  first request is slow.
- **Frontend → Vercel:** Vite project at repo root; `VITE_API_URL` +
  `VITE_AUTH_PROVIDER=api` in project settings; SPA rewrite (all routes →
  `index.html`). Then set the Vercel URL as `FRONTEND_URL` on Render (CORS +
  OAuth redirect).
- **Seed:** `server/src/seed/seed.ts` (`npm run seed`): three users - admin,
  editor (demo owner), viewer - passwords from env or printed once; one board
  built from the repo's `data.json` (real demo content) with columns/tasks
  positioned; collaborators wired (editor owns, viewer invited); a few
  activity entries. Idempotent (upsert or wipe-and-recreate the seed data only).

## Deliverables checklist (per brief)

Backend repo structure ✓ (server/) · seed data ✓ · connected frontend
(live fetch, persisted updates, persisted drag-and-drop) ✓ · README with API
docs + setup for both halves + both deployment URLs · Postman collection under
`/postman` covering auth + boards + columns + tasks + move (with `{{BASE_URL}}`,
`{{TOKEN}}` chained from login) · bonus: activity log + theme persistence.

## Definition of done (maps to the rubric)

- [ ] RESTful, layered, modular server; consistent envelopes; precise status codes (401 vs 403 [Lab 3 lesson], 404-before-403, 409 duplicates). (20%)
- [ ] Four collections + ActivityLog; positions persist; cascade deletes; seed script. (20%)
- [ ] bcrypt + JWT (+ refresh rotation); RBAC table enforced at both levels; Google OAuth issuing our JWTs. (20%)
- [ ] Full CRUD boards/columns/tasks/subtasks; move endpoint; collaborators invite/remove; assignment + due dates. (15%)
- [ ] Frontend on the live API: login, boards render, edits persist, drag-and-drop survives refresh, share modal, viewer read-only. (10%)
- [ ] README (API table, setup, URLs, architecture note, OAuth + Slack-removal note), Postman collection, clean commits on feature branches. (10%)
- [ ] Bonus: activity log endpoint + UI-visible theme persistence. (5%)

## Manual test script (before submission)

Register → login → create board with columns → create tasks → drag task to
another column → **hard refresh: order persists** → invite a second account as
viewer → in a second browser, viewer sees the board but every mutation is
blocked (UI hidden AND API 403 via Postman) → promote to editor → editor can
move tasks → owner deletes board → collaborator loses access → theme toggle
survives logout/login → Google sign-in round-trips (if configured) →
`npm test` green in server/ · Vitest green at root · seeded demo works on the
live URLs.
