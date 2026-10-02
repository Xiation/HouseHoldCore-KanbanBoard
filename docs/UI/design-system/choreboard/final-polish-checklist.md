# Final Polish Checklist — Household Kanban (pre-team-kanban milestone)

Goal: close out the household version cleanly before moving on to the team-kanban rebuild. This is the last pass — functional correctness is already confirmed (board loads, claim/complete/nudge all work end-to-end). Everything below is visual/UX polish, each independently verifiable.

---

## 1. Fix the nudge banner wording bug

**Problem:** currently reads "Bob hasn't claimed anything in **a while days**." — the word "days" is hardcoded outside the ternary, so the `null` case gets it awkwardly appended.

Edit `frontend/src/components/NudgeBanner.vue`:

```vue
<template>
  <div v-if="nudges.length > 0" class="nudge-banner">
    <p v-for="nudge in nudges" :key="nudge.memberId">
      {{ nudge.name }}
      {{ nudge.daysSinceLastActivity === null
          ? "hasn't claimed anything in a while"
          : `hasn't claimed anything in ${nudge.daysSinceLastActivity} days` }}.
      Consider assigning them a chore.
    </p>
  </div>
</template>
```

**Verify:** the "zero activity ever" case (a brand-new member) should read "...in a while. Consider..." — not "...in a while days...".

---

## 2. Format the due date readably

**Problem:** `ChoreCard.vue` currently shows the raw value straight from the API (`2026-09-19`) instead of something human-readable.

Edit `frontend/src/components/ChoreCard.vue` — add a small computed property:

```vue
<script setup>
import { computed } from 'vue'

const props = defineProps({
  chore: { type: Object, required: true }
})

const formattedDueDate = computed(() => {
  if (!props.chore.dueDate) return null
  return new Date(props.chore.dueDate).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric'
  })
})
</script>

<template>
  <div class="card" :class="{ 'card--stale': chore.isStale }">
    <p class="chore-title">{{ chore.title }}</p>
    <p v-if="chore.claimedBy">Claimed by: {{ chore.claimedBy.name }}</p>
    <p v-if="formattedDueDate">Due: {{ formattedDueDate }}</p>
    <span class="badge">{{ chore.timeEstimate }}</span>
    <slot></slot>
  </div>
</template>
```

**Verify:** dates should now read like "Sep 19, 2026" instead of "2026-09-19".

---

## 3. Responsive check (375px / 768px / 1024px)

This was a stated goal from the start (`fullstack-build-plan.md` Phase 7) — hasn't actually been tested yet.

**How to test:** open browser DevTools → toggle device toolbar (phone icon, or `Ctrl+Shift+M` in Chrome/Firefox) → manually set width to 375px, then 768px, then 1024px. Check at each:
- No horizontal scrollbar
- Columns stack vertically at 375px (not squeezed side-by-side unreadably)
- Text/buttons remain tappable size (not tiny)

If columns don't stack cleanly at narrow widths even with the existing `flex-wrap: wrap`, add an explicit breakpoint to `frontend/src/style.css`:

```css
@media (max-width: 768px) {
  .board section {
    min-width: 100%;
  }
}
```

This forces each column to take full width below 768px, guaranteeing a clean vertical stack rather than relying on `flex-wrap`'s automatic (sometimes unpredictable) wrapping.

**Verify:** at 375px width, scroll down through all 3 columns stacked vertically, no horizontal scroll at any point.

---

## 4. Style the loading/error states in `App.vue`

**Problem:** currently plain unstyled text ("Loading...", raw error message).

Edit `frontend/src/App.vue`'s template:

```vue
<template>
  <div v-if="loading" class="status-message">Loading your board...</div>
  <div v-else-if="error" class="status-message status-message--error">{{ error }}</div>
  <div v-else>
    <Board :board="board" :claim="claim" :complete="complete" />
  </div>
</template>
```

Add to `style.css`:

```css
.status-message {
  padding: 32px;
  text-align: center;
  font-size: 16px;
  color: #134E4A;
}
.status-message--error {
  color: #DC2626;
}
```

**Verify:** temporarily stop the backend server and reload the page — the error state should show a clearly-readable red message, not break the layout.

---

## 5. General visual pass

Once 1-4 are done, look at the board fresh (not against a specific bug, just overall impression) and check:

- [ ] Spacing between cards within a column — consistent, not cramped
- [ ] Spacing between the 3 columns — consistent with `.board`'s `gap: 16px`
- [ ] Column headings (`<h2>`) — readable size/weight, not competing visually with card titles
- [ ] `Select`/`Button` in `ClaimForm` — appropriately sized, not oversized or tiny relative to the card
- [ ] Stale cards (orange left border) — visually distinct at a glance without being alarming/red

Fix anything that looks off using the color tokens from `MASTER.md` (don't introduce new colors outside the existing teal/orange/mint palette).

---

## Done when

All 5 sections above are checked off, and a stranger looking at the board for the first time can tell — without explanation — what's unclaimed, what's in progress, what's done, and whether anyone's gone quiet. At that point, the household kanban is genuinely feature-and-polish complete, and it's a clean stopping point before starting the team-kanban rebuild.
