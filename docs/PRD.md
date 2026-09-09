# PRD: Household Chore Coordination Board

## 1. Overview
A shared, visual coordination tool that lets household members see at a glance who's doing what chore, what's still open, and what's falling behind — without acting as a strict task-assignment or fairness-scoring system.

## 2. Problem Statement
In shared households, chores often go undone or get duplicated not because people are lazy, but because there's no shared visibility into what needs doing, what's already claimed, and what's been sitting untouched. Existing solutions (spreadsheets, group chats) don't surface this at a glance.

## 3. Goals
- Give the household a single shared view of all chores and their status
- Make it obvious what's unclaimed vs. claimed vs. done
- Surface staleness/overdue chores so nothing silently falls through
- Keep the system lightweight — no rigid assignment hierarchy, no complex fairness algorithm

## 4. Non-Goals
- Not solving strict fair division of labor (no scoring, leaderboards, or workload balancing algorithms)
- Not a reminder/notification system (out of scope for v1)
- Not multi-household/multi-tenant — single fixed household per board
- Not role-based (no "manager" vs. "worker" permission model)

## 5. Target Users
- Members of a single, fixed household (roommates or family) — real or hypothetical for demo purposes
- All members have equal visibility and equal ability to act on the board (no admin/owner role)

## 6. Core User Flow
1. User opens the board and sees all chores across columns (e.g., To Do → In Progress → Done)
2. Unclaimed chores sit in an open pool; claimed chores show the claimant's name
3. User claims an open chore (it moves from pool to "mine")
4. User marks a chore Done
   - If one-off: stays Done
   - If recurring: resets to To Do on its schedule
5. Board passively nudges if a household member hasn't claimed anything in a while

## 7. Functional Requirements

| # | Requirement |
|---|---|
| FR1 | Kanban board with configurable columns (e.g., To Do, In Progress, Done) |
| FR2 | Chore cards show: title, claimant (if any), due date, staleness/overdue indicator, rough time estimate (quick/medium/big) |
| FR3 | Chores can be flagged as one-off or recurring at creation |
| FR4 | Recurring chores auto-reset to To Do on their defined schedule after being marked Done |
| FR5 | Unclaimed chores are visually separated from claimed chores (open pool vs. personal cards) |
| FR6 | Any household member can claim an unclaimed chore |
| FR7 | System surfaces a lightweight nudge/indicator when a member hasn't claimed a chore in a defined period |
| FR8 | Household membership is fixed/static (no dynamic multi-household support needed) |

## 8. MVP Scope: 4 Primary Features

**MVP 1 — Kanban Board**
The core visual structure: chores organized into columns showing status at a glance.
- FR1: Kanban board with configurable columns (e.g., To Do, In Progress, Done)
- FR5: Unclaimed chores visually separated from claimed chores (open pool vs. personal cards)

**MVP 2 — Chore Cards**
Each chore surfaces enough info to act on without opening a detail view.
- FR2: Cards show title, claimant (if any), due date, staleness/overdue indicator, rough time estimate (quick/medium/big)
- FR3: Chores flagged as one-off or recurring at creation

**MVP 3 — Claim & Complete Flow**
The core interaction loop that drives coordination.
- FR6: Any household member can claim an unclaimed chore
- FR4: Recurring chores auto-reset to To Do on their defined schedule after being marked Done; one-off chores stay Done

**MVP 4 — Passive Accountability Nudge**
The lightweight "fairness-adjacent" signal that differentiates this from a plain kanban board.
- FR7: System surfaces a nudge/indicator when a member hasn't claimed a chore in a defined period
- FR8: Household membership is fixed/static — nudge logic only needs to track a known, unchanging set of people

**Build order:** Board → Cards → Claim/Complete loop → Nudge logic. Each stage is buildable and demoable on its own before layering the next.

## 9. Out of Scope (v1)
- Notifications/reminders (push, email, etc.)
- Fairness scoring or workload leaderboards
- Multi-household or account-based tenancy
- Role-based permissions

## 10. Success Criteria (for portfolio purposes)
- Board clearly communicates chore status at a glance without needing explanation
- Staleness/nudge logic visibly works in a demo scenario
- Recurring vs. one-off distinction functions correctly
- Clean enough UX/code to demonstrate both frontend judgment and (if full-stack) backend data modeling