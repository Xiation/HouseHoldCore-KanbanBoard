# Nudge Feature Design — Iteration Log

How the MVP4 "passive accountability nudge" design evolved past its original spec, and why. Captures a real design conversation, not just the final answer — worth keeping the reasoning, not just the conclusion.

---

## 1. Original Spec (as first planned)

From `docs/fullstack-build-plan.md`: fold nudge data into `GET /api/board`'s response as a `nudges` array. Per member, find their most recent activity (claiming or completing a chore) and flag them if nothing in `NUDGE_AFTER_DAYS` (5) days.

```json
"nudges": [{ "memberId": 3, "name": "Carol", "daysSinceActivity": 6 }]
```

---

## 2. The Gap We Found

The naive implementation — "find chores where `claimedById = member.id`, take the max `lastUpdatedAt`" — has a real blind spot for **recurring** chores specifically.

Per the `complete_chore` route spec: completing a *recurring* chore resets `status` to `todo` and **clears `claimedById` to `null`**, in the same write that sets `lastCompletedAt`. The moment that happens, the row no longer points back to whoever completed it — there's no history table, no audit log, just this one row. A member could complete a recurring chore and, if they touch nothing else, the nudge query would have zero evidence they were ever active — a false negative that directly undermines the feature's purpose (it's meant to build trust/transparency, not falsely suggest someone's been idle).

(One-off chores don't have this problem — completing one leaves `claimedById` untouched, so the attribution survives.)

---

## 3. Solution Candidates Considered

**Option A — Accept the limitation.** Document it as a known edge case, given `NUDGE_AFTER_DAYS = 5` is a wide window; the failure only bites if a member's *only* activity in a 5-day span is completing one recurring chore and nothing else. Rejected as the sole fix — the scenario is narrow but the whole point of this feature is not misjudging people, so worth actually solving.

**Option B — Delayed/lazy reset (chosen).** Instead of resetting a recurring chore's `status`/`claimedById` immediately upon completion, let it sit in `done` (still attributed to whoever completed it) until the *next calendar day*. The actual reset happens lazily — checked inside the `GET /api/board` query itself (or any request touching that chore): "is this recurring chore `done`, and is `lastCompletedAt`'s calendar date earlier than today? If so, reset it now, before building the response." No cron job or background scheduler needed — the reset is a side effect of the next read that happens to notice it's overdue.

Chosen because it directly solves the real worry (a family member being misjudged as idle *the same day* they did something) without any schema changes, matching the PRD's "keep it lightweight" stance.

**Option C — Occurrence-log model (textbook-correct, deferred).** Instead of one mutable row per chore that gets reset in place, model each *completion* as its own permanent record (e.g. a separate `ChoreCompletions` table). Nothing would ever be erased — full history, forever. This is the architecturally "correct" way real recurring-task systems (habit trackers, calendar recurrence engines) usually solve this class of problem. Deferred for this project: it's a genuine schema restructuring (new table, new model, touches the board query, the complete route, and seed data), more than this project's current scope calls for. Worth remembering as the answer if this project ever needs real historical reporting ("what did Alice do this month").

---

## 4. Final Design: Split Nudge Mechanism

Rather than one nudge signal for everything, split by `recurrenceType` — they're genuinely different concerns with different natural rhythms:

- **One-off nudge** — unchanged from the original spec. Multi-day threshold (`NUDGE_AFTER_DAYS`), signals long-term disengagement. Makes sense for one-off chores, which tend to be bigger, schedulable tasks (groceries, plumbing) with a naturally longer check-in cadence.

- **Recurring nudge** — a same-day accountability check instead, evaluated after a cutoff time (e.g. 20:00 local time — exact hour still to be picked when implemented). For each member currently holding a recurring chore, check whether `lastCompletedAt` falls on *today's* date by the time the cutoff has passed. If not, that's a distinct nudge signal — not "you've vanished for days," but "you haven't done today's thing yet, and it's getting late." This mechanism directly depends on Option B's delayed reset — the chore needs to still be attributed to that member (not yet reset to `todo`/unclaimed) for this same-day check to have anything to look at.

Both nudge types feed into the same `nudges` array in the board response, but likely need a `type` field (`'inactive'` vs `'recurring_incomplete'`, naming TBD) so the frontend can render them differently if desired (this project's UI decision, not decided yet).

---

## 5. Considered and Rejected

**Per-member "only holding one recurring chore" warning.** Raised as an idea, then re-examined: the underlying question was ambiguous between two readings — (a) a coverage/single-point-of-failure risk signal ("if this one thing gets dropped, nothing backs it up"), vs. (b) a workload-fairness signal ("this person is doing less than others"). On reflection, this reads closer to (b), which directly conflicts with the PRD's explicit non-goal: *"Not solving strict fair division of labor (no scoring, leaderboards, or workload balancing algorithms)"* (`docs/PRD.md` §4). Dropped for that reason — noted here rather than silently discarded, in case the coverage-risk framing (reading (a)) is worth revisiting later as a genuinely distinct, non-fairness-related idea.

---

## 6. Implementation Notes (for whoever writes Option B's lazy-reset check)

Pseudocode shape, to be written into `src/routes/board.js` (or a helper it calls) as part of Phase 3:

```
for each recurring chore where status = 'done':
  if lastCompletedAt's calendar date < today's calendar date:
    set status = 'todo'
    set claimedById = null
    advance dueDate by recurrenceInterval (from existing dueDate)
    save
```

Run this *before* building the board-grouping response, so the reset chore correctly lands in the right bucket for the request that triggers it. This logic effectively replaces the *immediate* reset that used to happen inside `complete_chore` itself — worth deciding whether `complete_chore` still does the reset immediately (old behavior) or defers it entirely to this lazy check (new behavior) — recommend the latter, since having two different places that can reset a recurring chore back to `todo` would be confusing and worth avoiding.
