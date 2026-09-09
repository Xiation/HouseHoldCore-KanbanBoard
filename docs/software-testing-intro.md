# Software Testing — Practical Primer

General testing concepts, tied back to this project where useful. Pairs with `docs/testing-scenarios.md` (which covers *finding* scenarios) — this doc covers the broader *why/what/how* of testing itself.

---

## 1. Why Test at All

A test is a cheap, repeatable way to ask "does the code still do what I claimed it does?" without a human clicking through the app by hand every time. The value isn't proving code works once — it's catching the moment it *stops* working, usually months later, when someone (often future-you) changes something unrelated and breaks an assumption they didn't know existed.

Tests are also documentation that can't go stale silently — a comment can lie, a passing test (mostly) can't.

---

## 2. The Test Pyramid

A mental model for how much of each test type to write:

```
        /\
       /  \      E2E / UI tests       <- few, slow, brittle, high confidence
      /----\
     /      \    Integration tests    <- some, medium speed
    /--------\
   /          \  Unit tests           <- many, fast, cheap
  /------------\
```

- **Unit tests** — test one function/method in isolation. Fast (milliseconds), no DB/network. Example in this project: `ChoreStalenessTests` (tests `is_stale` purely on model state).
- **Integration tests** — test multiple pieces working together (view + model + DB). Slower, but catches wiring bugs unit tests can't. Example: `ClaimChoreTests` — hits a URL, runs a view, touches the real (test) DB.
- **End-to-end (E2E) tests** — drive the actual browser/UI like a user would (e.g. Selenium, Playwright). Slowest, most realistic, most brittle (a CSS change can break them). We don't have any in this project — would mean spinning up a browser to click "Claim" and watch the DOM update.

Why the pyramid shape: unit tests are cheap to write and pinpoint failures precisely; E2E tests are expensive and vague about *what* broke when they fail. Most of your test count should be at the bottom.

Everything in `chores/tests.py` right now is either a pure unit test (staleness) or a lightweight integration test (Django's `Client` hitting real URLs/views/DB) — no E2E layer, which is normal and fine for a project this size.

---

## 3. Django's Testing Tools (What We're Actually Using)

- **`TestCase`** — Django's test base class. Wraps each test in a DB transaction that's rolled back afterward, so tests don't leak state into each other. This is why `seed_demo_data` output never shows up mixed into test runs — tests get a totally separate, empty test database.
- **`setUp()`** — runs before *every* test method in the class. Use it for data all tests in that class need (see `HouseholdMember.objects.create(name="Alice")` repeated across our test classes).
- **`self.client`** — a fake HTTP client built into `TestCase`. Lets you `.get()`/`.post()` a URL without running a real server — this is what makes our `ClaimChoreTests` an integration test rather than a manual curl session.
- **Assertions** — `assertEqual`, `assertTrue`, `assertIsNone`, `assertRedirects`, etc. Prefer the specific assertion (`assertIsNone(x)`) over the generic one (`assertEqual(x, None)`) — specific assertions give better failure messages.

Run everything: `uv run python manage.py test`. Run one file: `uv run python manage.py test chores.tests`. Run one class: `uv run python manage.py test chores.tests.ClaimChoreTests`. Run one method: append `.test_claim_sets_claimed_by_and_status`.

---

## 4. Anatomy of a Test — Arrange / Act / Assert

Every test, regardless of language or framework, breaks into three parts. Naming them explicitly helps you notice when a test is doing too much or testing the wrong thing:

- **Arrange** — set up the world the test needs (create objects, seed data).
- **Act** — do the one thing being tested (call the function, POST the URL).
- **Assert** — check the result matches expectations.

Here's a real test from `chores/tests.py` with that structure labeled:

```python
def test_complete_recurring_resets_and_advances_due_date(self):
    # --- Arrange ---
    chore = Chore.objects.create(
        title="Recurring chore",
        recurrence_type=Chore.RecurrenceType.RECURRING,
        recurrence_interval=7,
        due_date=datetime.date(2026, 1, 1),
        claimed_by=self.alice,
        status=Chore.Status.IN_PROGRESS,
        time_estimate=Chore.TimeEstimate.QUICK,
    )

    # --- Act ---
    response = self.client.post(reverse("complete_chore", args=[chore.id]))

    # --- Assert ---
    self.assertRedirects(response, reverse("board"))
    chore.refresh_from_db()
    self.assertEqual(chore.status, Chore.Status.TODO)
    self.assertIsNone(chore.claimed_by)
    self.assertEqual(chore.due_date, datetime.date(2026, 1, 8))
    self.assertIsNotNone(chore.last_completed_at)
```

Two details worth noticing:

1. **`chore.refresh_from_db()` between Act and Assert.** The Python object `chore` in memory doesn't automatically know the view changed its row in the database — the view operates on its *own* fetch of the same row (`get_object_or_404` inside `complete_chore`). Without `refresh_from_db()`, you'd be asserting against stale in-memory data and the test would lie (this is a classic first-timer bug when testing Django views).
2. **Multiple asserts, one Act.** This is fine — they're all checking facets of the *same* outcome (one POST request, several fields it's supposed to touch). Compare to having multiple unrelated Act steps in one test, which is the anti-pattern (if it fails, you don't know which action caused it).

A minimal, from-scratch example (no Django) showing the identical shape, if you want the pattern without any framework noise:

```python
def add(a, b):
    return a + b

def test_add_two_positive_numbers():
    # Arrange
    a, b = 2, 3
    # Act
    result = add(a, b)
    # Assert
    assert result == 5
```

Same three beats, every time, whether it's a one-line pure function or a full HTTP round-trip through a database.

---

## 5. Test Doubles (Mocks, Stubs, Fakes) — and Why We Didn't Need Any

When a function depends on something slow/unpredictable/external (network calls, current time, random values, a paid API), you swap it for a fake version during tests. Common terms:

- **Stub** — returns canned data, no logic.
- **Mock** — like a stub, but also records *how* it was called, so you can assert "was this called with X."
- **Fake** — a lightweight working implementation (e.g. an in-memory DB instead of a real one).

We didn't need any of these here — everything in this project (DB, views) is already fast and deterministic inside Django's test framework. Mocking becomes necessary the moment you add something like: sending a real email, calling a payment API, or reading `datetime.now()` directly in a way that makes tests flaky (a test asserting exact timestamps could fail if run at the wrong microsecond — worth knowing as a future gotcha if this project ever gets stricter time-based assertions).

---

## 6. TDD vs. Test-After

- **Test-Driven Development (TDD)** — write the failing test first, then write just enough code to make it pass, then refactor. Forces you to define "done" before writing code; tends to produce more testable designs since you're forced to think about interfaces first.
- **Test-after** (what we did here) — implement the feature, then retrofit tests once behavior is settled. Faster when the design is still fluid/exploratory, but risks writing tests that just describe whatever the code happens to do, including its bugs.

Neither is universally "correct" — TDD shines on well-understood problems (parsing, business rules with clear specs), test-after is common for UI-heavy or exploratory work where the shape of the solution isn't obvious yet. This project used test-after because we were still discovering the shape of the claim/complete flow via `plan.md`.

---

## 7. What Makes a Good Test

- **One logical assertion per test** (or a tight cluster) — a test named `test_claim_sets_claimed_by_and_status` that fails should immediately tell you what broke, without reading the test body.
- **Independent** — tests shouldn't depend on execution order or leak state. Django's per-test transaction rollback gives us this for free.
- **Deterministic** — same input, same result, every run. Flaky tests (pass sometimes, fail sometimes) are worse than no test — they train people to ignore failures.
- **Test behavior, not implementation** — assert on `chore.status == "done"`, not on "was `self.save()` called." If you refactor internals without changing behavior, tests shouldn't break. (Notice our tests never inspect *how* `complete_chore` works internally — they just check the resulting DB state.)
- **Fast** — the whole suite should run in seconds, or people stop running it before pushing. Ours runs in ~0.1s for 9 tests.

---

## 8. Coverage — a Useful Metric, Not a Goal

"Code coverage" = % of lines executed by the test suite. Useful for *finding gaps* (a view with 0% coverage means nobody's testing it at all). Dangerous as a target — 100% coverage doesn't mean 100% of bugs are caught, since a line can be "executed" by a test that doesn't actually assert anything meaningful about it.

Check coverage: `uv add --dev coverage`, then `uv run coverage run manage.py test && uv run coverage report`.

---

## 9. Continuous Integration (CI)

Running the test suite automatically on every push/PR (GitHub Actions, GitLab CI, etc.), so a broken test blocks a merge instead of surfacing in production. Not set up in this project (out of scope for a bootcamp submission), but the pattern: a `.github/workflows/test.yml` that runs `uv run python manage.py test` on every push. Worth doing the moment more than one person touches a repo, since it's the automated version of "did you run the tests before pushing?"

---

## 10. Quick Reference for This Project

| Task | Command |
|---|---|
| Run all tests | `uv run python manage.py test` |
| Run one test file | `uv run python manage.py test chores.tests` |
| Run one class | `uv run python manage.py test chores.tests.ClaimChoreTests` |
| Run one method | `uv run python manage.py test chores.tests.ClaimChoreTests.test_claim_sets_claimed_by_and_status` |
| Verbose output | add `-v 2` |
