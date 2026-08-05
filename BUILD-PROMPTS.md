# Lab 06 — Claude Code Build Prompts (Full-Stack Kanban)

Run in the `kanban-task-management-web-app` repo with this lab's `CLAUDE.md`
at the repo root. One feature branch per prompt (same PR workflow as Lab 5 —
it's graded under Code Quality). Backend prompts (1–8) don't touch the
frontend; frontend prompts (9–11) don't touch the backend. Prompt 12 (OAuth)
is the designated cut if the deadline bites.

---

## Prompt 0 — Orient (read-only)

```
Read CLAUDE.md, then audit the frontend: confirm the auth factory seam
(src/services/authService.ts), the boardService/boardApi/taskApi data seam,
which store the components actually use (store.ts slices vs legacy
kanbanStore), where the dnd-kit onDragEnd handlers live and how drops are
persisted today, and what Login.tsx does with OAuth params. List every file
that imports appwrite. Summarize the integration plan and flag risks. No code.
```

---

## Prompt 1 — Backend scaffold (branch: feat/server-scaffold)

```
Create server/ per CLAUDE.md with its own package.json (type commonjs is fine):
express, mongoose, zod, bcrypt, jsonwebtoken, cors, pino, pino-http, dotenv
(dev: nodemon, jest, supertest, mongodb-memory-server, pino-pretty).

Port the Lab 4/5 foundations: config/env.js (Zod-validated, Google keys
optional), config/db.js, config/logger.js, utils/AppError + catchAsync,
middlewares/validate.js (source-aware, details array), errorHandler + notFound
(req.originalUrl), app.js exporting the app (cors locked to FRONTEND_URL,
express.json, pino-http, /health route), server.js with process handlers +
graceful shutdown. .env/.env.example, scripts: dev, start, test, seed.
Boots clean with npm run dev.
```

---

## Prompt 2 — Models & repositories (branch: feat/models)

```
Create the five models exactly per CLAUDE.md's Models section (User with
pre-save bcrypt hash cost 12 only-when-modified, comparePassword, toJSON strip,
password not required when googleId set; Board with collaborators subdocs;
Column; Task with position/columnId/status/assignedTo/dueDate/subtasks;
ActivityLog). Indexes: Board.owner, Column.boardId, Task.boardId, Task.columnId,
User.googleId sparse unique.

Create one repository per model — the only Mongoose-touching layer. Include:
boardRepository.findForUser(userId) (owner OR collaborator),
taskRepository.bulkShiftPositions(columnId, fromPos, delta),
columnRepository.maxPosition(boardId), cascade helpers
(deleteByBoardId on columns/tasks/activity).
```

---

## Prompt 3 — Auth (branch: feat/auth)

```
utils/generateTokens.js (access 1h + refresh 7d, payload { id, role,
tokenVersion } only). schemas: register (name required, email format, password
min 8), login. services/authService.js + controllers + routes/authRoutes.js:

POST /auth/register — 409 duplicate email, returns user + tokens.
POST /auth/login — generic 401 "Invalid credentials" on ANY failure.
POST /auth/refresh — verify + tokenVersion check + rotate.
POST /auth/logout — bump tokenVersion.
GET /auth/me — current user (auth required).
PATCH /users/me — name, themePreference (enum-validated), avatar. (userRoutes)
GET /users — admin only.

middlewares/auth.js: Bearer token → verify → load user → tokenVersion match →
req.user; distinct 401 messages for missing/invalid/expired; never 500 on a
garbled token. Precise 401-vs-403 semantics throughout.
```

---

## Prompt 4 — Board access middleware + board CRUD (branch: feat/boards)

```
middlewares/boardAccess.js: factory boardAccess(minRole) — after auth, resolve
the board from req.params.id (or a loaded resource's boardId), 404 if absent
FIRST, then effective role: global admin → allow; owner; collaborator entry;
else 403. Roles ordered viewer < editor < owner. Attach req.board + req.myRole.

Boards feature: schemas, repository already exists, service + controller +
routes per CLAUDE.md: GET /boards (own + shared, with myRole per board),
POST (creator becomes owner), GET/:id (viewer+), PUT/:id (owner),
DELETE/:id (owner, cascades columns/tasks/activity),
POST /:id/collaborators { email, role } (owner; 404 unknown email — message
must not leak whether the email exists beyond the invite context, 409 already
added, can't invite the owner), PATCH + DELETE /:id/collaborators/:userId
(owner). Log activity: board.created, collaborator.added/removed.
Integration-test the RBAC matrix as you go.
```

---

## Prompt 5 — Columns + full board endpoint (branch: feat/columns)

```
POST /boards/:id/columns (editor+, position = maxPosition+1),
PUT /columns/:id rename (editor+ — resolve board via column.boardId, same
boardAccess check; renaming a column must also update status on its tasks),
DELETE /columns/:id (editor+; delete its tasks; re-compact positions),
PATCH /boards/:id/columns/reorder { orderedColumnIds } (editor+, validate the
set matches exactly, bulkWrite positions).

GET /boards/:id/full (viewer+): Promise.all(columns, tasks), group tasks by
columnId, sort both by position, emit the exact nested shape from CLAUDE.md
(name mirrors title, myRole, collaborators populated with id/name/email).
```

---

## Prompt 6 — Tasks + move (branch: feat/tasks)

```
Task schemas (create requires boardId, columnId, title; subtasks array of
{ title, isCompleted }; dueDate coerced date; assignedTo must be the owner or
a collaborator of that board — validate in the service).

POST /tasks (editor+ on the target board, position = end of column, status =
column title), GET /tasks/:id (viewer+), PUT + PATCH /tasks/:id (editor+;
partial updates; subtask toggling comes through here), DELETE /tasks/:id
(editor+, re-compact source column positions).

PATCH /tasks/:id/move { columnId, position } (editor+): implement exactly the
5-step semantics in CLAUDE.md with bulkWrite; same-column reorder works via
the same code path. Activity: task.created, task.updated, task.moved ("Task
moved to <column> by <name>"), task.deleted, task.assigned.

GET /boards/:id/activity (viewer+, page/limit with pagination metadata).
```

---

## Prompt 7 — Backend tests (branch: feat/server-tests)

```
Port the Lab 5 test setup (mongodb-memory-server, jest.config with 80%
threshold on services+middlewares, --runInBand --forceExit scripts). Helper
registerAndLogin(app, overrides) → { token, user }.

Integration suites: auth (register/duplicate 409/login generic 401/me/refresh
rotation/logout invalidation) · RBAC matrix (viewer 403 on every mutation,
editor 403 on owner-only, non-collaborator 403 on read, admin bypass) · board
CRUD + collaborators (invite/duplicate/remove) · columns (rename syncs task
status, reorder) · tasks (CRUD, validation 400s with details, move across
columns asserting contiguous positions in BOTH columns and status update,
same-column reorder) · full-board shape · activity pagination · /health.
Unit tests: token utils, boardAccess role resolution (mock repos).
All green; coverage ≥80%.
```

---

## Prompt 8 — Seed + Postman + API docs (branch: feat/seed-docs)

```
server/seed/seed.js per CLAUDE.md: three users (admin/editor/viewer, password
from SEED_PASSWORD env or a printed default), demo board owned by the editor
built from the root data.json (columns + tasks with positions, a few subtasks,
one due date, one assignment), viewer added as collaborator, sample activity.
Idempotent. npm run seed.

Create /postman/kanban-api.postman_collection.json: login saves {{TOKEN}} via
pm.environment.set; folders for auth/boards/columns/tasks; includes the move
request and a viewer-403 demonstration; {{BASE_URL}} everywhere; plus dev +
prod environment files.

README: add a "Backend" section — architecture (layers + why), full endpoint
table with roles required, RBAC table, setup for server/ (env, seed, test),
and placeholders for the two deployment URLs.
```

---

## Prompt 9 — Frontend API client + auth swap (branch: feat/fe-api-auth)

```
Frontend only. Create src/services/api.ts (fetch wrapper per CLAUDE.md:
VITE_API_URL base, Bearer from localStorage, envelope unwrap, single refresh
retry on 401 then logout, typed errors with the server's message).

Create src/services/apiAuth.ts — ApiAuthService implements AuthService:
login/register/logout/getCurrentUser/updateProfile against the API (store
access+refresh tokens); loginWithGoogle → window.location =
`${VITE_API_URL}/auth/google`; loginWithSlack → throw "Slack sign-in is not
supported"; handleOAuthCallback → read tokens from location.hash, store,
clear hash, return /auth/me user.

authService.ts factory: VITE_AUTH_PROVIDER = api (default) | appwrite | mock;
keep mock for Vitest (setupTests forces mock). Hide the Slack button in
OAuthButtons.tsx. Update .env.example at root (VITE_API_URL,
VITE_AUTH_PROVIDER). Register/login/logout must work against the local server;
existing Vitest suites stay green.
```

---

## Prompt 10 — Frontend data swap + drag-and-drop persistence (branch: feat/fe-data)

```
Frontend only. Extend src/types minimally (optional columnId/position/
assignedTo/dueDate on Task; id/position on Column). Rewrite boardApi.ts and
taskApi.ts internals to the API keeping exported signatures: getBoards →
GET /boards then GET /boards/:id/full per board (or lazily in
setCurrentBoard — match the current slice flow); createBoard → POST /boards
then POST columns; updateBoard diffs columns (create/rename/delete/reorder via
the column endpoints); create/update/deleteTask → task endpoints. Add
taskApi.moveTask(taskId, columnId, position). Remove localStorage fallbacks —
surface real errors via the store's error state + toasts.

Wire onDragEnd: keep the optimistic store update, then await moveTask (or
columns/reorder for column drags); on failure toast + refetch the board.
Boards must survive a hard refresh with correct order. Delete
src/lib/appwrite.ts usage from these files (appwriteAuth.ts may remain behind
the factory flag). Vitest green.
```

---

## Prompt 11 — Collaboration & task-feature UI (branch: feat/fe-collab)

```
Frontend only, keep the existing design system (ui/ components, module CSS):

1. Share modal (board header, owner only): invite by email + role select,
   list collaborators with role badges, change role, remove. Toasts on errors.
2. Add/Edit task modals: due date input + assignee select (owner +
   collaborators of the current board). ViewTaskModal displays both.
3. Viewer read-only mode from myRole on the full-board payload: hide
   add/edit/delete/share affordances, disable dnd-kit dragging
   (DndContext sensors or a disabled flag), keep task viewing + subtask
   checkboxes visible but non-toggleable.
4. Theme: on toggle while authenticated, fire-and-forget PATCH /users/me
   { themePreference }; on login, apply the server's themePreference.
5. Activity drawer/panel on the board (bonus): GET /boards/:id/activity,
   paginated list of messages with timestamps.
```

---

## Prompt 12 — Google OAuth on Express (branch: feat/google-oauth) — CUT IF SHORT ON TIME

```
Implement CLAUDE.md's OAuth section: GET /auth/google (302 with state in a
short-lived httpOnly cookie) and GET /auth/google/callback (verify state,
exchange code via server-side fetch, userinfo, upsert by googleId → verified
email → create with role editor and no password, issue our JWTs, 302 to
FRONTEND_URL/login#token=...&refresh=...). Env keys already optional in the
schema — the server must boot and all tests pass with them unset (routes
return 503 "OAuth not configured" in that case).

Then walk me through Google Cloud Console: OAuth consent screen + client,
authorized redirect URIs for http://localhost:<port>/auth/google/callback and
the Render URL. I'll paste the client id/secret into .env. Integration-test
the state-mismatch 403 and the unconfigured 503 (mock the Google fetches).
```

---

## Prompt 13 — Deploy + final audit (branch: feat/deploy)

```
1. Render: guide me through creating the Web Service (root dir server/, build
   npm ci, start node server.js, health check /health), setting env vars
   (DATABASE_URL → the Atlas cluster with a new "kanban" database, JWT
   secrets, FRONTEND_URL placeholder, LOG_LEVEL=info). Run the seed against
   Atlas once. Curl /health and the auth flow on the live URL.
2. Vercel: frontend project at repo root, SPA rewrite to index.html,
   VITE_API_URL = Render URL, VITE_AUTH_PROVIDER=api. Then set FRONTEND_URL on
   Render to the Vercel URL (CORS) and update the Google redirect URI if OAuth
   shipped.
3. Update README with both live URLs + the Vercel/Render notes (free-tier
   spin-down caveat) and the Slack-OAuth-removed note.
4. Final audit against CLAUDE.md's Definition of done: pass/fail per rubric
   line with proof. Run the manual test script from CLAUDE.md top to bottom
   against the LIVE deployment (I'll do the two-browser viewer test with you).
   Report gaps — don't fix yet.
```
