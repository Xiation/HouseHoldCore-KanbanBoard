# Migration Runbook: Django → Express + Vue

Literal step-by-step commands to execute, in order. This is the hands-on companion to `docs/fullstack-build-plan.md` (the phase checklist/what) and `docs/express-migration-plan.md` (exact model/route code specs) — this doc is the *how*, typed into your terminal.

Prereqs before starting: Node.js installed, `pnpm` installed (`npm install -g pnpm` if not), PostgreSQL running locally.

---

## Step 1 — Monorepo skeleton

From repo root (where `manage.py` currently lives):

```bash
mkdir server client
```

Create `pnpm-workspace.yaml` at root:
```yaml
packages:
  - 'server'
  - 'client'
```

Create root `package.json`:
```json
{
  "private": true,
  "scripts": {
    "dev": "pnpm --parallel --filter ./server --filter ./client dev",
    "test": "pnpm --filter ./server test"
  }
}
```

Leave all Django files (`choreboard/`, `chores/`, `manage.py`, etc.) exactly where they are for now — you'll delete them in the last step, once the new stack is verified working. Keep them as your logic reference while porting.

---

## Step 2 — Backend package init

```bash
cd server
pnpm init
```

Edit `server/package.json`, add `"type": "module"` and the scripts block:
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

Install dependencies:
```bash
pnpm add express sequelize pg pg-hstore zod dotenv cors
pnpm add -D vitest supertest nodemon sequelize-cli
```
(`cors` added vs. the original plan — you'll need it once the Vue dev server on a different port talks to this API.)

---

## Step 3 — Postgres databases

```bash
createdb choreboard_dev
createdb choreboard_test
```
(If `createdb` isn't on your PATH, use `psql -c "CREATE DATABASE choreboard_dev;"` instead, twice.)

Create `server/.env`:
```
DATABASE_URL=postgres://localhost:5432/choreboard_dev
TEST_DATABASE_URL=postgres://localhost:5432/choreboard_test
PORT=3000
```
Add username/password to the URLs if your local Postgres needs auth. Create `server/.env.example` as a copy with placeholder values, and confirm `.env` is gitignored.

---

## Step 4 — Backend skeleton files

Still inside `server/`, create:

`.sequelizerc`:
```js
const path = require('path');
module.exports = {
  'models-path': path.resolve('src', 'models'),
  'migrations-path': path.resolve('migrations'),
};
```

`vitest.config.js`:
```js
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { setupFiles: ['./tests/setup.js'], environment: 'node' },
});
```

`src/db.js`:
```js
import { Sequelize } from 'sequelize';
import 'dotenv/config';

const url = process.env.NODE_ENV === 'test'
  ? process.env.TEST_DATABASE_URL
  : process.env.DATABASE_URL;

export const sequelize = new Sequelize(url, { dialect: 'postgres', logging: false });
```

`src/app.js`:
```js
import express from 'express';
import cors from 'cors';
import apiRouter from './routes/index.js';

export const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);
```

`src/server.js`:
```js
import { app } from './app.js';
import { sequelize } from './db.js';

const PORT = process.env.PORT || 3000;

sequelize.authenticate()
  .then(() => app.listen(PORT, () => console.log(`Listening on ${PORT}`)))
  .catch((err) => { console.error('DB connection failed:', err); process.exit(1); });
```

`src/routes/index.js` (stub for now, filled in Step 7):
```js
import { Router } from 'express';
const router = Router();
router.get('/', (req, res) => res.json({ status: 'ok' }));
export default router;
```

Verify: `pnpm dev`, then in another terminal `curl localhost:3000/api` → should return `{"status":"ok"}`.

---

## Step 5 — Models + migrations

Port the models from Django's `chores/models.py`. Exact field-by-field spec is in `docs/express-migration-plan.md` under "Phase M1" — follow it precisely for `HouseholdMember` and `Chore`, including the `updatedAt: 'lastUpdatedAt'` override (easy to miss, breaks staleness logic silently if skipped).

```bash
pnpm exec sequelize-cli model:generate --name HouseholdMember --attributes name:string
pnpm exec sequelize-cli model:generate --name Chore --attributes title:string,status:string,recurrenceType:string,recurrenceInterval:integer,dueDate:dateonly,timeEstimate:string,claimedById:integer,lastCompletedAt:date
```
This scaffolds both model files and migration files — then hand-edit them to match the exact spec (enums, defaults, associations, the `updatedAt` rename) since the generator only gives you a rough starting shape.

Add associations to `src/models/index.js` (spec in the same section of the referenced doc).

Add `isStale()`/`daysStale()` instance methods to the `Chore` model — port directly from `chores/models.py`'s `is_stale`/`days_stale` properties, translating Python's `timezone.now()` math to `Date.now()` math (spec has the exact formula).

Run migrations against dev DB:
```bash
pnpm run db:migrate
```

Write `seeders/seed.js` — port the 3 members + 5 chores from Django's `chores/management/commands/seed_demo_data.py` (same names, same shape, same one backdated "stale" chore). Guard against `NODE_ENV=production`.

```bash
pnpm run db:seed
```

Verify: connect with `psql choreboard_dev` (or any Postgres client) and confirm both tables have the seeded rows.

---

## Step 6 — Board + nudge endpoint

Port `board_view` from `chores/views.py` into `src/routes/board.js` — group chores into 4 buckets exactly as the Django view does (spec: `docs/express-migration-plan.md` Phase M2).

Add the nudge computation on top (new logic, doesn't exist in Django) — spec is in `docs/fullstack-build-plan.md` under "Nudge computation." Write it as a standalone function (e.g. `computeNudges(members, chores)`) so it's testable without going through the HTTP layer.

Mount the route in `src/routes/index.js`:
```js
router.use('/board', boardRouter);
```

Verify:
```bash
curl localhost:3000/api/board | jq
```
Confirm all 4 buckets are populated and `nudges` shows at least the member you seeded with no recent activity.

---

## Step 7 — Claim, complete, members endpoints

Port `claim_chore` and `complete_chore` from `chores/views.py` into `src/routes/chores.js`, and add `src/routes/members.js`. Exact logic (including the guard-in-query double-claim rejection, the `dueDate`-advance-from-existing-date rule, and Zod validation) is spec'd in `docs/express-migration-plan.md` Phase M3 — follow it precisely, this is the core "coordination loop" logic and needs to match behavior exactly.

Mount both:
```js
router.use('/chores', choresRouter);
router.use('/members', membersRouter);
```

Verify each with curl, same pattern used when testing the Django views originally:
```bash
curl -X POST localhost:3000/api/chores/1/claim -H "Content-Type: application/json" -d '{"memberId": 1}'
curl -X POST localhost:3000/api/chores/1/complete
curl localhost:3000/api/members
```
Check the DB (or refetch `/api/board`) after each to confirm the mutation landed correctly, same way you verified the Django version.

---

## Step 8 — Backend tests

Write `tests/setup.js` (exact content in `docs/fullstack-build-plan.md` Phase M4/Phase 5), then one test file per concern, porting the 9 scenarios from `chores/tests.py` plus 3 new nudge scenarios — full scenario list is in `docs/fullstack-build-plan.md`'s Phase 5 table.

```bash
pnpm test
```
All 12 should pass before moving on — don't start the frontend against an unverified backend.

---

## Step 9 — Frontend scaffold

```bash
cd ../client
pnpm create vite . --template vue
pnpm install
```

Write `src/api.js` as a thin `fetch` wrapper (4 functions: `getBoard`, `claimChore`, `completeChore`, `getMembers`).

```bash
pnpm dev
```
Open the printed localhost URL, open browser devtools console, run `fetch('http://localhost:3000/api/board').then(r => r.json()).then(console.log)` — confirms CORS is working and the two dev servers can talk before you write any UI.

---

## Step 10 — Frontend board UI

Build `App.vue`, `BoardColumn.vue`, `ChoreCard.vue`, `ClaimForm.vue`, `NudgeBanner.vue` per the component breakdown in `docs/fullstack-build-plan.md` Phase 7. Port the CSS from `chores/static/chores/style.css` as a starting point rather than styling from scratch.

Manually verify in browser: claim a chore, mark a recurring one done and watch it cycle back, mark a one-off done, confirm the nudge banner shows an inactive member.

---

## Step 11 — Run both together

From repo root:
```bash
pnpm install       # installs both workspaces
pnpm dev            # runs server + client concurrently
```
Confirm the full loop works with both processes started from the root command, not just individually — this is what a fresh clone will do.

---

## Step 12 — Delete Django, finalize

Only after Step 11 is fully verified:
```bash
rm -rf choreboard chores manage.py pyproject.toml uv.lock .python-version db.sqlite3
```
Update root `.gitignore` (drop Python entries, confirm `node_modules/`, `.env`, `dist/` are covered). Update `README.md` with the new stack's setup/dev/test/deploy instructions. Run `pnpm test` once more on the now-Django-free repo to confirm nothing was silently depending on it.

---

## If something breaks

This mirrors the systematic approach used throughout the Django build: check the actual error message first (don't guess), verify one layer at a time (DB connection → model → route → frontend fetch), and re-run the specific failing step in isolation before assuming something upstream is broken.
