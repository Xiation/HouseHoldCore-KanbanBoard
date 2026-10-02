# Project Shift Handoff — Household Kanban → Team Kanban SaaS

Context document for starting the next project (new repo, same parent folder: `~/Documents/my_playground/`). Written to be read standalone — assumes no prior knowledge of this conversation.

---

## Why this shift is happening

This repo (`HouseHoldCore-KanbanBoard`) was built for DataTalksClub's AI Dev Tools Zoomcamp, Homework 2 ("Build and Ship an AI-Assisted Full-Stack App"). Started as a Django app, migrated mid-build to Express + Vue + PostgreSQL + PrimeVue (see `docs/express-migration-plan.md` / `docs/fullstack-build-plan.md` for the full migration history and reasoning).

**Current status:** the household-scope MVP is functionally complete and polished — board loads, claim/complete/nudge logic all work end-to-end, tested (12 passing backend tests), styled with a real design system, and an OpenAPI contract (`openapi.yaml`) documents the API as-built.

**Why stopping here, not continuing in this repo:**
- The homework2 deadline has already passed. No further homeworks (3: containerize/deploy, 4: observability/security) will be submitted — this is now purely a self-directed learning exercise ("DIY playground"), no external deadline pressure.
- Decided to evolve the *concept* into something bigger and more portfolio-relevant: a proper team-based kanban SaaS dashboard (multi-user, richer UI inspired by real SaaS dashboards — see `docs/UI/kanban1.png`/`kanban2.png` references), rather than staying scoped to a single household.
- Decided to adopt **TypeScript** for this next project. Retrofitting TS onto this repo's existing JS Sequelize models and Vue components would be messier than starting fresh.
- A new, clean repo also means a better-looking portfolio artifact — doesn't carry "started as a household chore app" history in its git log.

**This repo's job now:** stand as a complete, clean homework2 submission artifact. Not being developed further.

---

## What was actually built (technical recap)

**Data model:**
- `HouseholdMember` — `id`, `name` (unique). No auth, no roles — flat, fixed set of people.
- `Chore` — `title`, `status` (enum: `todo`/`in_progress`/`done`), `recurrenceType` (enum: `one_off`/`recurring`), `recurrenceInterval` (nullable, days — only meaningful for recurring), `dueDate` (nullable date), `timeEstimate` (enum: `quick`/`medium`/`big`), `claimedById` (nullable FK → HouseholdMember, `SET NULL` on delete), `lastUpdatedAt` (auto-managed by Sequelize), `lastCompletedAt` (nullable). Plus two *computed* (not stored) instance methods: `isStale()`/`daysStale()` — a chore is stale if non-done and untouched 3+ days.
- Every field's nullability traces directly back to PRD language (documented in `docs/data-modeling-from-requirements.md` in this repo, a genuinely reusable method if the team-kanban PRD gets written carefully too — worth rereading before writing the new one) — e.g. `claimedById: null` isn't "missing data," it *is* the unclaimed-pool state itself.

**Core features built, end to end:**
1. **Kanban board** — `GET /api/board` groups chores into buckets by status/claim-state. UI surfaces 3 columns (Unclaimed / In Progress / Done); the backend also computes a 4th bucket (`claimedTodo` — claimed but status still `todo`) which isn't reachable through the normal claim flow and was deliberately dropped from the UI as redundant, though still present in the API contract.
2. **Claim flow** — pick a member from a dropdown, `POST /chores/:id/claim`. Design decision: claiming also immediately flips `status` to `in_progress` (not just setting the claimant) — otherwise the "In Progress" column would only ever populate via manual admin edits.
3. **Complete flow** — `POST /chores/:id/complete`, branches on `recurrenceType`. One-off chores go to `done` permanently. Recurring chores use a **lazy-reset design**, not an immediate one: on completion they go to `done` first (visibly attributed to whoever completed it, for the rest of that calendar day), and only reset back to `todo` (clearing the claimant, advancing `dueDate` by `recurrenceInterval` days) the *next* time the board is loaded on a later calendar day. This two-step design exists specifically to fix a real bug found mid-build: an immediate reset erases who-completed-it before the nudge/activity-tracking logic can see it, making a genuinely-active member look falsely idle. Full reasoning in `docs/migrations/nudge-design.md`.
4. **Nudge system** — per-member last-activity tracking, folded into the board response (not a separate endpoint). Flags a member if their most recent claim/complete activity is 5+ days old (`NUDGE_AFTER_DAYS`), or if they have zero activity ever. A **considered-but-explicitly-rejected** idea from this build: a "this person is the sole holder of a recurring chore" warning — rejected because on reflection it reads as workload-fairness scoring, which conflicts with the PRD's explicit non-goal of avoiding fairness algorithms. Worth remembering if team-kanban's bigger, multi-person scope tempts a similar feature back in — the same tension (coverage-risk signal vs. fairness scoring) will likely resurface and deserves the same scrutiny.

**Architecture as built:**
- **Backend:** Express 5, layered as `routes/` (thin, HTTP-only) → `services/` (business logic, e.g. `boardService.js` holds grouping + nudge computation + the lazy-reset check) → `models/` (Sequelize). Zod for request validation. One centralized error-handling middleware (`{ error: string }` response shape everywhere, Sequelize validation errors mapped to 400, everything else to 500 with message hidden outside dev mode).
- **Frontend:** Vue 3 Composition API, PrimeVue component library (chosen over Vuetify/shadcn-vue specifically for its component breadth + customization headroom — full reasoning in `docs/UI/` if that decision needs revisiting). Logic lives in a `composables/useBoard.js`-style pattern (owns board state + API calls), components stay "dumb" — they receive data and functions as props from their parent, never fetch anything themselves. Only the top-level `App.vue` touches the API/composable layer directly.
- **Design system:** teal (`#0D9488`) + burnt orange (`#EA580C`) on a light mint background, Plus Jakarta Sans — generated via a tool pass then hand-curated after two automated attempts mismatched the actual product category (don't trust an automated design-system generator's category-matching blindly; verify it against what the product actually is before building on it).
- **Infra:** pnpm workspace monorepo (`backend`/`frontend` as sibling packages), PostgreSQL + Sequelize, dev/test databases kept physically separate specifically because tests run `sequelize.sync({ force: true })` (would nuke dev data if pointed at the same DB).

**Non-obvious lessons worth carrying forward** (each cost real debugging time once, shouldn't cost it twice):
- Sequelize CLI (`.sequelizerc`, migration files, its own config file) loads everything via plain `require()` — these specific files must stay CommonJS even inside an otherwise-ESM (`"type": "module"`) project. Fix pattern: either `.cjs` extension, or a folder-local `package.json` with `{"type": "commonjs"}` override. Models/routes/everything else can be normal ES6 `import`/`export`.
- `NODE_ENV` must be set *before* Node starts (in the npm/pnpm script itself, e.g. `"test": "NODE_ENV=test vitest"`), not inside a setup file that imports the module depending on it — ES module imports are hoisted and evaluated before any other code in the same file runs, so setting it too late is a real, silent correctness risk (tests could point at the wrong database).
- Vitest runs test *files* in parallel by default — if multiple files' `beforeAll` hooks all run `sync({ force: true })` against the same shared test DB, they race and produce confusing Postgres errors (enum dependency conflicts, etc.). Fix: `fileParallelism: false` in `vitest.config.js`.

---

## User's current learning condition (as of this handoff)

- This household-kanban build was **the user's first deep hands-on experience** with: Express, Sequelize, PostgreSQL migrations, Vue 3 Composition API, PrimeVue, and REST API design from scratch. Built via heavy AI-assisted pairing — the user wrote code themselves with guidance/code-review, rather than having code generated wholesale for them (explicit preference: hands-off from the AI except for review/navigation, confirmed multiple times through this build).
- This will be the user's **3rd full-stack project overall**, and **2nd one built solo** (previous experience includes one team-based project — some prior exposure to full-stack concepts, but this household-kanban build was their first solo end-to-end ownership).
- **Explicit career goal: landing a Software Engineer job.** Technology choices should be weighed by job-market relevance and learning value, not "collecting frameworks" for its own sake. (This is *why* React/Next wasn't chosen for the immediate next project despite higher market demand — decided to bank that for a project *after* this one, since switching frontend frameworks now would add a steeper learning curve on top of an already-larger scope. TypeScript *was* adopted now, since it's judged higher-value and more universally transferable than framework choice.)
- Genuinely still learning fundamentals — hit real confusion points throughout this build (ESM vs CommonJS module boundaries, Vue props/slots/parent-child communication, async timing bugs, Postgres/Docker networking). Responds well to: being told to slow down when overwhelmed, concrete toy-example analogies before applying a concept to real code, and mixed Indonesian/English explanation when stuck. Appreciates direct, low-fluff communication generally (works well in "caveman mode" / terse technical style) but needs normal, unhurried explanation specifically when confused or discouraged — don't compress encouragement/clarification moments.
- Values understanding the "why" deeply, not just copy-pasting fixes — has asked repeatedly for the underlying mechanism (e.g. why `v-model` binds by exact variable name, why Sequelize instance methods don't survive `.toJSON()`, how OpenAPI-from-Zod actually works) rather than just accepting a fix.

---

## Scope for the team-kanban project (full wishlist, to be sequenced via proper brainstorming in the new repo)

Decomposed already (see decomposition discussion in this repo's final conversation) into roughly this order:

1. ~~OpenAPI contract for existing API~~ — done in this repo (`openapi.yaml`), as a format-learning exercise.
2. **Team-kanban product design** — PRD, TRD, data model/schema. *Explicitly deferred to be discussed properly in the new repo's own brainstorming session* — not pre-decided here. Known constraints: multi-user/team concept (vs. single fixed household), SaaS-dashboard-style UI (sidebar nav, richer visual hierarchy — see reference screenshots in `docs/UI/kanban1.png`/`kanban2.png` from this repo).
3. **Containerization + CI/CD** — Docker (multi-stage builds), Docker Compose, GitHub Actions (lint/test/build gates). Pulled from the DataTalksClub Homework 3 scope (`docs/homework3.md` in this repo) — not being submitted, but the skill content is the goal.
4. **Observability + incident response + security** — OpenTelemetry (metrics/traces/logs) → Prometheus + Loki + Tempo → Grafana dashboards; alerting with real context; a headless coding-agent-as-first-responder pattern (read-only, allowlisted, gated by autonomy policy); recurring security audits (Semgrep + model review + human validation); agent supply-chain inventory (Snyk Agent Scan). Pulled from Homework 4 scope (`docs/homework4.md` in this repo).
5. **Load testing with k6** — user's own addition, not from the homework curriculum. Real-world SaaS-readiness practice: load/perf testing the API before or alongside the observability work.
6. **TDD practice** — explicit methodology shift from this project. The household-kanban backend tests were written *after* the implementation (test-after). User wants to practice proper test-driven development (test-first) on the team-kanban rebuild — write the failing test, then the minimal code to pass it, then refactor.

**Stack decisions already locked in** (confirmed via direct discussion, not to be re-litigated unless something concrete changes):
- Backend: Express (staying, not switching to NestJS/Hono — job-market gain from switching backend frameworks judged smaller than the cost)
- Frontend: Vue (staying, not switching to React/Next — banked for a *future* project instead)
- **New for this project: TypeScript**, both frontend and backend
- Database: PostgreSQL + Sequelize (carried forward, worked well)
- UI library: PrimeVue (carried forward — chosen originally for component richness + customization headroom over Vuetify/shadcn-vue, reasoning preserved in this repo's `docs/UI/` if needed again)
- Package manager: pnpm, workspace-based monorepo (`server`/`client` or similar sibling structure — exact layout to be re-decided fresh, don't assume naming carries over)

---

## What to actually do when starting the new repo's session

1. Create the new repo in `~/Documents/my_playground/` (name TBD — pick something reflecting "team kanban," not reusing "HouseholdCore").
2. Start a proper brainstorming session (per `superpowers:brainstorming` skill) for the **team-kanban product design** sub-project specifically — PRD, TRD, data model/schema are all open and meant to be discussed fresh, not assumed from this document.
3. Reference this repo's `docs/migrations/` folder (`migration-steps.md`, `data-layer-setup.md`) as a runbook for known gotchas already solved once (pnpm workspace setup, Postgres role/auth config, ESM/CommonJS boundaries with Sequelize CLI, PrimeVue version/licensing issue) — round two should go faster since these are now documented, not rediscovered blind.
4. Don't assume this document's "scope wishlist" ordering is final — it's a starting proposal, meant to be properly sequenced (one sub-project brainstormed and spec'd at a time, per the brainstorming skill's own decomposition discipline) rather than attempted all at once.
