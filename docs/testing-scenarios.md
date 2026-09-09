# Finding Test Scenarios — Method + Applied Example

How to derive test scenarios for any codebase, illustrated with this project's Phase 4 (claim/complete flow) as a worked example.

---

## The Method

1. **Read the spec/PRD for stated rules.** Every explicit business rule is a test. If the PRD says "recurring chores reset on completion," that sentence *is* a test case waiting to be written.
2. **Walk the code's branches.** Every `if`/`else`, every loop's empty case, every early return is a fork. If you can draw a flowchart of a function, each path through it is a scenario.
3. **Check boundary values.** Exactly at a threshold, one below, one above. Zero-length lists. `None`/null fields. Off-by-one is the most common real-world bug class.
4. **Map state transitions.** Anything with a lifecycle (e.g. `todo` → `in_progress` → `done`) needs a test per transition — and a test for *invalid* transitions (can you complete something twice? claim something already claimed?).
5. **Mine bug history.** In real teams, recurring incident categories become permanent regression tests — "we got burned by X once, now X always has a test."
6. **Think adversarially.** Wrong actor, missing/malformed input, wrong HTTP verb, concurrent access. What happens if someone does the *wrong* thing, not just the right thing.
7. **Check cross-cutting concerns.** Auth, permissions, idempotency — ask even if the current project doesn't have them yet (this project has none, but "no auth" is itself worth a note in the test plan so it doesn't surprise later).

### Two formal techniques worth knowing

- **Equivalence partitioning** — group inputs that should behave the same way, test one representative from each group instead of every possible value.
- **Boundary value analysis** — test the edges of each partition (just below / at / just above a threshold), since bugs cluster at edges, not the middle.

Together these two catch most real bugs without needing exhaustive input coverage.

---

## Applied: This Project's Phase 4 Scenarios

Walking `chores/models.py` (`Chore.is_stale`) and `chores/views.py` (`claim_chore`, `complete_chore`) through the method above:

| # | Scenario | Method used |
|---|----------|-------------|
| 1 | Non-done chore older than 3 days → `is_stale` True | Branch (status check) + boundary (threshold) |
| 2 | Non-done chore updated recently → `is_stale` False | Boundary (below threshold) |
| 3 | Done chore, any age → `is_stale` False, `days_stale` 0 | Branch (the `done` short-circuit) |
| 4 | `board_view` groups chores correctly into 4 buckets | Spec rule (PRD: unclaimed pool vs claimed vs in-progress vs done) |
| 5 | Claim on unclaimed chore → sets `claimed_by`, flips to `in_progress` | State transition (todo/unclaimed → in_progress/claimed) |
| 6 | Claim on already-claimed chore → 404 | Invalid state transition + guard condition (`claimed_by__isnull=True` in the query) |
| 7 | Claim via GET → no mutation | Adversarial (wrong HTTP verb) — real bug class: mutating on GET breaks prefetch/back-button and is a CSRF risk |
| 8 | Complete one-off → `done`, `due_date` unchanged, `last_completed_at` set | Branch (`recurrence_type` == one_off) |
| 9 | Complete recurring → `todo`, `claimed_by` cleared, `due_date` advanced, `last_completed_at` set | Branch (`recurrence_type` == recurring) + spec rule |

**Known gap:** scenario 6 only proves a *sequential* double-claim is rejected — it doesn't test a race condition (two POSTs landing at the same instant). Not worth solving for this project's scale, but worth knowing it's an unclosed gap rather than pretending it's covered.

---

## From Scenario to Code

Each row above became one test method in `chores/tests.py`. Showing the actual code so you can see how "method step" maps to "assertion" — this is the part that's easy to understand in theory and fuzzy in practice until you see it written out.

### Boundary value analysis → threshold tests (scenarios 1-3)

`STALE_AFTER_DAYS = 3` in the model is the boundary. Test both sides of it, plus the special-case branch (`done`) that short-circuits the boundary check entirely:

```python
class ChoreStalenessTests(TestCase):
    def _make_chore(self, status=Chore.Status.TODO, days_old=0):
        chore = Chore.objects.create(
            title="Test chore", status=status, time_estimate=Chore.TimeEstimate.QUICK
        )
        # backdate last_updated_at directly via .update() — .save() would
        # re-trigger auto_now and overwrite our backdating
        Chore.objects.filter(pk=chore.pk).update(
            last_updated_at=timezone.now() - datetime.timedelta(days=days_old)
        )
        chore.refresh_from_db()
        return chore

    def test_stale_when_old_and_not_done(self):          # scenario 1: past threshold
        chore = self._make_chore(days_old=4)
        self.assertTrue(chore.is_stale)

    def test_not_stale_when_recent(self):                 # scenario 2: under threshold
        chore = self._make_chore(days_old=1)
        self.assertFalse(chore.is_stale)

    def test_done_chore_never_stale(self):                # scenario 3: branch short-circuit
        chore = self._make_chore(status=Chore.Status.DONE, days_old=10)
        self.assertFalse(chore.is_stale)
        self.assertEqual(chore.days_stale, 0)
```

Note the `days_old=10` in the last test — deliberately *far* past the threshold, to prove the `done` branch wins even when the naive staleness math would say otherwise. That's the "branch" method step, not the "boundary" one — two different techniques applied to the same function.

### Spec rule → direct assertion (scenario 4)

The PRD states the board splits into 4 buckets. The test just recreates one of each bucket and checks the view's context matches — no clever technique needed, just transcribing the stated rule:

```python
class BoardViewTests(TestCase):
    def setUp(self):
        self.alice = HouseholdMember.objects.create(name="Alice")
        self.unclaimed = Chore.objects.create(title="Unclaimed chore", ...)
        self.claimed_todo = Chore.objects.create(title="Claimed todo", claimed_by=self.alice, ...)
        self.in_progress = Chore.objects.create(title="In progress chore", status=Chore.Status.IN_PROGRESS, ...)
        self.done = Chore.objects.create(title="Done chore", status=Chore.Status.DONE, ...)

    def test_board_groups_chores_correctly(self):
        response = self.client.get(reverse("board"))
        self.assertIn(self.unclaimed, response.context["unclaimed"])
        self.assertIn(self.claimed_todo, response.context["claimed_todo"])
        self.assertIn(self.in_progress, response.context["in_progress"])
        self.assertIn(self.done, response.context["done"])
```

### State transition + invalid transition + adversarial verb (scenarios 5-7)

Three different techniques, same feature (`claim_chore`) — this is normal, one function usually needs several angles:

```python
class ClaimChoreTests(TestCase):
    def setUp(self):
        self.alice = HouseholdMember.objects.create(name="Alice")
        self.chore = Chore.objects.create(title="Wash dishes", time_estimate=Chore.TimeEstimate.QUICK)

    def test_claim_sets_claimed_by_and_status(self):       # scenario 5: valid transition
        response = self.client.post(
            reverse("claim_chore", args=[self.chore.id]), {"member_id": self.alice.id}
        )
        self.assertRedirects(response, reverse("board"))
        self.chore.refresh_from_db()
        self.assertEqual(self.chore.claimed_by, self.alice)
        self.assertEqual(self.chore.status, Chore.Status.IN_PROGRESS)

    def test_claim_already_claimed_chore_404s(self):        # scenario 6: invalid transition
        self.chore.claimed_by = self.alice
        self.chore.save()
        bob = HouseholdMember.objects.create(name="Bob")
        response = self.client.post(
            reverse("claim_chore", args=[self.chore.id]), {"member_id": bob.id}
        )
        self.assertEqual(response.status_code, 404)

    def test_claim_via_get_does_not_mutate(self):           # scenario 7: adversarial verb
        self.client.get(reverse("claim_chore", args=[self.chore.id]))
        self.chore.refresh_from_db()
        self.assertIsNone(self.chore.claimed_by)
```

Scenario 6 works *because* the view's own query has the guard baked in (`get_object_or_404(Chore, pk=chore_id, claimed_by__isnull=True)` in `chores/views.py`) — the test is really checking that guard clause, not some separate validation layer. Worth noticing: the test only exists because we walked the query's `filter` kwargs as a branch, per method step 2.

### Branch coverage on both sides of an if/else (scenarios 8-9)

`complete_chore` has exactly one `if/else` (`recurrence_type`) — textbook case for "both sides need a test":

```python
class CompleteChoreTests(TestCase):
    def test_complete_one_off_marks_done(self):             # scenario 8: if-branch
        chore = Chore.objects.create(
            recurrence_type=Chore.RecurrenceType.ONE_OFF,
            due_date=datetime.date(2026, 1, 1),
            status=Chore.Status.IN_PROGRESS,
            claimed_by=self.alice, ...
        )
        self.client.post(reverse("complete_chore", args=[chore.id]))
        chore.refresh_from_db()
        self.assertEqual(chore.status, Chore.Status.DONE)
        self.assertEqual(chore.due_date, datetime.date(2026, 1, 1))  # unchanged
        self.assertIsNotNone(chore.last_completed_at)

    def test_complete_recurring_resets_and_advances_due_date(self):  # scenario 9: else-branch
        chore = Chore.objects.create(
            recurrence_type=Chore.RecurrenceType.RECURRING,
            recurrence_interval=7,
            due_date=datetime.date(2026, 1, 1),
            status=Chore.Status.IN_PROGRESS,
            claimed_by=self.alice, ...
        )
        self.client.post(reverse("complete_chore", args=[chore.id]))
        chore.refresh_from_db()
        self.assertEqual(chore.status, Chore.Status.TODO)
        self.assertIsNone(chore.claimed_by)
        self.assertEqual(chore.due_date, datetime.date(2026, 1, 8))  # advanced by interval
        self.assertIsNotNone(chore.last_completed_at)
```

The `due_date` assertion is doing double duty in both tests — in test 8 it proves *nothing* moved (one-off shouldn't touch the date), in test 9 it proves the *exact* arithmetic (`2026-01-01 + 7 days = 2026-01-08`). Same field, opposite claim, because that's what the branch actually does differently.

Full suite: `uv run python manage.py test` → `Ran 9 tests ... OK`.

---

## Where This Generalizes

Outside this toy project, in a real team, this process is usually informal — pairing with PM/QA, or built from experience — unless the team runs a formal test-design pass (common in regulated or safety-critical domains). The 7-step checklist above is a compressed version of what that formal pass looks like. Cheapest high-leverage habit: whenever you write an `if`, ask "have I got a test for both sides of this?" before moving on.
