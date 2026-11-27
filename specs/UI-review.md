# UI review — remaining issues

Last verified against commit `a09a14d` (2026-11-27).

## Highest value

- **Touch targets are about 24px.** `$icon-button-size: 1.5rem` (`src/lib/scss/_variables.scss:38`) is used by the column add button (`src/lib/Column.svelte:118`), dock buttons (`src/lib/Dock.svelte:71`), settings close (`src/lib/Settings.svelte:69`) and `.column__action` (`src/app.scss:137`); sync is ~32×24 and the filter toggler/remove buttons are 24px tall. No minimum hit area or coarse-pointer enlargement exists.
- **The dock covers column content and stays dimmed at rest.** It is `position: fixed` at `opacity: .6` (`src/lib/Dock.svelte:56`, `src/lib/scss/_variables.scss:50`) and no scrollable column reserves bottom padding (`src/lib/Column.svelte:134`). Touch users get no hover reveal; the `(hover: hover)` rule applies only to row remove buttons (`src/app.scss:190`).
- **A few contrast pairs are still below 4.5:1** (tokens in `src/app.scss:10-47`, palette in `src/lib/scss/_themes.scss`): accent text on surface **3.64:1** (light), muted/inactive text on surface **3.55:1** light and **4.17:1** dark, error text on surface **3.37:1** (dark), and the active fill foreground/background pair **4.40:1** (light). `color-scheme` is not declared (`src/app.scss:31` only has the dark media query).

## Smaller cleanup

- **Buttons have no `:focus-visible` ring.** `button-core` uses `&:hover, &:focus` with `outline: none` (`src/lib/scss/_mixins.scss:67-72`), so focus is shown only as a fill change. `aria-pressed` is absent; open/selected state is class-driven.
- **Form widths and alignment still vary.** Number field `4rem` (`src/lib/InputNumber.svelte:122`), select intrinsic width (`src/lib/InputSelect.svelte:40`), settings URL fields `18rem` (`src/lib/SettingsGeneral.svelte:362`), and right-aligned settings rows (`src/lib/SettingsGeneral.svelte:312`). The toggle's off-state track and thumb are still two close surface shades (`src/lib/inputs/ToggleSwitch.svelte:63`).
- **Bookmark links lack `:visited` styling** (`src/lib/Bookmarks.svelte:289`); video and feed links have it.
- **Chromium scrollbars are hidden globally** (`src/app.scss:202`) while Firefox still shows them.
- **Heading levels are inconsistent.** Settings title is `<h1>` (`src/lib/Settings.svelte:17`), there is no home `<h1>`, and feed/bookmark item titles are not headings. Video items are `h3`, column headers and settings separators `h2`.
- **Video rows do not adapt at tablet widths.** Fixed `10.5rem` thumbnail and `min-height: 5.875rem` with no breakpoint override (`src/lib/Channels.svelte:150,159`); the 3-line clamp (`:208`) truncates longer titles.
- **`Version:` can be blank locally.** No `VITE_GIT_COMMIT` fallback in `src/config.ts:14`; the label renders unconditionally (`src/lib/SettingsGeneral.svelte:274`). CI supplies the value at build time.
- **Text glyphs (`+`, `−`, `×`) are mixed with SVG icons** in buttons, giving them different weight and alignment.

## Deliberately not re-opening

- Keeping one grey (`--color-fg-inactive`) for muted text and disabled controls is an intentional choice documented in `AGENTS.md`; do not add a four-way grey token split.
- The shared button mixins, `active-tint`, `input-base` primitive, four-step font scale and style-token tests already solved the old fragmentation; do not reintroduce their removed tokens or ad-hoc font sizes.
