# Django Primer — Practical Guide for This Project

Foundational concepts, kept practical to what you'll actually touch building the chore board.

---

## 1. Project Initial Setup

What actually happened to bootstrap this repo, in order — reusable checklist for the next Django project.

**1. Virtual environment + dependency manager.** We used `uv` (see homework's recommendation) instead of raw `pip`/`venv`:
```bash
uv init --no-readme --name choreboard .   # creates pyproject.toml, .venv/, uv.lock
uv add django==6.1.1                       # installs Django into .venv, records in pyproject.toml
```
`uv run <command>` runs anything inside that project's venv without manually activating it — every Django command below is prefixed with it.

**2. Create the project (site-wide config) and app (feature module):**
```bash
uv run django-admin startproject choreboard .   # trailing . = put manage.py at repo root
uv run python manage.py startapp chores
```

**3. Register the app** — Django won't discover an app just because the folder exists. Edit `choreboard/settings.py`:
```python
INSTALLED_APPS = [
    ...
    'chores',
]
```
This is the one step that's easy to forget and produces a confusing `ModuleNotFoundError` on the next command if skipped.

**4. Run initial migrations** — creates the DB tables Django's built-ins need (`auth`, `sessions`, `admin`, etc.) before you've written a single model of your own:
```bash
uv run python manage.py migrate
```

**5. Create an admin login** (for the free `/admin/` CRUD UI covered in section 6):
```bash
uv run python manage.py createsuperuser
```

**6. Verify it's alive:**
```bash
uv run python manage.py check       # cheap config sanity check, no server needed
uv run python manage.py runserver   # then visit 127.0.0.1:8000/ and /admin/
```

**7. `.gitignore` from day one** — before any of the above generates files you don't want committed (`.venv/`, `db.sqlite3`, `__pycache__/`).

That's the full skeleton — everything after this point (models, views, templates) is additive, not structural.

---

## 2. The Big Picture: Project vs App

- **Project** (`choreboard/`) — the whole site: settings, root URL config, WSGI entry. One per repo.
- **App** (`chores/`) — a self-contained feature module (models, views, templates, admin config). A project can have many apps; ours has one.

Rule of thumb: project = configuration container, app = actual feature code.

```
choreboard/          <- project (settings, root urls)
  settings.py
  urls.py
chores/              <- app (your actual code)
  models.py
  views.py
  admin.py
  urls.py            <- (you'll add this)
  templates/
  migrations/
manage.py            <- CLI entry point, don't edit
```

New app checklist every time: `startapp`, then **add to `INSTALLED_APPS`** in `settings.py` — Django won't see it otherwise (this bit us already — `ModuleNotFoundError` if skipped).

---

## 3. The Request Flow (MTV pattern)

Django calls it MTV (Model-Template-View), same idea as MVC:

```
URL request -> urls.py (routing) -> views.py (logic) -> models.py (data)
                                          |
                                          v
                                    templates/*.html (rendering)
```

1. `urls.py` matches a URL pattern to a view function.
2. The view runs Python logic — queries models, processes a form POST, etc.
3. The view returns a rendered template (HTML) or a redirect.

For our board: `GET /` -> `board_view()` -> queries `Chore.objects.all()` -> renders `board.html`.

---

## 4. Running the Dev Server

```bash
uv run python manage.py runserver
```

- Serves at `http://127.0.0.1:8000/` by default. Custom port: `uv run python manage.py runserver 8080`.
- Auto-reloads on Python file changes — no restart needed after editing views/models. Template edits also hot-reload. Changes to `settings.py` or new migrations may need a manual restart (`Ctrl+C` then rerun).
- Stop with `Ctrl+C`.
- This is dev-only — never use `runserver` in production (single-threaded, no security hardening). Not a concern for this local/demo project.
- If you see `That port is already in use`, either kill the stale process or pick a different port — don't just retry blindly.

---

## 5. Models = Your Database Schema

Each model class = one DB table. Each field = one column. Django generates the SQL for you — you never hand-write `CREATE TABLE`.

**Workflow, every time you change `models.py`:**
```bash
uv run python manage.py makemigrations   # generates a migration file (diff of schema change)
uv run python manage.py migrate          # applies it to the actual DB (db.sqlite3)
```

Practical rules:
- Never edit an already-applied migration file by hand — make a new migration instead.
- Commit migration files to git — they're code, not build output.
- `null=True` = DB allows NULL. `blank=True` = forms/admin allow empty. Usually you want both together for optional fields (we did this for `claimed_by`, `due_date`).
- Model methods/properties (like our `is_stale`) are computed in Python at query time — not stored in the DB. Fine for small datasets, would need denormalizing at scale.

---

## 6. Admin — Free CRUD UI

`admin.py` registers a model so `/admin/` gets a full CRUD interface with zero HTML written. Huge for manual testing/seeding during development — this is why we register every model immediately after creating it.

```python
@admin.register(Chore)
class ChoreAdmin(admin.ModelAdmin):
    list_display = (...)   # columns in the list view
    list_filter = (...)    # sidebar filters
```

Practical use: after any model change, check `/admin/` still works before writing views — cheapest sanity check available.

---

## 7. Views — Where Logic Lives

Two styles: function-based (`def board_view(request):`) or class-based. **Use function-based for this project** — simpler to reason about for a small app, and matches the plan's "plain form POSTs" approach.

Key pattern for our Claim/Complete flow:
```python
def claim_chore(request, chore_id):
    if request.method == "POST":
        chore = get_object_or_404(Chore, pk=chore_id)
        chore.claimed_by = ...
        chore.save()
    return redirect("board")
```

- Always branch on `request.method` for anything that mutates data — never mutate on GET (breaks browser prefetch/back-button expectations, and is a CSRF risk).
- `get_object_or_404` over manual `try/except` — idiomatic Django, gives a clean 404 automatically.

---

## 8. URLs — Two-Level Routing

Root `choreboard/urls.py` delegates to each app's own `urls.py` via `include()`. Keeps routing modular — app doesn't need to know its own URL prefix.

```python
# choreboard/urls.py
urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("chores.urls")),
]

# chores/urls.py
urlpatterns = [
    path("", views.board_view, name="board"),
    path("chore/<int:chore_id>/claim/", views.claim_chore, name="claim_chore"),
]
```

Always give routes a `name=` — templates and redirects should reference `{% url 'board' %}` / `redirect("board")`, never hardcode paths. If a URL ever changes, only `urls.py` needs updating.

---

## 9. Templates — Server-Rendered HTML

- `base.html` — shared layout (nav, `<head>`, static file links), other templates `{% extends "base.html" %}`.
- Partials (like `_chore_card.html`) — reusable fragments, included with `{% include "_chore_card.html" with chore=c %}`. Use for anything repeated in a loop (cards, list rows).
- Template logic should stay dumb: loops and conditionals only. Any real logic (staleness calculation, grouping) belongs in the view or a model property — not in template tags.

---

## 10. Static Files (CSS/JS)

- Put files in `chores/static/chores/` (namespaced by app to avoid collisions).
- Reference via `{% load static %}` then `{% static 'chores/style.css' %}` — never hardcode `/static/...` paths, since the actual served path depends on `STATIC_URL`/deployment config.
- `runserver` serves static files automatically in dev. Production needs `collectstatic` + a real web server — not our concern for a local demo, but know it exists.

---

## 11. Management Commands

Custom CLI commands (like our `seed_demo_data`) live in `chores/management/commands/<name>.py`, each with a `Command` class implementing `handle()`. Run with `uv run python manage.py <name>`.

Use for: seeding, one-off data migrations, cron-style scripts. Don't use for anything that should be a web-triggered action (that's a view).

---

## 12. Testing

Django's test runner is built on Python's `unittest`, with DB handling baked in (creates/destroys a throwaway test DB automatically).

```bash
uv run python manage.py test
```

Practical scope for this project:
- Model tests: `is_stale`/`days_stale` logic, recurrence reset math — pure logic, easy to test in isolation.
- View tests: use Django's test `Client` to POST to `claim_chore`/`mark_done` and assert DB state changed correctly (this is the highest-value test given the plan's "coordination loop" is the core mechanic).
- Don't bother testing Django itself (admin CRUD, migrations) — test *your* logic, not the framework.

Test files go in `chores/tests.py` (fine for our size) or split into `chores/tests/test_models.py` etc. if it grows.

---

## 13. Practical Habits for the Rest of This Project

1. **Model change -> makemigrations -> migrate -> check /admin/** — every time, in that order.
2. **Every new view needs a named URL** — no hardcoded paths anywhere.
3. **Mutations only on POST**, always redirect after (Post/Redirect/Get pattern — avoids duplicate form resubmission on refresh).
4. **Keep templates dumb** — logic in views/models, not `{% if %}` chains.
5. **Run `uv run python manage.py check`** as a cheap sanity test after any structural change (settings, new app, new model) — catches config errors before you even hit the server.
6. **Commit migrations.** Never `.gitignore` the `migrations/` folder.
7. Use `uv run python manage.py shell` to poke at models/queries interactively before writing view code — faster feedback loop than round-tripping through the browser.
