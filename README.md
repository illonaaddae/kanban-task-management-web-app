# Kanban Task Management Web App

A full-featured, production-ready task management application built with **React 19**, **TypeScript**, and **appwrite** for the AmaliTech Module Lab. This project demonstrates scalable state management, secure authentication, and responsive design patterns.

![Kanban App Screenshot](./preview.jpg)

## Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Technology Stack](#technology-stack)
4. [Getting Started](#getting-started)
5. [Architecture](#architecture)
6. [Testing](#testing)
7. [Backend](#backend)
8. [Deployment](#deployment)
9. [License](#license)

---

## Overview

This application serves as a modern productivity tool allowing teams and individuals to organize tasks across customized boards. It moves beyond basic CRUD operations to offer a drag-and-drop interface, real-time updates, and a global state management system powered by **Zustand**.

### Live Demo
[View Live Application](#) <!-- Replace with actual deployment link -->

---

## Key Features

### Core Functionality
- **Multi-Board Management**: Create, edit, and delete boards to organize different projects.
- **Task Operations**: Full CRUD capabilities for tasks with subtasks support.
- **Drag & Drop**: Intuitive drag-and-drop interface for moving tasks between columns (ToDo / Doing / Done).
- **Subtask Tracking**: Monitor progress within individual tasks.

### User Experience
- **Responsive Interface**: Optimized layout for Mobile, Tablet, and Desktop devices.
- **Theme Support**: Integrated Dark and Light modes with local persistence.
- **Form Validation**: robust input validation and error handling.
- **Interactive Feedback**: Real-time toast notifications for user actions.

### Security & State
- **Authentication**: Secure login and registration powered by Appwrite.
- **Route Protection**: Guarded routes ensuring restricted access to private boards.
- **State Persistence**: Automatic saving of user preferences and session data.

---

## Technology Stack

### Frontend Core
- **React 19**
- **TypeScript 5**
- **Vite** (Build Tool)

### State Management & Routing
- **Zustand** (Global Store)
- **React Router 7**
- **Context API** (Theme/Auth)

### UI & UX
- **CSS Modules** (Scoped Styling)
- **@dnd-kit** (Drag and Drop primitives)
- **react-hot-toast** (Notifications)
- **React Hook Form** (Form Handling)

### Backend & Services
- **Express 5 + MongoDB (Mongoose)** — the API in `server/`, see [Backend](#backend)
- **Zod 4** (request validation), **bcrypt + JWT** (auth), **Pino** (logging)
- **Appwrite** — the original backend, being migrated away from

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Appwrite instance (local or cloud)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/kanban-task-management-web-app.git
   cd kanban-task-management-web-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env` file in the root directory:
   ```env
   VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
   VITE_APPWRITE_PROJECT_ID=your_project_id
   VITE_APPWRITE_DATABASE_ID=your_database_id
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

---

## Architecture

The project follows a modular architecture designed for scalability:

```
src/
├── components/       # Reusable UI components (Modals, Inputs, Cards)
├── context/          # React Contexts (Theme, Auth wrappers)
├── hooks/            # Custom hooks (useBoardDnd, useAuth)
├── pages/            # Page-level components (Dashboard, BoardView)
├── services/         # API integration layer (Appwrite, Mock)
├── store/            # Zustand store slices (Auth, Board, Task)
├── styles/           # Global styles and variables
└── types/            # TypeScript interface definitions
```

---

## Testing

The application has a foundational test suite built with **Vitest** and **React Testing Library**, covering components, global state, mocked API calls, and user interactions.

### Commands

```bash
# Run all tests once
npm test

# Run in watch mode (re-runs on file changes)
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Test Structure

Tests are co-located with their source files in `__tests__` subdirectories:

```
src/
├── components/
│   ├── board/__tests__/
│   │   ├── TaskCard.test.tsx     # Renders title, subtask count, modal on click
│   │   └── Column.test.tsx       # Renders name, task count, empty state
│   ├── modals/__tests__/
│   │   └── AddBoardModal.test.tsx # Form input, submit, validation
│   └── __tests__/
│       └── ProtectedRoute.test.tsx # Auth redirect, authenticated access
├── context/__tests__/
│   └── ThemeContext.test.tsx     # Theme toggle, persistence, document class
├── pages/__tests__/
│   ├── Dashboard.test.tsx        # Loading/error/empty/data states
│   ├── Login.test.tsx            # Form rendering, input values
│   └── NotFound.test.tsx         # 404 page rendering
├── services/__tests__/
│   └── boardApi.test.ts          # Mocked Appwrite CRUD + error paths + localStorage fallback
└── store/__tests__/
    └── boardSlice.test.ts        # fetchBoards, createBoard, deleteBoard state transitions
```

### What Is Tested

| Area | Test File(s) | Key Assertions |
|---|---|---|
| **Environment** | `vitest.config.ts`, `setupTests.ts` | jsdom, globals, jest-dom matchers |
| **Components** | `TaskCard`, `Column`, `Dashboard` | Props → DOM, loading/error/empty states |
| **State** | `boardSlice.test.ts` | Loading flags, data population, error handling |
| **API (Mocked)** | `boardApi.test.ts` | vi.mock on Appwrite, success + error + fallback |
| **User Interactions** | `AddBoardModal`, `ProtectedRoute` | userEvent / fireEvent, form submission, redirects |

### Configuration

- **Framework:** Vitest v2 with jsdom environment
- **Config file:** `vitest.config.ts`
- **Setup file:** `src/setupTests.ts` (registers `@testing-library/jest-dom` matchers)
- **Coverage provider:** v8 with text + HTML reporters
- **Coverage report:** `coverage/index.html` after running `npm run test:coverage`

### Adding New Tests

1. Create a `__tests__/` folder next to the file you want to test
2. Name the file `ComponentName.test.tsx` (or `.test.ts` for non-React)
3. Mock any external dependencies with `vi.mock()`
4. Use `useStore.setState(...)` to set up Zustand state for component tests

---

## Backend

The `server/` directory holds a standalone Express + MongoDB API with its own
`package.json`, tests and deployment. The React app at the repo root talks to it
over HTTP with Bearer tokens.

### Architecture

```
server/src/
├── config/        env.ts (Zod-validated), db.ts, logger.ts
├── models/        User, Board, Column, Task, ActivityLog (Mongoose schemas)
├── repositories/  the only layer that touches Mongoose
├── services/      business rules, cascades, position maths, activity logging
├── controllers/   HTTP in, HTTP out — no logic
├── routes/        wiring + which middleware guards what
├── middlewares/   auth, boardAccess, loadColumn/loadTask, validate, errorHandler, notFound
├── schemas/       Zod request schemas
├── utils/         AppError, catchAsync, generateTokens
├── seed/          seed.ts
├── app.ts         exports the app (no listen) — this is what Supertest imports
└── server.ts      entry: connect, listen, signal handlers
```

**Why the layers.** Each one has exactly one reason to change:

- **Repositories are the only place Mongoose appears.** Swapping the query for
  an aggregation, or adding an index hint, touches one file and no tests above
  it. It is enforced, not aspirational — no `Model.find`/`create`/`updateMany`
  call exists outside `repositories/`.
- **Services hold the rules** — the move algorithm, cascade deletes,
  "an assignee must be a board member", activity entries. They take and return
  documents, so they are unit-testable without HTTP.
- **Controllers only translate.** Read the request, call one service, pick the
  status code. Nothing branches on business state, which is why they stay ~10
  lines each.
- **`app.ts` never calls `listen`.** Supertest imports the app directly, so the
  integration suite runs without binding a port.
- **Errors travel as exceptions.** Services throw `AppError`; `catchAsync`
  forwards rejections; one central `errorHandler` maps everything —
  `AppError`, `ZodError`, `CastError`, duplicate-key 11000, JWT errors,
  malformed JSON — to the response envelope. Controllers contain no `try`.

**Response envelopes.** Success is `{ "status": "success", "data": … }`; failure
is `{ "status": "error", "message": …, "details"?: [{ field, message }] }`.
Validation failures always carry `details`.

### Authentication

bcrypt (cost 12) + JWT: a 1h access token and a 7d refresh token, signed with
**separate secrets** so an access token cannot be replayed as a refresh token.
The payload is only `{ id, role, tokenVersion }` — no email, no name.

`tokenVersion` is what makes logout real: logging out increments it, and every
already-issued token for that user is refused on its next use even though the
signature and expiry are still valid. `POST /auth/refresh` verifies the refresh
token, re-checks `tokenVersion`, and issues a fresh pair.

Login answers **the same generic 401 ("Invalid credentials")** for an unknown
email, a wrong password, and a Google-only account — and runs a dummy bcrypt
compare on the unknown-email path so a missing account takes the same time as a
wrong password.

### RBAC

Two independent levels:

1. **Global role** (`User.role`) — `admin` bypasses board checks entirely;
   `editor`/`viewer` are the defaults for new accounts.
2. **Board-level role**, resolved per request by `boardAccess(minRole)`:
   `owner` (board.owner) > collaborator entry role > none. Ranked
   `viewer < editor < owner`.

| Action | viewer | editor | owner | admin |
|---|---|---|---|---|
| View board, columns, tasks, activity | ✓ | ✓ | ✓ | ✓ |
| Create / edit / move / delete tasks and columns | ✗ 403 | ✓ | ✓ | ✓ |
| Rename board, manage collaborators, delete board | ✗ 403 | ✗ 403 | ✓ | ✓ |
| `GET /users` | ✗ 403 | ✗ 403 | ✗ 403 | ✓ |

**Status-code precision.** `401` means "we do not know who you are"; `403`
means "we do, and you may not do this" — a logged-in user is never told to
re-authenticate. Existence is resolved **before** permission, so a missing
board is `404` even on an owner-only route. But a resource that exists inside
someone else's board returns `403`, not `404` — otherwise a column or task id
could be probed for existence by watching the status code.

### API

`{id}` params are ObjectIds; a malformed one is a `400` before any lookup.
"Role" is the minimum board-level role required.

#### Auth

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/auth/register` | — | `{name, email, password}`. `201`; `409` if the email is taken; `400` with `details` otherwise |
| POST | `/auth/login` | — | `{email, password}`. Generic `401` on any failure |
| POST | `/auth/refresh` | — | `{refreshToken}`. Verifies + checks `tokenVersion`, returns a new pair |
| POST | `/auth/logout` | authenticated | Bumps `tokenVersion` — invalidates every existing session |
| GET | `/auth/me` | authenticated | The current user |

#### Users

| Method | Path | Role | Notes |
|---|---|---|---|
| PATCH | `/users/me` | authenticated | `{name?, themePreference?, avatar?}`. `themePreference` is enum-validated. Cannot change `role` |
| GET | `/users` | global **admin** | `403` for any other role |

#### Boards

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/boards` | authenticated | Owned + shared, each tagged with `myRole` |
| POST | `/boards` | authenticated | `{name}` or `{title}`. Creator becomes owner |
| GET | `/boards/{id}` | viewer | Collaborators resolved, for the share modal |
| GET | `/boards/{id}/full` | viewer | The nested board the frontend renders in one request |
| PUT | `/boards/{id}` | **owner** | Rename |
| DELETE | `/boards/{id}` | **owner** | Cascades columns, tasks and activity |
| GET | `/boards/{id}/activity` | viewer | `?page=&limit=` (limit ≤ 100), newest first, with pagination metadata |

#### Collaborators

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/boards/{id}/collaborators` | **owner** | `{email, role}`. `404` unknown account, `409` already a collaborator, `409` inviting the owner |
| PATCH | `/boards/{id}/collaborators/{userId}` | **owner** | `{role}` |
| DELETE | `/boards/{id}/collaborators/{userId}` | **owner** | Also clears them from tasks they were assigned |

#### Columns

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/boards/{id}/columns` | editor | `position = maxPosition + 1` |
| PUT | `/columns/{id}` | editor | Rename — also rewrites `status` on every task in the column |
| DELETE | `/columns/{id}` | editor | Deletes its tasks, re-compacts the remaining positions |
| PATCH | `/boards/{id}/columns/reorder` | editor | `{orderedColumnIds}` — must list **exactly** the board's columns |

#### Tasks

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/tasks` | editor | `{boardId, columnId, title, description?, subtasks?, dueDate?, assignedTo?}`. `position` = end of column, `status` = column title |
| GET | `/tasks/{id}` | viewer | |
| PUT / PATCH | `/tasks/{id}` | editor | Both partial. Subtask toggling comes through here. Sending `columnId` is a `400` pointing at the move endpoint |
| PATCH | `/tasks/{id}/move` | editor | `{columnId, position}` — drag-and-drop persistence |
| DELETE | `/tasks/{id}` | editor | Re-compacts the source column |

#### Health

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/health` | — | Status, uptime, timestamp, DB state. The platform's health-check path |

#### Move semantics

`PATCH /tasks/{id}/move` is the one endpoint drag-and-drop persists through:

1. Validate the target column exists **and belongs to the same board**.
2. Close the gap left in the source column.
3. Open the slot in the target column.
4. Set `columnId`, `position`, and `status` = the target column's title.
5. Log `task.moved`.

Steps 2 and 3 run as one ordered `bulkWrite` with the moving task excluded from
both filters, so **reordering inside a single column is the same request** with
the task's current `columnId` — and both columns end up contiguous from 0. A
position past the end of a column is clamped, not rejected: a drag-and-drop
client computes the index optimistically and can legitimately overshoot.

### Setup

```bash
cd server
npm install
cp .env.example .env      # then fill in the values below
npm run dev               # tsx + nodemon on http://localhost:5050
```

**Environment** (`server/.env`, Zod-validated at startup — the process exits
with a per-field explanation rather than booting half-configured):

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | no | `development` \| `test` \| `production` |
| `PORT` | no | Default **5050**; the host injects its own. Avoid 5000 on macOS — Control Center's AirPlay Receiver answers it with a bodyless 403 that reads like a CORS error |
| `DATABASE_URL` | **yes** | `mongodb://127.0.0.1:27017/kanban` locally, or an Atlas SRV string |
| `JWT_SECRET` | **yes** | ≥ 32 chars |
| `JWT_REFRESH_SECRET` | **yes** | ≥ 32 chars, and **must differ** from `JWT_SECRET` in production |
| `JWT_EXPIRES_IN` | no | Default `1h` |
| `JWT_REFRESH_EXPIRES_IN` | no | Default `7d` |
| `FRONTEND_URL` | no | CORS origin. Default `http://localhost:5173` |
| `LOG_LEVEL` | no | Default `info` |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | no | Optional, but **all three or none** — a half-configured OAuth client only fails later at the redirect with an opaque Google error |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Seed** — three users and one demo board built from the repo's real
`data.json` (3 columns, 17 tasks, 36 subtasks, one assignment, one due date),
plus sample activity:

```bash
cd server
npm run seed                          # password defaults to Password123!
SEED_PASSWORD='YourPassword1!' npm run seed
```

| Account | Role | On the demo board |
|---|---|---|
| `admin@kanban.dev` | global admin | full access via the admin bypass |
| `editor@kanban.dev` | editor | **owner** of "Platform Launch" |
| `viewer@kanban.dev` | viewer | collaborator, read-only |

The script is idempotent: users are upserted by email and the demo board is
wiped and recreated. The wipe is scoped to the demo title **owned by the seed
editor**, so running it against a database that also holds real boards leaves
those untouched.

**Tests** — Jest + Supertest + mongodb-memory-server (one in-memory mongod per
run, one database per worker):

```bash
cd server
npm test                  # jest --runInBand --forceExit
npm run test:coverage     # enforces the thresholds below
npm run typecheck
```

395 tests across 14 suites. Coverage thresholds are enforced per file at **80%**
on `src/services/**` and `src/middlewares/**` — the layers holding the business
rules and the authorisation checks.

### Postman

`postman/` contains the collection and both environments:

```bash
npx newman run postman/kanban-api.postman_collection.json \
  -e postman/kanban-api.dev.postman_environment.json
```

60 requests in 9 folders, 93 assertions, runnable straight through in order.
Login and register save `{{TOKEN}}`, `{{REFRESH_TOKEN}}` and `{{USER_ID}}` with
`pm.environment.set`; creating a board, column or task chains
`{{BOARD_ID}}`/`{{COLUMN_ID}}`/`{{TASK_ID}}` for the requests that follow. Every
URL uses `{{BASE_URL}}`.

The **RBAC — viewer is refused** folder is the enforcement demo: a second
account is refused (403) before being invited, reads the board once invited,
is refused on task create / task move / column create / board rename /
self-promotion, is then promoted to editor and can move a task, but still
cannot delete the board. Set `BASE_URL` in the Prod environment to the Railway
URL to run the same checks against production.

### Google OAuth

A hand-rolled authorization-code flow — no passport, because the whole exchange
is three HTTP calls and an upsert, and the part worth being explicit about is
that we mint **our own** JWTs at the end rather than trusting Google's tokens for
anything beyond identifying the user once.

| Method | Path | Notes |
|---|---|---|
| GET | `/auth/google` | 302 to Google's consent screen. Mints a random `state` and parks it in a short-lived httpOnly cookie |
| GET | `/auth/google/callback` | Verifies `state`, exchanges the code server-side, upserts the account, 302s to `FRONTEND_URL/login#token=…&refresh=…` |

- **CSRF**: `state` is 32 random bytes, stored in an `httpOnly`, `SameSite=Lax`,
  10-minute cookie scoped to `/auth`, and compared in constant time. `Lax` rather
  than `Strict` on purpose — the callback arrives as a top-level navigation from
  `accounts.google.com`, and a strict cookie would not be sent with it. The
  cookie is cleared before the exchange, so replaying a callback URL cannot reuse
  a state. A mismatch, a missing cookie or a missing `state` is a **403**.
- **Tokens in the fragment**, not the query string: a URL fragment is never sent
  to a server, so the pair cannot land in access logs, proxy logs, or a `Referer`
  header on the next navigation.
- **Upsert order**: `googleId` first (stable — an email can change, `sub`
  cannot), then a **verified** email to link Google onto an existing password
  account, otherwise create with `role: editor` and no password. An *unverified*
  Google email never links: without that check, anyone who could get Google to
  emit a profile carrying someone else's unverified address could take over that
  account. Linking adds a sign-in method — the original password keeps working.
- **Optional by design**: with the `GOOGLE_*` keys unset the server boots, logs a
  warning, and both routes return **503 `"OAuth not configured"`** — the routes
  exist, the deployment just is not configured for them. A *partial* config
  (one or two of the three) fails at startup rather than at the redirect.
- **Failures are reported per caller.** A browser (`Accept: text/html`) is
  redirected back to `FRONTEND_URL/login#error=<code>&error_description=<text>`
  and the SPA toasts it, so a failed sign-in never strands someone on a raw JSON
  document outside the app. Scripts and API clients keep the documented envelope
  and status code, so the 503 and 403 contracts stay intact. Codes are
  `oauth_not_configured`, `invalid_state`, `missing_code`, `oauth_failed`. Only
  `AppError` messages are forwarded; an unexpected error becomes a generic
  "Google sign-in failed", since its message could carry internals.

Setting it up in Google Cloud Console is a manual step; see below.

### Not implemented

- **Slack sign-in** is out of scope; the Slack button has been removed from the
  frontend and `ApiAuthService.loginWithSlack` throws
  `"Slack sign-in is not supported"`.

---

## Deployment

### Backend → Railway

New Project → Deploy from GitHub repo, then in the service settings:

| Setting | Value |
|---|---|
| Root Directory | `server` |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `node dist/server.js` |
| Health Check Path | `/health` |
| Branch | `main` |

`--include=dev` matters: the build script uses `rimraf` and `typescript`, both
devDependencies, and npm skips devDependencies when `NODE_ENV=production` — which
is one of the variables set below. Without it the build fails with
`tsc: not found`.

Set every environment variable from the table above in the **Variables** tab,
with `DATABASE_URL` pointing at Atlas and `FRONTEND_URL` at the deployed
frontend (this is the CORS origin). Leave `PORT` unset — Railway injects it, and
`env.ts` coerces it.

Then **Settings → Networking → Generate Domain** to get a public URL.

Railway keeps the service warm, so there is no cold-start delay. Note that its
perpetual free tier ended in 2023: a new project runs on trial credit, after
which the Hobby plan (\$5/month) is required to stay up.

**Live API:** `<!-- TODO: https://your-service.up.railway.app -->`

### Frontend → Netlify

Vite project at the repo root.

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Publish directory | `dist` |

In **Site configuration → Environment variables** set:

```
VITE_API_URL=https://<your-service>.up.railway.app
VITE_AUTH_PROVIDER=api
```

`VITE_*` variables are inlined at **build time**, so after changing either one
you must trigger a fresh deploy — saving alone does not alter the built bundle.

SPA routing is already handled by `public/_redirects` (`/* /index.html 200`),
which Vite copies into `dist/`. Without it, refreshing `/board/<id>` would 404.

Then set the Netlify URL as `FRONTEND_URL` on Railway — it is both the CORS origin
and where the OAuth flow lands.

**Live app:** `<!-- TODO: https://your-app.netlify.app -->`

### Google Cloud Console (manual, one-time)

1. **Create/select a project** at [console.cloud.google.com](https://console.cloud.google.com).
2. **APIs & Services → OAuth consent screen.** User type **External**; fill in app
   name, support email and developer contact. Add scopes
   `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` — nothing more,
   or the app needs verification. Leave it in **Testing** and add each grader's
   Google account under **Test users**; an unlisted account gets
   `access_denied`, which the callback reports as
   *"Google sign-in was cancelled or refused"*.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**,
   type **Web application**.
4. **Authorized redirect URIs** — these must match `GOOGLE_REDIRECT_URI`
   character for character, including the scheme and any trailing slash:
   - `http://localhost:5050/auth/google/callback`
   - `https://<your-service>.up.railway.app/auth/google/callback`

   These point at the **backend**, not the frontend. Authorized JavaScript
   origins can be left empty — the browser never talks to Google directly here.
5. Copy the client ID and secret into `server/.env`:

   ```env
   GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxxx
   GOOGLE_REDIRECT_URI=http://localhost:5050/auth/google/callback
   ```

   All three or none — a partial config fails at startup on purpose.
6. On Railway, set the same three variables with the Railway callback URL, and
   make sure `FRONTEND_URL` is the Netlify URL (it is where the flow redirects at
   the end, and the CORS origin).

`redirect_uri_mismatch` is the usual failure and always means step 4 does not
match `GOOGLE_REDIRECT_URI` exactly.

### Deploy to Netlify (CLI)
```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```
`public/_redirects` already carries the SPA rule, so deep links survive a refresh.

---

## License

This project is open-source and available under the **MIT License**.
