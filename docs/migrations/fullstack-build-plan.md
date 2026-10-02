# Build Plan: Full-Stack Chore Board (Express + Vue)

**Supersedes `docs/express-migration-plan.md`** — that doc's backend logic/API design/mapping tables are still accurate and referenced below, but its repo layout (backend-at-root) and scope (API-only) are replaced by this plan. Keep the old doc for the Django→JS logic-porting reference table; don't follow its folder structure.

**Why this exists:** the new submission asks for a shipped, AI-assisted full-stack app. Django's learning curve was slowing iteration; Express is the developer's home turf. Decision log from planning discussion:
- Backend: Express + Sequelize + Postgres (developer's own choice, not a submission requirement — done for the full-stack experience)
- Frontend: Vue (chosen over React for this project)
- Package manager: pnpm, using **workspaces** (`server` + `client` as sibling packages)
- MVP4 (nudge) — **kept**, not dropped. Reasoning: PRD explicitly frames it as this app's differentiator vs. a plain kanban clone; skipping it means shipping a generic board. Folded into the board endpoint rather than a separate route (see API contract below).
- Admin UI — deferred. Revisit once server + client core loop both work end-to-end (~halfway point, after Phase 5).

---

## Repo Layout

Server and client as sibling packages under a pnpm workspace — standard for apps that deploy independently (API to Render/Railway, static Vue build to Vercel/Netlify):

```
/
├── pnpm-workspace.yaml
├── package.json                 # root: convenience scripts only, no app code
├── server/
│   ├── src/
│   │   ├── app.js                # Express app factory (no listen — testable)
│   │   ├── server.js             # entry point: imports app, calls app.listen()
│   │   ├── db.js                 # Sequelize instance (DATABASE_URL / TEST_DATABASE_URL)
│   │   ├── models/
│   │   │   ├── index.js
│   │   │   ├── HouseholdMember.js
│   │   │   └── Chore.js
│   │   ├── routes/
│   │   │   ├── index.js
│   │   │   ├── board.js          # GET /api/board (includes nudges)
│   │   │   ├── chores.js         # POST /api/chores/:id/claim, /complete
│   │   │   └── members.js        # GET /api/members
│   │   └── middleware/
│   │       └── errorHandler.js
│   ├── migrations/
│   ├── seeders/
│   │   └── seed.js
│   ├── tests/
│   │   ├── setup.js
│   │   ├── staleness.test.js
│   │   ├── board.test.js
│   │   ├── nudges.test.js
│   │   ├── claim.test.js
│   │   └── complete.test.js
│   ├── .env / .env.example
│   ├── .sequelizerc
│   ├── vitest.config.js
│   └── package.json
└── client/
    ├── src/
    │   ├── main.js
    │   ├── App.vue
    │   ├── components/
    │   │   ├── BoardColumn.vue
    │   │   ├── ChoreCard.vue
    │   │   ├── ClaimForm.vue
    │   │   └── NudgeBanner.vue
    │   ├── api.js                # thin fetch wrapper around the API
    │   └── style.css
    ├── index.html
    ├── vite.config.js
    └── package.json
```

Root `pnpm-workspace.yaml`:
```yaml
packages:
  - 'server'
  - 'client'
```

Root `package.json` (convenience only — each package still has its own scripts/deploy):
```json
{
  "private": true,
  "scripts": {
    "dev": "pnpm --parallel --filter ./server --filter ./client dev",
    "test": "pnpm --filter ./server test"
  }
}
```

---

## REST API Contract

Same 4 routes from `express-migration-plan.md`, with one change: **nudges are folded into the board response**, not a separate endpoint — the board is the only screen that needs them, so one fetch covers the whole page.

### `GET /api/board`
```json
{
  "unclaimed": [...],
  "claimedTodo": [...],
  "inProgress": [...],
  "done": [...],
  "members": [...],
  "nudges": [
    { "memberId": 3, "name": "Carol", "daysSinceActivity": 6 }
  ]
}
```
Each chore: `id`, `title`, `status`, `recurrenceType`, `recurrenceInterval`, `dueDate`, `timeEstimate`, `claimedBy` (nested member or `null`), `lastUpdatedAt`, `lastCompletedAt`, `isStale`, `daysStale`. All keys `camelCase`.

**Nudge computation:** for each `HouseholdMember`, find their most recent activity — the latest of (a) any `Chore` where they're `claimedBy`, by `lastUpdatedAt`, or (b) any chore's `lastCompletedAt` where they were the completer. If no activity found within `NUDGE_AFTER_DAYS` (constant, default `5` — separate from `STALE_AFTER_DAYS = 3` used for chore staleness), include them in `nudges` with `daysSinceActivity`. A member with zero activity ever (new member, no chores touched) counts as nudge-worthy immediately.

### `POST /api/chores/:id/claim`
Unchanged from `express-migration-plan.md` — body `{ "memberId": 1 }`, 404 if chore missing/already claimed, 404 if member missing, 400 if `memberId` invalid.

### `POST /api/chores/:id/complete`
Unchanged — branches on `recurrenceType`, exact same field mutations as documented in the superseded plan's Key Behaviours section.

### `GET /api/members`
Unchanged — `[{ "id": 1, "name": "Alice" }, ...]`.

---

## Phase-by-Phase Plan

### Phase 0 — Monorepo Bootstrap
- [ ] `pnpm-workspace.yaml` at root declaring `server` + `client`
- [ ] Root `package.json` with `dev`/`test` convenience scripts (above)
- [ ] `git init` already done; add root `.gitignore` covering `node_modules/`, `.env`, `dist/`

**Done when:** `pnpm install` at root succeeds with no packages yet (empty workspaces are fine to start).

---

### Phase 1 — Backend Bootstrap (`server/`)
Same as `express-migration-plan.md` Phase M0, paths now under `server/`, npm swapped for pnpm:
- [ ] `cd server && pnpm init`
- [ ] `"type": "module"` in `server/package.json`
- [ ] `pnpm add express sequelize pg pg-hstore zod dotenv`
- [ ] `pnpm add -D vitest supertest nodemon sequelize-cli`
- [ ] Scripts: `"dev": "nodemon src/server.js"`, `"start": "node src/server.js"`, `"test": "vitest"`, `"db:migrate": "sequelize-cli db:migrate"`, `"db:seed": "node seeders/seed.js"`
- [ ] `server/.env` + `.env.example` (`DATABASE_URL`, `TEST_DATABASE_URL`, `PORT=3000`)
- [ ] `server/src/db.js`, `server/src/app.js`, `server/src/server.js`, `.sequelizerc`, `vitest.config.js`
- [ ] Create local Postgres DBs: `choreboard_dev`, `choreboard_test`

**Done when:** `pnpm --filter server dev` starts clean; `curl localhost:3000/api` responds.

---

### Phase 2 — Data Models + Migrations
Same as `express-migration-plan.md` Phase M1 — `HouseholdMember`, `Chore` models, hand-written migrations, `isStale()`/`daysStale()` instance methods, seed data via `findOrCreate`.

**Done when:** `pnpm --filter server db:migrate && pnpm --filter server db:seed` succeeds.

---

### Phase 3 — Board Endpoint + Nudge Computation
Extends `express-migration-plan.md` Phase M2 with nudge logic:
- [ ] `GET /api/board` groups chores into 4 buckets (unchanged logic from superseded plan)
- [ ] Add nudge computation (see API contract above) as a helper function, e.g. `computeNudges(members, chores)` — pure function, easy to unit test in isolation
- [ ] Attach `nudges` array to the board response

**Done when:** `curl localhost:3000/api/board` returns all 4 chore buckets + populated `nudges` from seed data (seed at least one member with no recent activity to prove it works).

---

### Phase 4 — Claim, Complete & Members Endpoints
Identical to `express-migration-plan.md` Phase M3 — no changes. Zod validation on `memberId`, guard-in-query pattern for double-claim rejection, exact due-date-advance-from-existing-due-date logic for recurring completion.

**Done when:** all 3 route groups work via curl; invalid `:id` returns 400; recurring completion advances date correctly.

---

### Phase 5 — Backend Tests
Extends `express-migration-plan.md` Phase M4 with one more file:

| File | Scenarios |
|---|---|
| `staleness.test.js` | Same 3 as before (past threshold / under threshold / done-never-stale) |
| `board.test.js` | Board groups correctly into 4 buckets |
| `nudges.test.js` | Member with no activity in `NUDGE_AFTER_DAYS` → flagged; member with recent activity → not flagged; new member with zero ever activity → flagged immediately |
| `claim.test.js` | Valid claim; already-claimed → 404; GET doesn't mutate |
| `complete.test.js` | one_off → done; recurring → reset + date advance |

**Done when:** `pnpm --filter server test` → all tests pass (12 total: original 9 + 3 nudge scenarios) against `choreboard_test`.

---

### Phase 6 — Frontend Bootstrap (`frontend/`)
> **Future-mobile note (added later):** this app is intended to eventually grow from household → team kanban tool. Plan is for a responsive **mobile web** experience, not an installable app (PWA/Capacitor) — that's explicitly out of scope for now, revisit only once the core product is established. What's worth doing cheaply today regardless: keep API calls and board/claim/complete/nudge logic in Vue composables (`src/composables/`), not inlined directly in component templates — costs nothing now, keeps the logic portable if this ever needs a different frontend shell later. Also stay disciplined about mobile-first responsive CSS from the start rather than bolting it on after.

- [ ] `cd frontend && pnpm create vite . --template vue`
- [ ] `pnpm install`
- [ ] Install PrimeVue (`pnpm add primevue @primevue/themes`) — see `docs/UI/design-system/choreboard/MASTER.md` for the chosen palette/type/spacing to theme it with
- [ ] `frontend/src/api.js` — thin wrapper around `fetch` for the 4 API calls (no axios — native `fetch` covers this app's needs without an extra dependency)
- [ ] Confirm `pnpm --filter frontend dev` serves a blank Vue app; confirm it can reach `backend`'s API (CORS already handled — `cors` middleware is in `app.js`)

**Done when:** Vite dev server runs, a test fetch to `/api/board` succeeds from the browser console.

---

### Phase 7 — Frontend Board UI
- [ ] `App.vue` — fetches `/api/board` on mount, holds the response in reactive state (no Pinia needed — single-page app, one source of truth is enough)
- [ ] `useBoard.js` composable — wraps the fetch/claim/complete calls and board state, keeping `App.vue` thin
- [ ] `BoardColumn.vue` — renders one column (To Do/In Progress/Done), takes chores as a prop
- [ ] `ChoreCard.vue` — title, claimant, due date, time estimate badge, staleness styling (per the design system's `.card`/`.card--stale` spec)
- [ ] `ClaimForm.vue` — member-picker dropdown (PrimeVue `Select`) + Claim button, POSTs to `/api/chores/:id/claim`, re-fetches board on success
- [ ] Mark Done button — POSTs to `/api/chores/:id/complete`, re-fetches board on success
- [ ] `NudgeBanner.vue` — renders the `nudges` array from the board response as a small banner/badge list
- [ ] Responsive check at 375px/768px/1024px — columns should stack vertically on mobile width, not horizontal-scroll (per design system checklist)

**Done when:** full loop works in the browser — claim a chore, mark it done, see a recurring chore cycle back, see the nudge banner reflect an inactive member, and the board remains usable at phone width. This is the "half the app done" checkpoint — revisit the admin prototype decision here.

---

### Phase 8 — Admin Prototype (deferred checkpoint)
Only start this once Phase 7 is verified working end-to-end. Revisit then whether a fast CRUD prototype is still wanted, and how minimal it should be (e.g. a single `/admin`-ish Vue view hitting the same API, vs. a raw Postgres client). Not planned in detail yet — deliberately deferred, not forgotten.

**Deferred: DELETE endpoints for chores/members.** Not part of the household MVP's PRD at all (no FR mentions removing a chore or member) — would be scope creep against the "keep it lightweight" goal right now. Revisit once this evolves into the team-kanban version, where membership/chore-catalog changes become a real use case.

---

### Phase 9 — Cleanup & Deploy Prep
- [ ] Delete all Django files: `choreboard/`, `chores/`, `manage.py`, `pyproject.toml`, `uv.lock`, `.python-version`, `db.sqlite3`
- [ ] Update root `.gitignore` (remove Python entries, confirm `node_modules/`, `.env`, `dist/` covered)
- [ ] Update `README.md`: prerequisites (Node.js, pnpm, PostgreSQL), setup steps for both packages, dev/test commands, deploy notes
- [ ] Provision Postgres on a host (Railway/Render/Supabase free tier)
- [ ] Deploy `server` (API) and `client` (static Vue build) as separate targets
- [ ] Run `pnpm --filter server db:migrate` against production DB on first deploy
- [ ] Final `pnpm test` on a clean checkout to confirm everything passes

**Done when:** clone → `pnpm install` at root → fill both `.env` files → `pnpm dev` runs both sides → `pnpm test` passes → deployed and reachable.

---

## Reference: Logic Porting Details

For exact Sequelize model field definitions, migration file contents, Zod schemas, and the full Django→Express mapping table, see `docs/express-migration-plan.md` sections "Phase M1", "Phase M3", and "Mapping: Django Code → Express Code" — that content is unchanged by this plan and still the source of truth for *how* each piece of logic translates.
