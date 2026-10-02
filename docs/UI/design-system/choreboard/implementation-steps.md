# Design System Implementation — Step by Step

Companion to `MASTER.md` in this same folder — that file is the *what* (tokens, palette, component specs), this is the *how* (exact steps to apply it to the actual Vue + PrimeVue codebase). Follow in order; each step is independently verifiable before moving to the next.

---

## Step 1 — Custom PrimeVue theme preset

Why: by default, PrimeVue's `Aura` preset uses its own blue palette. We need to override its `primary` semantic token with our actual brand color before any PrimeVue component (Button, Select, etc.) will visually match the design system.

Edit `frontend/src/main.js`:

```js
import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'
import './style.css'
import App from './App.vue'

const ChoreBoardPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c',
      500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12', 950: '#431407'
    }
  }
})

const app = createApp(App)

app.use(PrimeVue, {
  theme: {
    preset: ChoreBoardPreset,
  },
})

app.mount('#app')
```

**Why orange, not teal, for PrimeVue's `primary`:** per `MASTER.md`'s component specs, orange (`#EA580C`, Tailwind's `orange-600`) is the color actually used on `.btn-primary` — the Claim/Mark Done action buttons. PrimeVue's default `<Button>` (no `severity` prop) renders using the `primary` semantic token, so mapping `primary` → orange means plain `<Button>` usage automatically matches our real CTA color without extra props every time.

**Verify:** run `pnpm --filter frontend dev`, check any PrimeVue component already in use (e.g. a bare `<Button label="Test" />`) — it should render orange, not the default Aura blue.

---

## Step 2 — Global styles (font, background, shared component classes)

Edit `frontend/src/style.css`, add:

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

body {
  font-family: 'Plus Jakarta Sans', sans-serif;
  background: #F0FDFA;
  color: #134E4A;
  margin: 0;
}

.card {
  background: #FFFFFF;
  border: 1px solid #99F6E4;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  transition: box-shadow 200ms ease;
  margin-bottom: 12px;
}
.card:hover {
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}
.card--stale {
  border-left: 3px solid #EA580C;
}

.nudge-banner {
  background: #E8F1F4;
  border: 1px solid #99F6E4;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 14px;
  color: #134E4A;
  margin-bottom: 16px;
}
```

**Verify:** reload the page — background should be light mint, text dark teal, font should visibly be Plus Jakarta Sans (check DevTools → Elements → Computed → font-family if unsure visually). `ChoreCard.vue`'s `.card`/`.card--stale` classes (already written into that component) should now actually render styled, not bare/unstyled.

---

## Step 3 — Swap raw HTML form elements for PrimeVue components

Why: a plain `<select>`/`<button>` never picks up the PrimeVue theme at all — only actual PrimeVue components (`Select`, `Button`) read from the theme tokens.

Edit `frontend/src/components/ClaimForm.vue` — replace the raw `<select>`/`<button>` with PrimeVue's `Select` and `Button`:

```vue
<script setup>
import { ref } from 'vue'
import Select from 'primevue/select'
import Button from 'primevue/button'

const props = defineProps({
    claim: { type: Function, required: true },
    chore: { type: Object, required: true },
    members: { type: Array, required: true }
})

const selectedMemberId = ref(null)

function handleClaim() {
    if (selectedMemberId.value) {
        props.claim(props.chore.id, selectedMemberId.value)
    } else {
        alert('Please select a member to claim the chore.')
    }
}
</script>

<template>
    <Select
        v-model="selectedMemberId"
        :options="members"
        optionLabel="name"
        optionValue="id"
        placeholder="Select a member..."
    />
    <Button label="Claim" @click="handleClaim" />
</template>
```

Note the shape change: PrimeVue's `Select` takes the whole `members` array directly via `:options`, plus `optionLabel`/`optionValue` to tell it which fields to display/use — you no longer need to hand-write the `<option v-for="...">` loop yourself, `Select` does that internally.

**Verify:** the dropdown and Claim button in the "Unclaimed" column should now look like real styled PrimeVue components (rounded, orange button), not plain browser-default form controls.

---

## Step 4 — Swap the "Mark Done" buttons in `Board.vue`

Edit `frontend/src/components/Board.vue` — replace every plain `<button @click="complete(chore.id)">Mark Done</button>` with PrimeVue's `Button`:

```vue
<script setup>
import { defineProps } from 'vue'
import Button from 'primevue/button'
import ChoreCard from './ChoreCard.vue'
import NudgeBanner from './NudgeBanner.vue'
import ClaimForm from './ClaimForm.vue'
// ...rest of props unchanged
</script>

<template>
    <!-- ... -->
    <ChoreCard v-for="chore in board.claimedTodo" :key="chore.id" :chore="chore">
        <Button label="Mark Done" @click="complete(chore.id)" />
    </ChoreCard>
    <!-- same swap in the "In Progress" section -->
</template>
```

**Verify:** both "Claimed" and "In Progress" columns show styled orange buttons instead of plain browser buttons.

---

## Step 5 — Board layout (columns side by side)

The 4 `<section>` columns currently stack vertically with no layout styling. Add to `style.css`:

```css
.board {
  display: flex;
  gap: 16px;
  padding: 16px;
  flex-wrap: wrap;
}
.board section {
  flex: 1;
  min-width: 260px;
}
```

Then wrap the 4 `<section>` elements in `Board.vue`'s template with `<div class="board">...</div>` if not already (check — `Board.vue` currently has a `<div class="">` wrapper with an empty class, just add `board` to it).

**Verify at 3 widths** (resize the browser window or use DevTools device toolbar): at desktop width (≥1024px), columns should sit side by side. At phone width (375px), `flex-wrap: wrap` should let them stack vertically instead of squeezing/horizontal-scrolling — this satisfies the mobile-responsive requirement from `fullstack-build-plan.md`'s Phase 7.

---

## Step 6 — Pre-delivery checklist (from `MASTER.md`)

Go through this once all 5 steps above are done:

- [ ] No emojis used as icons anywhere
- [ ] `cursor: pointer` on all clickable elements (PrimeVue `Button`/`Select` handle this automatically; check anything still using a raw HTML element)
- [ ] Text contrast ≥4.5:1 — specifically check teal-on-mint (body text) and white-on-orange (button text)
- [ ] Visible keyboard focus rings (tab through the page, confirm you can see where focus is)
- [ ] Responsive at 375px / 768px / 1024px — board reflows to stacked columns on mobile, no horizontal scroll
- [ ] Nudge banner reads clearly, doesn't look like an error/alarm (it should use the quiet `.nudge-banner` style, not red)

---

## What's deliberately left for later

- Actual `ChoreCard.vue` due-date formatting (currently shows raw ISO date string — fine for now, a `toLocaleDateString()` pass is a 5-minute polish item, not urgent)
- Loading/error state styling in `App.vue` (currently plain text "Loading..."/error message — functional, not styled, acceptable for MVP)
- The page-transition GSAP motion from `MASTER.md` — this is a single-page app right now with no routing, so there's no route transition to animate yet; revisit if routing gets added later
