# 01 — Foundations (Tokens)

All visual values come from **tokens**. Tokens live as HSL CSS variables in
`src/index.css` (`:root` and `.dark`) and are exposed as Tailwind classes in
`tailwind.config.mjs`. **Never** introduce a value outside this system.

> ❌ `style={{ color: '#f64c4c' }}` ❌ `className="bg-[#fff] text-[13px] p-[7px]"`
> ✅ `className="bg-card text-danger-600 p-2"`

---

## 1. Color system

### Primary (brand) — warm orange
Admin exposes `primary-50 … primary-600`. (Learner: `50…500`.) Source values (`src/index.css`):

| Token | HSL | Use |
|---|---|---|
| `primary-50` | `34 89% 96%` | subtle hover/selected backgrounds |
| `primary-100` | `35 90% 92%` | selected chip / tag background |
| `primary-200` | `32 88% 83%` | hover borders |
| `primary-300` | `30 87% 72%` | disabled primary, focus outline |
| `primary-400` | `26 86% 61%` | primary hover/active |
| `primary-500` | `24 85% 54%` | **default CTA / brand** |
| `primary-600` | `24 85% 48%` | pressed, emphasis (admin only) |

### Semantic status colors (`50…700`)
Use these for meaning, never decoration.

| Family | `500` HSL | Meaning |
|---|---|---|
| `success` | `142 56% 54%` | success, completed, active/positive |
| `warning` | `37 100% 50%` | caution, pending, needs-attention |
| `danger` | `360 76% 68%` | errors, destructive actions, failures |
| `info` | `214 77% 54%` | neutral information, hints |

Each has `50` (bg tint) → `700` (strong text/icon). Convention: `*-50/100` background,
`*-600/700` text or icon on that background (e.g. `bg-danger-50 text-danger-600`).

### Neutrals & surfaces (shadcn semantic vars)
Use semantic surface tokens, not gray-XXX guesses, for structural color:

| Token | Use |
|---|---|
| `background` / `foreground` | page background / default text |
| `card` / `card-foreground` | card & panel surfaces |
| `popover` / `popover-foreground` | dropdowns, popovers, menus |
| `muted` / `muted-foreground` | muted backgrounds / secondary text |
| `border` | all borders/dividers (`214.3 31.8% 91.4%`) |
| `input` | input borders |
| `ring` | focus rings |
| `secondary` / `accent` | secondary surfaces |
| `destructive` | destructive emphasis |
| `sidebar-background` | sidebar surface |

`neutral-*` Tailwind classes are acceptable for text/border greys (used widely by the design-system
components, e.g. `text-neutral-600`, `border-neutral-300`). Prefer semantic tokens for structural
surfaces; use `neutral-*` for incidental greys. Do not invent `gray-[#...]`.

### CTA / button-color hierarchy
One primary action per view. Map intent → component, not color-by-hand
(see [02-components.md](./02-components.md)):

| Intent | Use | Resulting color |
|---|---|---|
| Primary action | `<MyButton buttonType="primary">` | `bg-primary-500` |
| Secondary action | `<MyButton buttonType="secondary">` | bordered neutral |
| Tertiary / inline | `<MyButton buttonType="text">` | `text-primary-500` |
| Destructive | primary button + confirm dialog, danger tokens in copy | `danger-*` |

### Hard rules
- No raw hex anywhere in `.tsx`. No arbitrary color (`bg-[#...]`, `text-[#...]`).
- No inline `style` for color/spacing/typography (exception: genuinely dynamic, user-generated
  values like a user-picked color in an editor — keep these isolated and commented).
- Dark mode: never hardcode light/dark colors; use the semantic tokens that already flip in `.dark`.

---

## 2. Typography

**Font:** Open Sans (`font-sans`). Loaded via index.html; white-label override supported. Don't import
other fonts in components.

**Type scale (use these tokens, not `text-[Npx]`):** defined in `tailwind.config.mjs`.

| Token | Size / line-height | Typical use |
|---|---|---|
| `text-h1` | 30 / 38 | page title |
| `text-h2` | 24 / 32 | section heading |
| `text-h3` | 20 / 28 | subsection heading |
| `text-title` | 18 / 26 | card/dialog title |
| `text-subtitle` | 16 / 24 | emphasized body, large labels |
| `text-body` | 14 / 22 | **default body text** |
| `text-caption` | 12 / 18 | helper text, captions, table meta |

Semibold variants exist: `text-h1-semibold`, `text-h2-semibold`, `text-h3-semibold` (weight 500).

**Weights:** admin defines `font-regular` (400) and `font-semibold` (500). Don't use `font-bold`
(700) in admin unless deliberately matching an existing pattern. (Learner allows 300–700 — see
[09-learner-app.md](./09-learner-app.md).)

**Rules**
- One `h1` per page. Don't skip levels for styling — pick the token that matches the size you want.
- Never set `font-size` / `line-height` via arbitrary values or inline styles.
- Mobile: prefer responsive tokens (e.g. `text-h2 sm:text-h1`) over arbitrary sizes.

---

## 3. Spacing

Use Tailwind's default 4px scale (`p-1`=4px, `p-2`=8px, `p-4`=16px, …). **No arbitrary spacing**
(`p-[7px]`, `gap-[13px]`, `mt-[5px]`).

**Recommended rhythm**
- Inside controls (button/input padding): handled by the components — don't override.
- Between form fields: `gap-4` (16px) / `space-y-4`.
- Between sections: `gap-6`–`gap-8` (24–32px).
- Card padding: `p-4`–`p-6`.
- Page container padding: `p-4 sm:p-6`.

**Containers / grid**
- Use the configured `container` (centered, padded, max `2xl`=1400px) for page width, or a
  consistent `max-w-*` per layout. Don't mix random `max-w-[...]` values.
- Use `grid` / `flex` with `gap-*` for layout. Avoid manual margins to fake gaps (the #1 source of
  uneven layouts).

Learner app additionally has a `--space-*` catalogue scale — see [09-learner-app.md](./09-learner-app.md).

---

## 4. Radius

Driven by `--radius` (0.5rem / 8px).

| Class | Value | Use |
|---|---|---|
| `rounded-sm` | `--radius − 4px` | small chips, inputs |
| `rounded-md` | `--radius − 2px` | buttons, inputs, cards (default) |
| `rounded-lg` | `--radius` | dialogs, large cards |
| `rounded-full` | pill/circle | avatars, floating buttons, badges |

Don't use arbitrary radius (`rounded-[10px]`). Learner adds `rounded-xl`/`rounded-2xl`.

---

## 5. Shadow

There is **no custom shadow token scale yet** — Tailwind defaults are in use. Until a scale is added
(tracked in [08-modernization.md](./08-modernization.md)):

- Use Tailwind defaults consistently: `shadow-sm` (subtle), `shadow` / `shadow-md` (cards, popovers),
  `shadow-lg` (modals, floating).
- Never hand-roll `box-shadow` via inline styles or `shadow-[...]` arbitrary values.
- One elevation step per surface type — don't stack random shadows.

---

## 6. Z-index

Admin has no global z-index scale; the learner catalogue defines one. Use this ordering (matches
learner's `--catalogue-z-*`) and avoid arbitrary `z-[9999]`:

| Layer | z |
|---|---|
| base content | 0 |
| dropdown | 10 |
| sticky | 20 |
| fixed header | 30 |
| modal backdrop | 40 |
| modal | 50 |
| popover | 60 |
| tooltip | 70 |

Radix-based primitives (Dialog, Popover, Tooltip, DropdownMenu) already manage stacking — prefer them
over manual z-index.

---

## Quick reference: banned vs. correct

| ❌ Banned | ✅ Correct |
|---|---|
| `bg-[#FFA500]` | `bg-warning-500` |
| `text-[#525252]` | `text-neutral-600` |
| `style={{ padding: 7 }}` | `className="p-2"` |
| `text-[13px]` | `text-caption` or `text-body` |
| `rounded-[10px]` | `rounded-md` / `rounded-lg` |
| `className={'a ' + cond}` | `className={cn('a', cond && 'b')}` |
| `z-[9999]` | `z-50` (modal) etc. |
