# Data Layer Setup — Models & Migrations (Express + Sequelize)

Walkthrough of setting up `HouseholdMember` and `Chore` in the new stack, plus the ESM/CommonJS boundary issues hit along the way and why they happen. Companion to `docs/migrations/migration-steps.md` Step 5.

---

## Why `allowNull`, Enums, and Defaults Weren't Arbitrary

The generator's bare output (`title: { type: Sequelize.STRING }`) has no opinion about whether a field is required. Every constraint added on top of that was a direct, field-by-field port of the original Django model's own rules — not a Sequelize style preference. Django encodes "is this required" via the presence/absence of `null=True`/`blank=True`; Sequelize encodes the same thing via `allowNull`. Line up the two:

| Django (`chores/models.py`) | Django constraint | Sequelize equivalent |
|---|---|---|
| `title = models.CharField(max_length=200)` | no `null=True` → required | `allowNull: false` |
| `status = models.CharField(..., default=Status.TODO)` | no `null=True`, has a default | `allowNull: false, defaultValue: 'todo'` |
| `recurrence_type = models.CharField(..., default=RecurrenceType.ONE_OFF)` | no `null=True`, has a default | `allowNull: false, defaultValue: 'one_off'` |
| `recurrence_interval = models.PositiveIntegerField(null=True, blank=True)` | explicitly optional | `allowNull: true` |
| `due_date = models.DateField(null=True, blank=True)` | explicitly optional | `allowNull: true` |
| `time_estimate = models.CharField(max_length=10, choices=...)` | no `null=True` → required | `allowNull: false` |
| `claimed_by = models.ForeignKey(..., null=True, blank=True)` | explicitly optional | `allowNull: true` |
| `last_completed_at = models.DateTimeField(null=True, blank=True)` | explicitly optional | `allowNull: true` |

Same logic for `ENUM`s: Django's `choices=Status.choices` restricts the column to a fixed set of string values at the ORM/form-validation layer. Postgres has a native `ENUM` type that enforces the same restriction *at the database layer* — stricter than Django's approach, actually, since Django's `choices` is enforced by Django's own validation, not by a raw SQL `INSERT` bypassing the ORM. Using a real `ENUM` here means the constraint holds even if something writes to the table outside of Sequelize (a raw query, a different tool, a bug in a future rewrite).

The takeaway: whenever you're porting a schema between frameworks, the source of truth for "should this be nullable/constrained" is the *business rule* the original model encoded, not what the scaffolding tool happens to generate by default. The generator doesn't know your business rules — it just gives you the loosest possible schema as a starting point.

### One Level Deeper: Why Django's Rules Were What They Were

The table above explains the *mechanical* mapping (Django flag → Sequelize flag), but not why the Django model was designed that way to begin with. That design wasn't invented during this migration — it traces back to `docs/PRD.md`'s functional requirements, decided back when the Django model was first written. This migration ports that reasoning forward; it doesn't re-decide it. The actual domain logic, field by field:

- **`title` — required.** A chore card with no title is meaningless — FR2 requires cards display a title as baseline identifying info. The app literally can't render a usable board if this is null.
- **`status` — required, defaults to `todo`.** The board's entire layout (FR1) is "group chores by status into columns." A chore with a null status has no column to live in — the grouping logic would break. Defaulting to `todo` makes sense because every newly created chore starts in the unclaimed/undone state; there's no other sensible starting point.
- **`recurrence_type` — required, defaults to `one_off`.** FR3 requires every chore be classified at creation time, because the complete-flow logic (FR4) branches on it — the app needs to know *before* completion whether to reset the chore or leave it done. This can't be optional; there'd be no correct behavior to fall back to. Defaults to `one_off` as the simpler, more common case.
- **`recurrence_interval` — optional, and *meaningfully* so.** This isn't "the user might skip filling it in" laziness — it's null because the concept genuinely doesn't apply to one-off chores. A one-off chore has no cadence; forcing a number here would be encoding a lie. Null here means "not applicable," not "unknown."
- **`due_date` — optional.** The PRD explicitly frames this as a lightweight coordination tool, not a rigid scheduler ("Keep the system lightweight — no rigid assignment hierarchy," PRD §3). Some chores are genuinely open-ended ("someday" tasks) with no real deadline — forcing a due date on every chore would add creation friction the PRD deliberately avoids.
- **`time_estimate` — required.** FR2 explicitly names this as one of the required at-a-glance signals every card must show (quick/medium/big). Since the PRD calls this out as core information, not incidental, it can't be skipped.
- **`claimed_by` — optional, and this null is load-bearing.** This is the most important one: null isn't "we don't have this data yet" — null *is* the unclaimed state itself. FR5/FR6 (the unclaimed pool vs. claimed chores split) are built entirely on checking whether this field is null. Making it required would eliminate the concept of an unclaimed chore altogether — the app's core mechanic depends on this field being nullable.
- **`last_completed_at` — optional.** A brand-new chore has never been completed — there's no timestamp to store for an event that hasn't happened yet. Null accurately represents "this hasn't occurred," not missing data.

General principle for next time you're designing a field from scratch (not porting one): ask "can this real-world concept legitimately not have a value, and does that absence itself mean something?" If the absence is meaningful (like `claimed_by = null` meaning "unclaimed"), make it nullable — that's using the database to encode domain state, not just permissiveness. If the field is required for the record to make sense or be routable/renderable at all (`title`, `status`), it shouldn't be nullable regardless of how "optional" it might feel from a form-UX perspective.

---

## Clearing Up the Multiple "Names"

Three different things in this setup are called some variant of "name," easy to conflate:

1. **The column itself: `name`** (lowercase, on `HouseholdMember`). This is a completely ordinary Sequelize attribute — yes, it's "legit." It maps directly to Django's own `name = models.CharField(max_length=100, unique=True)` field. There's no naming collision risk: a JS class has its own built-in static `HouseholdMember.name` (every function/class has this — it'd equal `"HouseholdMember"`, the class identifier), but that's a completely separate thing from an *instance's* `name` attribute (`someMember.name`, which holds the actual DB value like `"Alice"`). Sequelize defines instance attributes as getters/setters on the prototype, so there's no actual collision at runtime — this is a safe, common attribute name in Sequelize models generally.

2. **`modelName: 'HouseholdMember'`** — the JS-side identifier Sequelize uses internally and in associations (e.g., `models.HouseholdMember`, `Chore.belongsTo(models.HouseholdMember, ...)`). This name exists only in your JS code, never touches the database directly.

3. **`tableName: 'HouseholdMembers'`** — the actual literal table name inside Postgres. This is "the real name" if you're asking what shows up when you run `\dt` in `psql` — plural, matching what the migration's `createTable('HouseholdMembers', ...)` call created.

So: the DB table is really called `HouseholdMembers`, it has a column really called `name`, and `HouseholdMember` (singular) is purely a JS-land label with no direct database representation. This split (singular model name, plural table name) is a common Sequelize/Rails-lineage convention — not required, just what the generator defaults to and what this project kept for consistency with typical Sequelize projects.

---

## The ESM/CommonJS Boundary — Read This First

`server/package.json` has `"type": "module"`, so by default every `.js` file in `server/` is parsed as an ES module (`import`/`export`). But `sequelize-cli` is a separate tool that loads several file types via plain Node `require()` internally — and `require()` cannot load ES module syntax, full stop, regardless of your project's `"type"` setting.

**Files `sequelize-cli` loads via `require()` (must stay CommonJS):**
- `.sequelizerc`
- the config file it points to (here: `src/config/config.cjs`)
- every file in `migrations/`
- every file in `seeders/`

**Files only your own app code loads (free to be ES6):**
- everything in `src/models/` (loaded by your own `src/models/index.js`, not by the CLI)
- `src/routes/`, `src/app.js`, `src/server.js`, `src/config/db.js`

This is why some files in this project end in `.cjs` and use `require`/`module.exports`, while most use `import`/`export` — it's not inconsistency, it's tracking which loader actually reads each file.

**Two ways to force CommonJS on a file inside an ESM-typed package:**
1. Name the file `.cjs` — Node always treats this extension as CommonJS, regardless of `"type"`. Used for `src/config/config.cjs`.
2. Drop a `package.json` containing `{ "type": "commonjs" }` inside a folder — Node resolves module type by walking up to the *nearest* `package.json`, so this overrides the parent setting for everything in that folder without renaming files. Used for `migrations/` and `seeders/`, since `sequelize-cli`'s generator always outputs plain `.js` files there and renaming every generated file by hand would get old fast.

`src/models/` does **not** have this override — model files are only ever loaded by your own ES6 `index.js`, never by the CLI directly, so they stay plain ES6.

---

## Step-by-Step: What Was Actually Done

### 1. Generate scaffolding
```bash
mkdir -p src/models migrations seeders
pnpm exec sequelize-cli model:generate --name HouseholdMember --attributes name:string
pnpm exec sequelize-cli model:generate --name Chore --attributes title:string,status:string,recurrenceType:string,recurrenceInterval:integer,dueDate:dateonly,timeEstimate:string,claimedById:integer,lastCompletedAt:date
```
This writes rough model files into `src/models/` and matching migration files into `migrations/` — but only the *shape*, not the real constraints (no enums, no defaults, no FK, no uniqueness). Those need hand-editing afterward — the generator is a starting point, not the final spec.

### 2. `sequelize-cli` needs its own connection config
Separate from your app's `src/config/db.js`, the CLI reads a config file (pointed to via `.sequelizerc`'s `'config'` key) to know how to connect for `migrate`/`seed` commands:

```js
// src/config/config.cjs
require('dotenv').config();

module.exports = {
  development: { url: process.env.DATABASE_URL, dialect: 'postgres' },
  test: { url: process.env.TEST_DATABASE_URL, dialect: 'postgres' },
  production: { url: process.env.DATABASE_URL, dialect: 'postgres' },
};
```

```js
// .sequelizerc
const path = require('path');
module.exports = {
  'config': path.resolve('src', 'config', 'config.cjs'),
  'models-path': path.resolve('src', 'models'),
  'migrations-path': path.resolve('migrations'),
  'seeders-path': path.resolve('seeders'),
};
```

### 3. Fix the migrations to match the real spec

The generator's output was bare (`status: { type: Sequelize.STRING }`, no default, no enum). Hand-edited to match the original Django model exactly:

```js
// migrations/xxxx-create-household-member.js
'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('HouseholdMembers', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      name: { type: Sequelize.STRING, allowNull: false, unique: true },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('HouseholdMembers');
  },
};
```

```js
// migrations/xxxx-create-chore.js
'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Chores', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      title: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.ENUM('todo', 'in_progress', 'done'), allowNull: false, defaultValue: 'todo' },
      recurrenceType: { type: Sequelize.ENUM('one_off', 'recurring'), allowNull: false, defaultValue: 'one_off' },
      recurrenceInterval: { type: Sequelize.INTEGER, allowNull: true },
      dueDate: { type: Sequelize.DATEONLY, allowNull: true },
      timeEstimate: { type: Sequelize.ENUM('quick', 'medium', 'big'), allowNull: false },
      claimedById: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'HouseholdMembers', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      lastUpdatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      lastCompletedAt: { type: Sequelize.DATE, allowNull: true },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Chores');
  },
};
```

Key differences from the raw generator output, and why each one matters:
| Change | Reason |
|---|---|
| `status`/`recurrenceType`/`timeEstimate` → real `ENUM` + `defaultValue` | Matches Django's `choices=` + `default=` — a plain `STRING` column would accept any garbage value |
| `claimedById` gets an actual FK constraint + `onDelete: 'SET NULL'` | Matches Django's `on_delete=models.SET_NULL` — without this, deleting a member would either fail or leave a dangling reference depending on DB defaults |
| `updatedAt` renamed to `lastUpdatedAt`, `createdAt` dropped entirely | Matches the Django model's actual fields — Django's `Chore` never had a `createdAt`, and `last_updated_at` is the field the staleness logic depends on |

### 4. Model files — ES6, since only your own code loads these

```js
// src/models/chore.js
import { Model } from 'sequelize';

const STALE_AFTER_DAYS = 3;

export default (sequelize, DataTypes) => {
  class Chore extends Model {
    static associate(models) {
      Chore.belongsTo(models.HouseholdMember, { as: 'claimedBy', foreignKey: 'claimedById' });
    }

    daysStale() {
      if (this.status === 'done') return 0;
      return Math.floor((Date.now() - new Date(this.lastUpdatedAt).getTime()) / 86_400_000);
    }

    isStale() {
      return this.status !== 'done' && this.daysStale() >= STALE_AFTER_DAYS;
    }
  }
  Chore.init(
    {
      title: { type: DataTypes.STRING, allowNull: false },
      status: { type: DataTypes.ENUM('todo', 'in_progress', 'done'), allowNull: false, defaultValue: 'todo' },
      recurrenceType: { type: DataTypes.ENUM('one_off', 'recurring'), allowNull: false, defaultValue: 'one_off' },
      recurrenceInterval: { type: DataTypes.INTEGER, allowNull: true },
      dueDate: { type: DataTypes.DATEONLY, allowNull: true },
      timeEstimate: { type: DataTypes.ENUM('quick', 'medium', 'big'), allowNull: false },
      claimedById: { type: DataTypes.INTEGER, allowNull: true },
      lastCompletedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, modelName: 'Chore', tableName: 'Chores', createdAt: false, updatedAt: 'lastUpdatedAt' }
  );
  return Chore;
};
```

`isStale()`/`daysStale()` are instance methods here (called as `chore.isStale()`), not properties like Django's `@property is_stale` (accessed as `chore.is_stale`, no parens) — JS doesn't have a built-in computed-property decorator as clean as Python's for plain classes without extra tooling, so instance methods are the idiomatic equivalent.

```js
// src/models/householdmember.js
import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class HouseholdMember extends Model {
    static associate(models) {
      HouseholdMember.hasMany(models.Chore, { as: 'claimedChores', foreignKey: 'claimedById' });
    }
  }
  HouseholdMember.init(
    { name: { type: DataTypes.STRING, allowNull: false, unique: true } },
    { sequelize, modelName: 'HouseholdMember', tableName: 'HouseholdMembers', timestamps: false }
  );
  return HouseholdMember;
};
```

```js
// src/models/index.js
import { sequelize } from '../config/db.js';
import defineHouseholdMember from './householdmember.js';
import defineChore from './chore.js';

const HouseholdMember = defineHouseholdMember(sequelize, sequelize.Sequelize.DataTypes);
const Chore = defineChore(sequelize, sequelize.Sequelize.DataTypes);

const models = { HouseholdMember, Chore };
Object.values(models).forEach((model) => model.associate?.(models));

export { sequelize, HouseholdMember, Chore };
```

Note this reuses the *same* `sequelize` instance from `src/config/db.js` rather than creating a second connection — `sequelize-cli`'s own `config.cjs` is a separate, parallel connection setup used only by CLI commands (`migrate`/`seed`), never touched by your running app.

### 5. Apply and verify
```bash
pnpm exec sequelize-cli db:migrate:undo:all   # only needed if you'd already run the bare-skeleton version
pnpm run db:migrate
psql -d choreboard_dev -c "\d \"Chores\""      # confirm ENUM types + FK constraint actually landed
```

---

## Debugging Log (real errors hit, in order)

1. `ERROR: Unable to find models path` — generator doesn't create the `models-path`/`migrations-path` folders itself, only writes into them. Fix: `mkdir -p` first.
2. `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` — `DATABASE_URL` had no password; connecting via `localhost` (TCP) requires real SCRAM auth, unlike the Unix socket's peer auth. Fix: set a password on the Postgres role, add it to the connection string.
3. `module is not defined in ES module scope` (twice — once for `config.js`, once for the migration files) — the CJS/ESM boundary described above. Fix: `.cjs` extension for the one-off config file, folder-level `package.json` override for the repeatedly-generated `migrations/`/`seeders/` folders.

Common thread across all three: read the actual error message, fix exactly what it names, re-run, repeat. No guessing.
