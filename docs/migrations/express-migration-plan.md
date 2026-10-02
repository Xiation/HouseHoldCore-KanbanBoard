# Migration Plan: Django → Express.js + Sequelize (REST API)

> **Superseded by `docs/fullstack-build-plan.md`.** That doc has the current repo layout (pnpm workspaces, `server`/`client` siblings), the current scope (Vue frontend + nudge feature included), and the phase checklist to follow. This doc is still the reference for backend logic-porting details (model field definitions, Zod schemas, the Django→Express mapping table) — those sections are unchanged and linked from the new plan.

**Reason for migration:** Django's conventions and documentation have a steep learning curve. Replacing it with Express.js — a framework already familiar to the developer — and shifting to a RESTful JSON API architecture allows faster iteration and better alignment with future frontend work.

**What stays:** All business logic (claim/complete flow, staleness logic, recurring reset), and the data model shape.

**What goes:** Django, all Python code, server-rendered HTML templates, Django admin UI, SQLite file (fresh PostgreSQL DB replaces it).

---

## New Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| ORM | Sequelize + `sequelize-cli` |
| Database | PostgreSQL |
| DB driver | `pg` + `pg-hstore` |
| Validation | Zod (request body/param validation) |
| Testing | Vitest + Supertest (separate test Postgres DB via `TEST_DATABASE_URL`) |
| Dev server | nodemon (auto-reload on file change) |
| Package manager | npm |

---

## Target Project Structure

```
/
├── src/
│   ├── app.js                  # Express app factory (no listen — keeps it testable)
│   ├── server.js               # Entry point: imports app, calls app.listen()
│   ├── db.js                   # Sequelize instance + connection (reads DATABASE_URL)
│   ├── models/
│   │   ├── index.js            # Registers all models + associations
│   │   ├── HouseholdMember.js
│   │   └── Chore.js
│   ├── routes/
│   │   ├── index.js            # Mounts board, chores, members routers onto /api
│   │   ├── board.js            # GET /api/board
│   │   ├── chores.js           # POST /api/chores/:id/claim, /api/chores/:id/complete
│   │   └── members.js          # GET /api/members
│   └── middleware/
│       └── errorHandler.js     # Central error handler (catches unhandled errors)
├── migrations/                 # Sequelize CLI migration files (replaces Django makemigrations)
│   ├── 001-create-household-member.js
│   └── 002-create-chore.js
├── seeders/
│   └── seed.js                 # Replaces Django's seed_demo_data management command
├── tests/
│   ├── setup.js                # Shared beforeAll/afterAll — connects to TEST_DATABASE_URL
│   ├── staleness.test.js       # Unit: Chore model isStale / daysStale logic
│   ├── board.test.js           # Integration: GET /api/board
│   ├── claim.test.js           # Integration: POST /api/chores/:id/claim
│   └── complete.test.js        # Integration: POST /api/chores/:id/complete
├── .env                        # DATABASE_URL, TEST_DATABASE_URL, PORT (never commit)
├── .env.example                # Template with placeholder values (commit this)
├── .sequelizerc                # Tells sequelize-cli where migrations/ and models/ live
├── vitest.config.js            # Points Vitest at tests/setup.js as a global setup file
├── package.json
└── .gitignore
```

> **Note:** Keep Django project files (`choreboard/`, `chores/`, `manage.py`, `pyproject.toml`, `uv.lock`) until Phase M4 is fully verified — use them as a logic reference while porting.

---

## REST API Contract

The full API surface — these 4 endpoints replace everything `views.py` and `urls.py` did.

### `GET /api/board`
Returns all chores grouped into 4 buckets.

**Response `200 OK`:**
```json
{
  "unclaimed": [...],
  "claimedTodo": [...],
  "inProgress": [...],
  "done": [...],
  "members": [...]
}
```

Each chore object includes: `id`, `title`, `status`, `recurrenceType`, `recurrenceInterval`, `dueDate`, `timeEstimate`, `claimedBy` (nested member object or `null`), `lastUpdatedAt`, `lastCompletedAt`, `isStale`, `daysStale`.

> All keys use `camelCase` throughout the API — consistent with JS conventions.

---

### `POST /api/chores/:id/claim`
Claims an unclaimed chore for a household member.

**Request body:**
```json
{ "memberId": 1 }
```

**Response `200 OK`:** Updated chore object.

**Error cases:**
- `404` if chore doesn't exist or is already claimed
- `404` if `memberId` doesn't match any member
- `400` if `memberId` is missing or not a number

---

### `POST /api/chores/:id/complete`
Marks a chore done. Branches on `recurrenceType`:
- `one_off` → status becomes `done`, `dueDate` unchanged, `lastCompletedAt` set
- `recurring` → status resets to `todo`, `claimedBy` cleared, `dueDate` advanced by `recurrenceInterval` days, `lastCompletedAt` set

**Response `200 OK`:** Updated chore object.

**Error cases:**
- `404` if chore doesn't exist

---

### `GET /api/members`
Returns all household members (used by any frontend to populate a member picker).

**Response `200 OK`:**
```json
[{ "id": 1, "name": "Alice" }, ...]
```

---

## Environment Strategy

Three environments, three separate DBs — never let the seeder or tests touch production data.

| Environment | DB | How to set |
|---|---|---|
| Development | local Postgres (`choreboard_dev`) | `DATABASE_URL` in `.env` |
| Test | local Postgres (`choreboard_test`) | `TEST_DATABASE_URL` in `.env` |
| Production | hosted Postgres (Railway / Render / Supabase) | `DATABASE_URL` set on platform |

`src/db.js` reads `TEST_DATABASE_URL` when `NODE_ENV=test`, `DATABASE_URL` otherwise:
```js
const url = process.env.NODE_ENV === 'test'
  ? process.env.TEST_DATABASE_URL
  : process.env.DATABASE_URL;
export const sequelize = new Sequelize(url, { dialect: 'postgres' });
```

The seeder (`seeders/seed.js`) should guard against running in production:
```js
if (process.env.NODE_ENV === 'production') {
  console.error('Seeder must not run in production.');
  process.exit(1);
}
```

---

## Phase-by-Phase Plan

---

### Phase M0 — Project Bootstrap
**Goal:** Working Express app, Postgres connected, dev server running.

- [ ] `npm init -y` in repo root
- [ ] Add `"type": "module"` to `package.json` to enable ES module syntax (`import`/`export`) throughout the project
- [ ] Install runtime dependencies:
  ```bash
  npm install express sequelize pg pg-hstore zod dotenv
  ```
- [ ] Install dev dependencies:
  ```bash
  npm install -D vitest supertest nodemon sequelize-cli
  ```
- [ ] Add scripts to `package.json`:
  ```json
  {
    "type": "module",
    "scripts": {
      "start": "node src/server.js",
      "dev": "nodemon src/server.js",
      "test": "vitest",
      "db:migrate": "sequelize-cli db:migrate",
      "db:seed": "node seeders/seed.js"
    }
  }
  ```
- [ ] Create `.env` with `DATABASE_URL`, `TEST_DATABASE_URL`, and `PORT=3000`
- [ ] Create `.env.example` as a committed template (placeholder values only)
- [ ] Add `.env` and `node_modules/` to `.gitignore`
- [ ] Create `src/db.js` — Sequelize instance, reads `TEST_DATABASE_URL` or `DATABASE_URL` based on `NODE_ENV`
- [ ] Create `src/app.js` — bare Express app with `express.json()` and router mounted at `/api`
- [ ] Create `src/server.js` — loads `.env`, authenticates Sequelize, calls `app.listen(PORT)`
- [ ] Create `.sequelizerc` — points `sequelize-cli` at `src/models/` and `migrations/`
- [ ] Create `vitest.config.js`:
  ```js
  import { defineConfig } from 'vitest/config';
  export default defineConfig({
    test: {
      setupFiles: ['./tests/setup.js'],
      environment: 'node',
    },
  });
  ```
- [ ] Create both local Postgres DBs: `choreboard_dev` and `choreboard_test`

**Done when:** `npm run dev` starts without errors, `curl http://localhost:3000/api` returns any response.

---

### Phase M1 — Data Models + Migrations (replaces Django Phase 1)
**Goal:** Sequelize models defined, DB schema created via migrations, seed data loadable.

**`HouseholdMember` model** (`src/models/HouseholdMember.js`):
```js
// Fields: id (auto), name (STRING, unique, not null)
// Model options: tableName: 'HouseholdMembers', timestamps: false
```

**`Chore` model** (`src/models/Chore.js`):
```js
// Fields:
// id                 (auto)
// title              (STRING, not null)
// status             (ENUM: 'todo', 'in_progress', 'done', default: 'todo')
// recurrenceType     (ENUM: 'one_off', 'recurring', default: 'one_off')
// recurrenceInterval (INTEGER, allowNull: true)
// dueDate            (DATEONLY, allowNull: true)
// timeEstimate       (ENUM: 'quick', 'medium', 'big', not null)
// claimedById        (FK → HouseholdMember, allowNull: true, onDelete: 'SET NULL')
// lastCompletedAt    (DATE, allowNull: true)
//
// Model options:
//   tableName: 'Chores'
//   timestamps: true
//   createdAt: false           ← we don't need createdAt
//   updatedAt: 'lastUpdatedAt' ← maps Sequelize's auto-managed updatedAt to our field name
```

> **Important:** `updatedAt: 'lastUpdatedAt'` is required — Sequelize only auto-manages a field named `updatedAt` by default. Without this config, `lastUpdatedAt` won't update automatically on `.save()`.

**Model methods** (instance methods on Chore, replaces Python `@property`):
```js
// daysStale() → 0 if status === 'done', else Math.floor((Date.now() - this.lastUpdatedAt) / 86_400_000)
// isStale()   → status !== 'done' && this.daysStale() >= STALE_AFTER_DAYS   (STALE_AFTER_DAYS = 3)
```

**Associations** (in `src/models/index.js`):
```js
Chore.belongsTo(HouseholdMember, { as: 'claimedBy', foreignKey: 'claimedById' });
HouseholdMember.hasMany(Chore, { as: 'claimedChores', foreignKey: 'claimedById' });
```

**Migrations** (in `migrations/`):
- `001-create-household-member.js` — creates `HouseholdMembers` table
- `002-create-chore.js` — creates `Chores` table with FK to `HouseholdMembers`
- Run with: `npm run db:migrate` (runs against `DATABASE_URL` i.e. dev DB)

> **Why migrations instead of `sync()`:** With a shared/deployed Postgres DB, you need migration files that apply incrementally — `sync()` can silently skip schema changes or destructively drop data.

**Seeder** (`seeders/seed.js`):
- Guards against `NODE_ENV=production` — exits with error if attempted
- Creates demo members + chores matching the original Django seed data
- Idempotent — uses `findOrCreate` so it's safe to run multiple times
- Run with: `npm run db:seed`

**Done when:** `npm run db:migrate && npm run db:seed` succeeds; a DB client shows seeded rows in both tables.

---

### Phase M2 — Board Endpoint (replaces Django Phase 2)
**Goal:** `GET /api/board` returns correctly grouped chores.

- [ ] Create `src/routes/board.js`
- [ ] Query all chores with `include: [{ model: HouseholdMember, as: 'claimedBy' }]`, ordered by `dueDate ASC`
- [ ] Group into 4 buckets in JS (filter by `status` + `claimedById` null/not-null):
  - `unclaimed` — `status === 'todo'` AND `claimedById === null`
  - `claimedTodo` — `status === 'todo'` AND `claimedById !== null`
  - `inProgress` — `status === 'in_progress'`
  - `done` — `status === 'done'`
- [ ] Call `.toJSON()` on each Sequelize instance, then attach `isStale` and `daysStale` as plain values before sending (Sequelize instances don't serialise custom methods automatically)
- [ ] Also query and return all `HouseholdMember` records as `members`
- [ ] In `src/routes/index.js`, mount routes:
  ```js
  router.use('/board', boardRouter);
  router.use('/chores', choresRouter);
  router.use('/members', membersRouter);
  ```

**Done when:** `curl http://localhost:3000/api/board` returns valid JSON with all 4 buckets populated from seed data, each chore includes `isStale` and `daysStale` fields.

---

### Phase M3 — Claim, Complete & Members Endpoints (replaces Django Phase 4)
**Goal:** Core interaction loop works end-to-end via API.

**Claim route** (`POST /api/chores/:id/claim` in `src/routes/chores.js`):
- [ ] Parse and validate `req.params.id` as an integer — return `400` if not a valid number:
  ```js
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid chore id' });
  ```
- [ ] Validate request body with Zod — return `400` if `memberId` is missing or not a number:
  ```js
  const schema = z.object({ memberId: z.number().int().positive() });
  ```
- [ ] `Chore.findOne({ where: { id, claimedById: null } })` → return `404` if null (handles "not found" and "already claimed" in one guard — mirrors Django's `get_object_or_404`)
- [ ] `HouseholdMember.findByPk(memberId)` → return `404` if null
- [ ] Set `claimedById = memberId`, `status = 'in_progress'`, call `.save()`
- [ ] Re-fetch the chore with `claimedBy` included, return as `200` JSON

**Complete route** (`POST /api/chores/:id/complete` in `src/routes/chores.js`):
- [ ] Parse and validate `req.params.id` as an integer — return `400` if invalid
- [ ] `Chore.findByPk(id)` → return `404` if null
- [ ] Set `lastCompletedAt = new Date()` for both branches (same as Django — set outside the if/else)
- [ ] Branch on `recurrenceType`:
  - `one_off` → `status = 'done'`
  - `recurring` → `status = 'todo'`, `claimedById = null`, advance `dueDate`:
    ```js
    const base = new Date(chore.dueDate); // use existing dueDate, not today
    base.setDate(base.getDate() + chore.recurrenceInterval);
    chore.dueDate = base.toISOString().slice(0, 10); // DATEONLY: 'YYYY-MM-DD'
    ```
- [ ] Call `.save()`, return updated chore as `200` JSON

**Members route** (`GET /api/members` in `src/routes/members.js`):
- [ ] `HouseholdMember.findAll()` → return as `200` JSON array

**Done when:** All 3 route groups respond correctly via curl/Postman; recurring reset produces the exact correct advanced date; invalid `:id` params return `400`.

---

### Phase M4 — Tests (replaces `chores/tests.py`)
**Goal:** All 9 original test scenarios covered, running via `npm test`.

**Test DB strategy:** Run tests against `choreboard_test` (a real local Postgres DB) via `TEST_DATABASE_URL`. Each test run calls `sequelize.sync({ force: true })` to wipe and recreate the schema — this is safe because it's an isolated test DB.

```js
// tests/setup.js
import 'dotenv/config';
import { sequelize } from '../src/db.js';
import '../src/models/index.js'; // registers all models + associations

process.env.NODE_ENV = 'test'; // ensures db.js picks TEST_DATABASE_URL

beforeAll(async () => {
  await sequelize.sync({ force: true }); // fresh schema before each test run
});

afterAll(async () => {
  await sequelize.close();
});
```

`vitest.config.js` (already created in M0) points Vitest at this file via `setupFiles`, so it runs automatically before every test file.

> Each test file imports `app` from `src/app.js` (not `server.js`) and passes it to `supertest(app)` — no real HTTP server binds a port during tests, same principle as Django's test `Client`.

**Test coverage (9 scenarios total — same as the original Django suite):**

| File | Scenarios | Technique |
|---|---|---|
| `staleness.test.js` | `isStale` true past threshold; false under threshold; false when done regardless of age | Unit — call model methods directly on constructed instances |
| `board.test.js` | `GET /api/board` correctly groups chores into 4 buckets | Integration — Supertest GET, assert response JSON shape |
| `claim.test.js` | Valid claim sets `claimedBy` + `status = in_progress`; already-claimed returns `404`; GET request does not mutate | Integration — Supertest POST/GET |
| `complete.test.js` | `one_off` → `done` + `dueDate` unchanged + `lastCompletedAt` set; `recurring` → `todo` + `dueDate` advanced by exact interval + `claimedBy` cleared | Integration — Supertest POST |

> **Staleness unit test note:** `lastUpdatedAt` is auto-managed by Sequelize on `.save()`, so you can't backdate it via the model. Use a raw `UPDATE` query (via `sequelize.query()`) to backdate it after creation — same technique as Django's `Chore.objects.filter(...).update(last_updated_at=...)`.

**Done when:** `npm test` → all 9 tests pass against `choreboard_test`.

---

### Phase M5 — Cleanup & Deploy Prep
**Goal:** Repo is clean, Django artefacts removed, README reflects the new stack, project is deployable.

- [ ] Delete all Django files: `choreboard/`, `chores/`, `manage.py`, `pyproject.toml`, `uv.lock`, `.python-version`
- [ ] Delete `db.sqlite3` if it still exists (it may have already been gitignored)
- [ ] Update `.gitignore`: ensure `node_modules/`, `.env` are listed; remove Python-specific entries (`__pycache__/`, `*.pyc`, `.venv/`)
- [ ] Update `README.md`:
  - Prerequisites: Node.js, PostgreSQL
  - Setup: `npm install`, copy `.env.example` → `.env` and fill in DB URLs, `npm run db:migrate`, `npm run db:seed`
  - Dev: `npm run dev`
  - Test: `npm test` (requires `choreboard_test` DB to exist locally)
  - Deploy: set `DATABASE_URL` on platform, run `npm run db:migrate` against prod DB on first deploy
- [ ] Provision Postgres on deploy target (Railway / Render / Supabase all have free tiers)
- [ ] Set `DATABASE_URL` as a platform environment variable (never `TEST_DATABASE_URL` in prod)
- [ ] Run `npm run db:migrate` against the production DB on first deploy
- [ ] Final `npm test` on a clean checkout to confirm everything passes

**Done when:** `git clone` → `npm install` → fill `.env` → `npm run dev` produces a running API; `npm test` passes; no Python dependency remains.

---

## Mapping: Django Code → Express Code

| Django | Express equivalent | Notes |
|---|---|---|
| `models.py` `HouseholdMember` | `src/models/HouseholdMember.js` | Direct 1:1 field mapping |
| `models.py` `Chore` | `src/models/Chore.js` | `snake_case` → `camelCase`; `updatedAt: 'lastUpdatedAt'` required |
| `@property is_stale` | `chore.isStale()` instance method | Same logic, JS Date math |
| `@property days_stale` | `chore.daysStale()` instance method | `Math.floor((Date.now() - this.lastUpdatedAt) / 86_400_000)` |
| `views.py` `board_view` | `src/routes/board.js` GET handler | Returns JSON; call `.toJSON()` + attach `isStale`/`daysStale` before res.json() |
| `views.py` `claim_chore` | `src/routes/chores.js` POST handler | `req.body.memberId` instead of `request.POST.get('member_id')`; parse `req.params.id` to int |
| `views.py` `complete_chore` | `src/routes/chores.js` POST handler | Same branching logic; `Date.setDate()` instead of `timedelta`; parse `req.params.id` to int |
| `get_object_or_404(Chore, pk=id, claimed_by__isnull=True)` | `Chore.findOne({ where: { id, claimedById: null } })` + manual 404 | Guard is in the query, not a separate check — same pattern |
| `redirect('board')` | `res.status(200).json(updatedChore)` | REST returns the resource, not a redirect |
| `makemigrations` / `migrate` | `sequelize-cli db:migrate` | Migration files written manually, not auto-generated from model diffs |
| `manage.py test` | `npm test` (Vitest + Supertest) | Requires `choreboard_test` DB to exist |
| `management/commands/seed_demo_data.py` | `seeders/seed.js` | `npm run db:seed`; guarded against production |

---

## Key Behaviours to Preserve

These are the specific rules from the PRD that the Express implementation must replicate exactly — don't lose them in translation:

1. **Unclaimed pool:** A chore is "unclaimed" when `claimedById IS NULL` AND `status = 'todo'`
2. **Claim guard:** Claiming an already-claimed chore must be rejected (`404`) — the guard is baked into the DB query (`claimedById: null` in `findOne`), not a separate validation step
3. **Recurring reset:** On complete, `dueDate` advances by **exactly** `recurrenceInterval` days from the *current* `dueDate` (not from today) — preserves the schedule regardless of when the chore was actually completed
4. **Staleness threshold:** `STALE_AFTER_DAYS = 3` — a chore last updated 3+ days ago (and not done) is stale
5. **Done chores never stale:** `isStale()` returns `false` and `daysStale()` returns `0` for any done chore, regardless of age
