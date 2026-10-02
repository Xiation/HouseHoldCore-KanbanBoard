# Translating a PRD into a Data Model — Method + Applied Example

How to go from natural-language requirements to concrete schema decisions (which fields exist, which are required, which are enums, which relationships exist). Illustrated using this project's own `docs/PRD.md` → `Chore`/`HouseholdMember` schema as the worked example. Companion to `docs/testing-scenarios.md`, which does the same kind of "method + applied example" for test design instead of schema design.

---

## The Method

### 1. Extract nouns → candidate entities
Read the PRD's core user flow and functional requirements. Recurring nouns that have their own identity and lifecycle become candidate tables/models. Adjectives describing those nouns become candidate fields.

*Applied:* PRD §6 ("Core User Flow") repeatedly names **chore** and **household member** as first-class things with their own state (a chore has a status, a member has activity history) — these became `Chore` and `HouseholdMember`. Something like "time estimate" is never referred to with its own identity or lifecycle — it's always an attribute *of* a chore — so it became a field (`time_estimate`), not a separate table.

> Actual PRD text (§5, Target Users): "Members of a single, fixed household (roommates or family)" — and (§6, step 1): "User opens the board and sees all chores across columns." Two nouns doing all the identity-carrying work across the whole document: **chore**, **member**.

### 2. Extract required identifying/rendering fields
For each entity, ask: *"what must this thing have to be displayed or used at all?"* Requirements phrased as "show X" or "display X" name required fields.

*Applied:* FR2 says cards must show "title, claimant (if any), due date, staleness/overdue indicator, rough time estimate." Parse that list item by item — "title" has no hedge, it's unconditionally required → `allowNull: false`. "time estimate" is also stated as a flat requirement, no hedge → required. Compare to the next rule.

> Actual PRD text (FR2): "Chore cards show: title, claimant (if any), due date, staleness/overdue indicator, rough time estimate (quick/medium/big)." Note the punctuation itself is doing work here — every item in that list is a required field to *display*, but only one of the five carries a hedge in parentheses.

### 3. Watch for hedge words — they mark optional fields
Phrases like **"(if any)"**, **"if applicable"**, **"if present"** are the PRD telling you a field is optional, in plain language, before you ever touch a schema.

*Applied:* FR2's "claimant (if any)" is the PRD explicitly saying: a chore might not have a claimant. That hedge is the direct source of `claimed_by`'s nullability — not a guess, not a Sequelize convention, a literal reading of the requirement text.

> Actual PRD text (FR2): "...claimant (if any)..." — three words in parentheses, and that's the entire justification for `claimed_by: { allowNull: true }`.

### 4. State/lifecycle language → enums with a default
Words like **"status,"** **"flagged as,"** **"one-off or recurring,"** or an enumerated list ("To Do → In Progress → Done") signal a field with a small fixed set of legal values. The natural "starting" value in that list becomes the default.

*Applied:* PRD §6 step 1 lists "To Do → In Progress → Done" as a sequence — that's `status`, an enum, defaulting to the first state (`todo`, since every new chore starts there). FR3 says chores are "flagged as one-off or recurring at creation" — that's `recurrence_type`, an enum, with `one_off` as the simpler default.

> Actual PRD text (§6, step 1): "User opens the board and sees all chores across columns (e.g., To Do → In Progress → Done)." Actual PRD text (FR3): "Chores can be flagged as one-off or recurring at creation." Both sentences name a closed set of exactly two or three options — that closedness is what makes them enum candidates rather than free-text `STRING` fields.

### 5. Conditional language → nullable-with-meaning, not nullable-by-laziness
Phrases like **"only used if X,"** **"only applies when Y"** mark fields that are nullable *because the underlying concept doesn't universally apply* — different from a field being merely optional to fill in.

*Applied:* `plan.md`'s own field notes literally say `recurrence_interval (nullable — e.g. days, only used if recurring)`. That phrase is doing the schema design for you — read it literally and the nullability decision is already made. This distinction matters at query time too: a null `recurrence_interval` on a one-off chore isn't missing data needing a follow-up, it's a correctly-shaped record.

> Actual `plan.md` text (Phase 1, Models section): "`recurrence_interval` (nullable — e.g. days, only used if recurring)." This one isn't even inference — the plan states the nullability decision as a literal parenthetical, word for word.

### 6. Absence-as-state language → null is load-bearing, not a gap
Watch for the PRD describing an *absence* as a first-class state of the system, using words like **"unclaimed,"** **"open pool,"** **"no owner yet."** When null itself represents a meaningful state that the rest of the system branches on, that's a stronger signal than ordinary optionality — the nullability isn't cosmetic, core business logic depends on being able to check for it.

*Applied:* FR5/FR6 describe an "open pool" of unclaimed chores as a first-class concept the UI must visually separate from claimed ones. `claimed_by IS NULL` isn't "we don't know who claimed it yet" — it *is* the unclaimed-pool membership test. This is the single most important nullability decision in the whole schema, because a large chunk of the app's actual logic (the board's grouping query, the claim endpoint's guard clause) is written directly in terms of this null check.

> Actual PRD text (FR5): "Unclaimed chores are visually separated from claimed chores (open pool vs. personal cards)." Actual PRD text (§6, step 2): "Unclaimed chores sit in an open pool; claimed chores show the claimant's name." "Open pool" is named twice, independently, as a real thing the system has — not an edge case, a designed-for state.

### 7. Explicit non-goals → resist adding constraints the PRD doesn't ask for
A PRD's "Non-Goals"/"Out of Scope" section, or language like **"keep it lightweight,"** **"no rigid X,"** is a signal to *not* add fields, required-ness, or structure beyond what's asked — even if it would feel more "complete" as a data modeler.

*Applied:* PRD §3 says "Keep the system lightweight — no rigid assignment hierarchy." That's why `due_date` is nullable rather than mandatory — forcing every chore to have a deadline would be exactly the kind of rigidity the PRD explicitly disclaims, even though "every task should have a due date" might feel like reasonable default schema hygiene in a vacuum.

> Actual PRD text (§3, Goals): "Keep the system lightweight — no rigid assignment hierarchy, no complex fairness algorithm." Actual PRD text (§4, Non-Goals): "Not solving strict fair division of labor (no scoring, leaderboards, or workload balancing algorithms)." Neither sentence mentions `due_date` by name — this is the method's one genuinely inferential step: recognizing that a *stated design philosophy* constrains fields the PRD never explicitly discusses.

### 8. Verbs describing events → timestamps that are null until the event happens
Verbs like **"completed,"** **"claimed,"** **"last updated"** imply a timestamp field. If the event hasn't necessarily happened yet for a given record (a brand-new chore has never been completed), that timestamp must be nullable — null correctly means "hasn't happened," not "unknown."

*Applied:* FR4's completion logic implies tracking *when* a chore was last completed → `last_completed_at`, nullable, because new chores have never been completed.

> Actual PRD text (FR4): "Recurring chores auto-reset to To Do on their defined schedule after being marked Done." The word "schedule" implies a clock is running from *some* reference point — that reference point is `last_completed_at`, which the requirement never names directly but structurally requires for the reset logic to be computable at all.

### 9. Cross-check every functional requirement against the schema (traceability)
Once you have a draft schema, go back through the FR table one row at a time and ask: *"which field(s) does this requirement depend on, and does my schema actually support it?"* This catches gaps the noun/hedge-word scan might miss. This is the same discipline as a requirements traceability matrix in formal requirements engineering — every requirement should point to at least one concrete field or relationship, and every field should trace back to at least one requirement (otherwise, why does it exist?).

*Applied, briefly:* FR7 (nudge if inactive) doesn't map to any single field — it maps to a *query* across existing fields (`claimed_by`, `last_completed_at`) rather than a new column. That's a useful outcome of this check too: not every requirement needs new schema, sometimes it needs new logic over data you already modeled correctly.

> Actual PRD text (FR7): "System surfaces a lightweight nudge/indicator when a member hasn't claimed a chore in a defined period." No new noun, no new attribute named — just a time-boxed absence of activity, computable entirely from fields that already exist for other reasons. This is the traceability check catching a case where the naive move (add a `lastNudgedAt` column to `HouseholdMember`) would have been unnecessary schema bloat.

---

## Quick Reference Table

| Signal in the PRD text | What it tells you | Example from this project |
|---|---|---|
| Flat "show X" with no hedge | Required field | `title`, `time_estimate` |
| "(if any)" / "if applicable" | Nullable field | `claimed_by` |
| Named sequence of states / "flagged as A or B" | Enum + default = first/simplest state | `status`, `recurrence_type` |
| "only used if / only applies when" | Nullable-with-meaning (conditionally relevant) | `recurrence_interval` |
| "unclaimed" / "open pool" / absence described as a state | Null is load-bearing — core logic will branch on `IS NULL` | `claimed_by` (again — it satisfies two rules at once) |
| "lightweight" / explicit non-goals | Don't add constraints beyond what's asked | `due_date` stays optional |
| Verb describing an event that may not have happened yet | Nullable timestamp | `last_completed_at` |
| Every FR row | Should trace to a field, a relationship, or a query — checked last, catches gaps | FR7 → a query, not a new column |

This whole method is really just **systematic close-reading** — the PRD, if written with any care, is already encoding most of these decisions in its word choices. The skill isn't inventing the right schema from scratch; it's noticing which words in the requirements doc were doing schema-design work without announcing it as such.
