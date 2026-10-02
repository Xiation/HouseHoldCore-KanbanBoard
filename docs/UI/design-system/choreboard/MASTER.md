# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

> **Note on provenance:** generated via `ui-ux-pro-max`'s design-system tool, then hand-curated.
> Two automated runs mismatched this product's actual category (one matched "dark cinematic mobile app",
> one matched "sports team fan app / app store landing page") — neither applies to a direct-use web
> dashboard. This file keeps the genuinely usable outputs (palette, type, spacing, shadows) from both
> runs and replaces the mismatched category/pattern/effects sections with ones grounded in what this
> product actually is: a kanban-style task coordination web app (PrimeVue + Vue 3).

---

**Project:** ChoreBoard
**Category:** Productivity / task-coordination web app (not a landing page, not mobile)
**Design Dials:** Variance 7/10 (Balanced / Modern) | Motion 3/10 (Subtle) | Density 7/10 (Standard)

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#0D9488` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#14B8A6` | `--color-secondary` |
| Accent/CTA | `#EA580C` | `--color-accent` |
| Background | `#F0FDFA` | `--color-background` |
| Foreground | `#134E4A` | `--color-foreground` |
| Muted | `#E8F1F4` | `--color-muted` |
| Border | `#99F6E4` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| Ring | `#0D9488` | `--color-ring` |

**Color notes:** Teal (primary/secondary) + burnt orange (accent/CTA) on a light mint background. Warm and approachable without reading as generic corporate-blue SaaS. Destructive red reserved strictly for delete/reject actions (e.g. nothing in the claim/complete flow should use it). Avoid introducing additional hues beyond this set — the restraint is the point.

### Typography

- **Heading Font:** Plus Jakarta Sans
- **Body Font:** Plus Jakarta Sans
- **Mood:** friendly, modern, clean, approachable, professional
- **Google Fonts:** [Plus Jakarta Sans](https://fonts.google.com/share?selection.family=Plus+Jakarta+Sans:wght@300;400;500;600;700)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
```

One family, multiple weights — simpler to maintain than a display/body pairing, appropriate for a utility tool where legibility matters more than editorial flair. Suggested scale: 12/14/16/18/24/32px, weight 700 for headings, 600 for labels/buttons, 400 for body.

### Spacing Variables

*Density: 7/10 — Standard, dashboard-appropriate*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps (icon-to-label) |
| `--space-sm` | `8px` / `0.5rem` | Inline spacing, badge padding |
| `--space-md` | `16px` / `1rem` | Standard card/component padding |
| `--space-lg` | `24px` / `1.5rem` | Column/section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps between columns |
| `--space-2xl` | `48px` / `3rem` | Page-level section margins |

(Dropped `--space-3xl`/"Hero padding" — this app has no hero section, it's a direct-to-board tool.)

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift (chore cards at rest) |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards on hover, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns, claim form popover |

---

## Component Specs

### Buttons

```css
/* Primary (Claim / Mark Done) */
.btn-primary {
  background: #EA580C;
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary */
.btn-secondary {
  background: transparent;
  color: #0D9488;
  border: 2px solid #0D9488;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Chore Cards

```css
.card {
  background: #FFFFFF;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
  transition: box-shadow 200ms ease;
}
.card:hover {
  box-shadow: var(--shadow-md);
}
.card--stale {
  border-left: 3px solid var(--color-accent);
}
```
(Staleness uses a left border accent, not a background-color change — keeps it readable without turning the whole card alarming-looking.)

### Inputs / Select (member picker)

```css
.input, .select {
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}
.input:focus, .select:focus {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
}
```

### Nudge Banner

```css
.nudge-banner {
  background: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 14px;
  color: var(--color-foreground);
}
```
(Deliberately quiet, not alarm-red — nudges are passive/informational per the PRD, not punitive.)

---

## Style Direction

**What this actually is:** a direct-to-board productivity tool (kanban-style), not a marketing page. No hero section, no "download the app" CTA, no device mockups — the board itself is the first thing a user sees.

**Visual approach:** flat, clean, minimal shadow use, no gradients, no glassmorphism/blur effects (those were mismatched suggestions from an automated pass meant for a different product category — explicitly dropped here). Icons from a single consistent SVG set (Lucide recommended, pairs well with PrimeVue). No emoji icons anywhere.

**Layout:** 3 (or 4, including the unclaimed/claimed split) column kanban board, cards within columns, a persistent header/nav bar, nudge banner positioned above or alongside the board — not a modal, since it should be glanceable, not interruptive.

---

## Motion

**Page/route transition** (Subtle, matches Motion dial 3/10):
```js
gsap.to(main, { opacity: 0, duration: 0.2, onComplete: () => {
  navigate();
  gsap.fromTo(main, { opacity: 0 }, { opacity: 1, duration: 0.2 });
}});
```
Pair with Vue Router's `beforeEach`/`afterEach` hooks. Keep this subtle — this is a utility tool checked frequently throughout the day, not a destination experience; motion should never slow down a quick glance-and-act interaction.

**Card/button interactions:** 150-200ms ease transitions on hover/focus only. No entrance animations on initial board load (avoid making users wait to see their data).

---

## Anti-Patterns (Do NOT Use)

- ❌ Gradients, glassmorphism, blur effects, dark-mode-primary design — mismatched from an unrelated automated suggestion, explicitly not this product's direction
- ❌ App-store-style landing patterns (device mockups, download CTAs, star ratings) — this is a logged-in tool, not a marketing page
- ❌ Emojis as icons — use SVG icons (Lucide/Heroicons) throughout
- ❌ Missing `cursor: pointer` on clickable elements
- ❌ Layout-shifting hover transforms on anything in a scrolling list (causes jitter in board columns)
- ❌ Low-contrast text — maintain 4.5:1 minimum
- ❌ Instant state changes — always transition 150-300ms
- ❌ Invisible focus states — must be visible for keyboard nav (this is a shared-household tool, accessibility isn't optional)

---

## Pre-Delivery Checklist

- [ ] No emojis used as icons
- [ ] Consistent icon set throughout (pick one: Lucide recommended)
- [ ] `cursor: pointer` on all clickable elements
- [ ] Hover/focus states use smooth transitions (150-300ms)
- [ ] Text contrast ≥4.5:1 (check teal-on-mint and orange-on-white combinations specifically)
- [ ] Visible keyboard focus rings
- [ ] `prefers-reduced-motion` respected (disables the page-transition fade)
- [ ] Responsive at 375px, 768px, 1024px, 1440px — board should reflow to stacked columns on mobile, not horizontal-scroll
- [ ] No content hidden behind any fixed header
