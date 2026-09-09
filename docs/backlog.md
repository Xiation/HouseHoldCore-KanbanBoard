# Backlog: Household Chore Coordination Board

Derived from `docs/plan.md` phases 1-6. Phase 0 (project setup) done.

---

## Phase 1 — Data Layer

- [x] Create `HouseholdMember` model (name field, fixed set)
- [x] Create `Chore` model: `title`, `status`, `recurrence_type`, `recurrence_interval`, `due_date`, `time_estimate`, `claimed_by` (FK), `last_updated_at`, `last_completed_at`
- [x] Register `HouseholdMember` + `Chore` in `admin.py`
- [x] Make + run migrations
- [x] Write fixture or management command to seed demo members + chores
- [ ] Verify via `/admin/`: create/edit chores and members

## Phase 2 — Kanban Board (MVP1)

- [x] Board view: query all chores, group by `status`
- [x] `board.html` template: three columns (To Do / In Progress / Done)
- [x] Split "To Do" column into Unclaimed pool vs Claimed
- [x] Basic CSS grid/flexbox layout for columns
- [x] Wire up URL route + link from base nav

## Phase 3 — Chore Cards (MVP2)

- [ ] `_chore_card.html` partial: title, claimant/"Unclaimed", due date, time estimate badge
- [ ] `is_stale` / `days_stale` model property on `Chore`
- [ ] Staleness styling (border/badge color-coded)
- [ ] Time estimate badge styling (quick/medium/big)

## Phase 4 — Claim & Complete Flow (MVP3)

- [x] `POST` endpoint: Claim (sets `claimed_by`, moves out of pool)
- [x] `POST` endpoint: Mark Done, branch on `recurrence_type`:
  - [x] one_off → status `done`
  - [x] recurring → reset `todo`, clear `claimed_by`, advance `due_date`, set `last_completed_at`
- [x] Add Claim/Mark Done buttons to card template
- [x] Wire form POSTs with redirect back to board
- [x] Manual test: recurring reset logic end-to-end

## Phase 5 — Passive Accountability Nudge (MVP4)

- [ ] Query: per-member last claimed/completed timestamp
- [ ] Define staleness threshold (e.g. 5 days no activity)
- [ ] Render nudge banner/badge on board for flagged members
- [ ] Manual test: seed inactive member, confirm nudge triggers

## Phase 6 — Polish & Deploy

- [ ] Styling pass (plain CSS or Bootstrap CDN)
- [ ] Finalize seed data (mix of stale/claimed/recurring chores for demo)
- [ ] Write README: setup steps, screenshots, architecture note
- [ ] Deploy (Render/Railway/PythonAnywhere) or document local run steps

---

## Stretch Goals (only if time remains)

- [ ] AJAX claim/complete (no page reload)
- [ ] Drag-and-drop between columns (SortableJS)
- [ ] Per-member login instead of member-picker dropdown
