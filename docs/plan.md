# Development Plan: Household Chore Coordination Board

**Stack:** Django (backend + server-rendered templates), SQLite (dev), vanilla JS/CSS for interactivity. No separate frontend framework — Django handles routing, data, and rendering.

This plan follows the MVP build order from the PRD: **Board → Cards → Claim/Complete loop → Nudge logic**, wrapped by a setup phase and a polish/deploy phase.

---

## Phase 0 — Project Setup
**Goal:** Working Django skeleton, ready to build features into.

- `django-admin startproject choreboard` + `python manage.py startapp chores`
- Configure SQLite (default) for local dev
- Base template (`base.html`) with shared layout, nav, and static file loading
- Set up static files (CSS, JS) and Django admin site enabled
- Add household members as a fixed, seedable dataset (see Phase 1)

**Done when:** Django dev server runs, base template renders, admin site is accessible.

---

## Phase 1 — Data Layer (supports MVP1 & MVP2)
**Goal:** Models that capture everything a card/board needs.

**Models:**
- `HouseholdMember` — name (fixed set, seeded via fixture or admin, no auth complexity needed for v1)
- `Chore`:
  - `title`
  - `status` (choices: `todo`, `in_progress`, `done`)
  - `recurrence_type` (choices: `one_off`, `recurring`)
  - `recurrence_interval` (nullable — e.g. days, only used if recurring)
  - `due_date`
  - `time_estimate` (choices: `quick`, `medium`, `big`)
  - `claimed_by` (FK to `HouseholdMember`, nullable — null = in the unclaimed pool)
  - `last_updated_at` (auto, drives staleness)
  - `last_completed_at` (nullable)

- Register both models in Django admin for fast manual testing/seeding
- Write a fixture or management command to seed demo chores + members

**Done when:** You can create/edit chores and members via `/admin/` and see them in the DB shell.

---

## Phase 2 — Kanban Board (MVP1)
**Goal:** The board renders, columns show real data.

- View: query all chores, group by `status`
- Template: three columns (To Do / In Progress / Done)
- Within "To Do," visually split into **Unclaimed pool** (claimed_by is null) vs **Claimed** cards
- Basic CSS grid/flexbox layout — no drag-and-drop yet, just correct grouping

**Done when:** Board loads and correctly sorts seeded chores into the right columns/sections.

---

## Phase 3 — Chore Cards (MVP2)
**Goal:** Each card shows the right info at a glance.

- Card partial template (`_chore_card.html`) showing: title, claimant (or "Unclaimed"), due date, time estimate badge
- Model property `is_stale` (e.g. `True` if `last_updated_at` older than N days and status ≠ done) or `days_stale` for a numeric badge
- Style staleness visually (e.g. color-coded border/badge) — no JS needed, computed server-side per request

**Done when:** Cards visually communicate status, effort, and staleness without opening a detail view.

---

## Phase 4 — Claim & Complete Flow (MVP3)
**Goal:** The core interaction loop works end-to-end.

- `POST` endpoint: **Claim** — sets `claimed_by` on an unclaimed chore, moves it out of the pool
- `POST` endpoint: **Mark Done** — branches on `recurrence_type`:
  - one_off → status = `done`, stays there
  - recurring → status resets to `todo`, `claimed_by` cleared, `due_date` advanced by `recurrence_interval`, `last_completed_at` updated
- Keep interaction simple for v1: buttons on each card ("Claim" / "Mark Done"), plain form POSTs with redirect back to board (no need for AJAX/drag-and-drop unless time allows — can be a stretch goal)

**Done when:** Claiming and completing chores updates the DB and board correctly, including the recurring reset logic.

---

## Phase 5 — Passive Accountability Nudge (MVP4)
**Goal:** Board surfaces who's gone quiet.

- Compute per-member "last claimed/completed" timestamp (query across `Chore` by `claimed_by`)
- In the board view, flag members with no activity in N days (define a threshold, e.g. 5 days)
- Render as a small banner or per-member badge on the board — no notifications, purely visual, computed at page load

**Done when:** Seeding a member with no recent activity visibly triggers the nudge on the board.

---

## Phase 6 — Polish & Deploy
**Goal:** Demo-ready.

- Styling pass (plain CSS or Bootstrap via CDN — keep it simple, this isn't the portfolio's focus)
- Finalize seed data so the demo tells a clear story (some stale chores, some claimed, some recurring)
- README: setup instructions, screenshots, brief architecture note
- Deploy (Render, Railway, or PythonAnywhere all support Django cheaply/free) — or document local run steps if deployment isn't required for the camp submission

**Done when:** A stranger can clone the repo, run it, and understand the tool in under 2 minutes.

---

## Suggested Order of Work
1. Phase 0 → 1 (foundation, unglamorous but everything depends on it)
2. Phase 2 → 3 (get something visible fast — good for early demo checkpoints)
3. Phase 4 (the actual "coordination" mechanic — this is the heart of the PRD)
4. Phase 5 (the differentiator vs. a plain kanban clone)
5. Phase 6 last, always

**Stretch goals (only if time remains):** AJAX-based claim/complete (no page reload), drag-and-drop between columns via SortableJS, simple per-member login instead of a member-picker dropdown.