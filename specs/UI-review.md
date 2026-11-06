## Audit result

I inspected the rendered app with populated channels, bookmarks, feeds, a failed feed, open add forms, the channel filter, the settings overlay, and the search palette. I checked desktop, the single-column layout below `1200px`, and a narrow mobile-width viewport.

No files were changed.

The typeface is consistent — the app uses one monospace stack throughout. The main problems are **size scale, color tokens, state styling, and control consistency**.

### 1. Contrast is the biggest issue

The current Gruvbox mapping uses background colors as foreground text and reuses one accent color for both text and fills. Computed contrast ratios:

| Usage                               |      Light |       Dark |
| ----------------------------------- | ---------: | ---------: |
| Accent text on page background      | **2.80:1** |     4.65:1 |
| Accent text on surface              | **2.31:1** | **3.66:1** |
| `--color-fg-inactive` on background | **1.92:1** | **2.26:1** |
| `--color-fg-inactive` on surface    | **1.59:1** | **1.78:1** |
| Error text on surface               | **3.99:1** | **2.12:1** |
| `accent-fg` on accent fill          |     4.65:1 | **2.80:1** |
| `accent-fg` on accent-light fill    | **2.95:1** | **1.85:1** |
| Visited purple on background        | **3.73:1** | **3.48:1** |
| Dark text on error fill             | **2.69:1** |     4.82:1 |

This affects nearly every important label:

- column titles
- bookmark links
- feed entry titles
- video titles
- tags
- selected tab
- filter/button text
- error messages
- empty states

The dark theme is especially problematic for filled buttons. `--color-accent-fg` is always the regular foreground color, but the fill switches from `--color-accent` to `--color-accent-light` on hover/open. Hovering a primary button actually reduces contrast:

- `.column__submit:hover`
- `.column__add.open`
- `.filter__toggler.focus`
- `.dock__button:hover`
- `.settings__close:hover`
- `.bookmarks__edit-cancel:hover`

The open add button is a visible example: the `−` is dark text on dark green.

**Files:** `src/app.scss`, `src/lib/scss/_themes.scss`, `src/lib/Column.svelte`, `src/lib/Bookmarks.svelte`, `src/lib/Dock.svelte`, `src/lib/Settings.svelte`

### 2. Muted and disabled shades are not one system

There are at least five different “inactive” treatments:

- `--color-fg-inactive` for empty states, feed metadata, summaries, disabled settings labels, loading text, the version label, and the search icon.
- Browser-default placeholder color for inputs — roughly `currentColor` at 54% opacity, not the inactive token.
- The dock uses `opacity: .45`.
- Desktop remove buttons use `opacity: 0`.
- Disabled toggle knobs use `--color-surface-light`.
- `--color-surface-inactive` exists but is unused.

This means placeholders, secondary metadata, disabled controls, and quiet actions all have different greys and different contrast. The dock’s effective icon contrast is only about **1.53:1** in light mode and **2.04:1** in dark mode, so it looks disabled even though it is active. On touch devices there is no hover to reveal it.

**Recommendation:** split the roles:

- `--color-text-muted` for metadata
- `--color-text-disabled` for disabled controls
- `--color-text-placeholder` for placeholders
- `--color-surface-disabled` for disabled control backgrounds
- Keep opacity only for transient UI

### 3. Button styles are fragmented

| Control                                   | Default                | Hover / active                           |
| ----------------------------------------- | ---------------------- | ---------------------------------------- |
| `.column__submit`                         | accent fill            | accent-light fill                        |
| `.column__add.open`                       | accent-light fill      | —                                        |
| `.filter__toggler.focus`                  | accent fill            | —                                        |
| `.button` (Export/Import)                 | bg-light + accent text | surface-light only                       |
| `.column__action` / dock / settings close | surface + accent text  | accent fill                              |
| `.bookmarks__edit-cancel`                 | surface + accent text  | accent fill                              |
| Home tabs                                 | surface + surface-fg   | surface-light; selected accent text only |

Specific inconsistencies:

- The two “open” states — filter open and add open — use different greens.
- Primary button hover has poor contrast.
- `.button` behaves like a secondary button, while `.column__action` becomes primary on hover.
- `.bookmarks__edit-cancel` duplicates button styling instead of using a shared secondary variant.
- The active tab is indicated only by accent text, while other active controls use a filled background. Its selected state has lower contrast than its inactive state.
- Search/settings/sync use SVG icons, while add/remove/close use text glyphs (`+`, `−`, `×`), producing different weights and alignment.

**Recommendation:** define shared button variants in `src/app.scss`:

- primary
- secondary
- ghost
- danger
- icon
- tab / selected

Use `aria-expanded` / `aria-pressed` to drive open/active styling consistently.

### 4. Form controls have five different visual languages

- Column inputs: surface background, bottom border, accent focus outline.
- Search palette input: surface background, accent focus outline.
- Settings `Text`: surface background, bottom border, accent focus outline.
- Settings `InputSelect`: page background, accent text, no visible focus outline.
- Settings `InputNumber`: page background, accent text, fills with accent on hover/focus.
- Feed/filter rename inputs: page background, accent outline.

They also differ in size:

- column inputs: `12.8px`
- most settings and palette inputs: `12px`
- input heights: roughly `32–35px`

Settings controls are right-aligned with inconsistent widths. Number inputs look like plain text until the tiny spinner is noticed.

The toggle has no visible keyboard focus state: the real checkbox is `0×0` and transparent, and there is no `:focus-visible` style for the slider. Its off state is also low-contrast because the track and knob use two close surface shades.

**Recommendation:** create shared field primitives with consistent height, font size, background, border, placeholder, disabled state, and focus-visible ring. Add explicit focus styles for `InputSelect`, `InputNumber`, and `ToggleSwitch`.

### 5. Touch targets are too small

Several controls fall below the usual 44×44px touch target:

- column add: `24×24`
- sync button: `32×24`
- filter button: about `38×24`
- settings close: `24×24`
- remove buttons: about `26×22`
- dock buttons: `32×32`

**Recommendation:** give icon buttons a minimum `36–44px` hit area while keeping the visible icon small.

### 6. The dock overlaps content

The fixed dock sits over the column body and covers feed metadata/dates. It is translucent at `opacity: .45`, so it both obstructs content and appears inactive.

**Recommendation:** reserve bottom padding in scrollable column bodies, or move the dock into the header/navigation. Do not leave a persistent interactive control at 45% opacity.

### 7. Typography scale is ad hoc

Measured sizes:

- body: `12px` in Firefox’s default monospace, but root `1rem` is `16px`
- feed metadata: `11.2px` (`.7rem`)
- video title, tags, column actions: `12px` (`.75rem`)
- column/settings titles: `12.8px` (`.8rem`)
- bookmark and feed entry titles: `13.6px` (`.85rem`)
- add/remove/close glyphs: `16px`
- image placeholder: `32px`

The base body size being different from the root size means `font: inherit` controls and `rem`-sized controls diverge, and that varies by browser because the default monospace size is not standardized.

Equivalent content also differs across columns:

- video titles are `.75rem`
- feed and bookmark item titles are `.85rem`
- bookmark item titles are regular weight, while video/feed titles are bold
- feed metadata is `.7rem`, while video metadata uses the inherited foreground at `12px`

**Recommendation:** define a small token scale for metadata, body, item title, column title, and icon/large text, then use the same token for equivalent content across all three columns.

### 8. Other common UI issues

- **Link states:** video titles/thumbnails get visited styling; bookmark links and feed entry links do not.
- **Search palette:** result links use `surface-fg` instead of the accent color used by other links.
- **Backdrop opacity:** search is `.45`; settings is `.55`.
- **Scrollbars:** Chromium scrollbars are globally hidden; Firefox still shows them.
- **Heading semantics:** each video item uses an `<h1>`, column headers use `<h2>`, settings uses `<h1>`, and settings section separators also use `<h1>`.
- **Unused tokens:** `--color-fg-light`, `--color-surface-inactive`, `--color-visited-fg`, and `--color-warrning` (misspelled) are unused.
- **Import errors:** `.general__error` is used in `SettingsGeneral.svelte` but has no CSS rule, so import failures are not styled red like every other error.
- **Responsive video feed:** between `768px` and `1199px` the single column keeps a fixed `10.5rem` thumbnail and `5.875rem` row height, leaving large empty space at wider single-column widths.
- **Fixed row height:** the video row can clip if the typography scale is increased.
- **Toggle contrast:** the off-state knob/track and disabled knob are low-contrast UI boundaries, not just text.
- **Version display:** locally shows `Version:` with no value when `VITE_GIT_COMMIT` is absent.

## Proposed fix plan

I would handle this as a token and primitive refactor, not scattered one-off CSS fixes.

### Phase 1 — Semantic tokens and theme contrast

1. Add explicit type tokens and set a deliberate base size.
2. Add semantic color tokens:
   - `--color-text`
   - `--color-text-muted`
   - `--color-text-disabled`
   - `--color-text-placeholder`
   - `--color-link`
   - `--color-link-visited`
   - `--color-accent-fill`
   - `--color-accent-fill-hover`
   - `--color-on-accent`
   - `--color-on-accent-hover`
   - `--color-danger-text`
   - `--color-danger-fill`
3. Separate “accent as text” from “accent as background.” The current single accent cannot satisfy both roles.
4. Add explicit `::placeholder` styling and `color-scheme: light dark`.
5. Choose contrast-compliant values for light and dark themes rather than reusing background palette stops as foreground colors.

### Phase 2 — Shared button system

1. Expand `.button` into primary/secondary/ghost/danger/icon/tab variants.
2. Replace custom rules in `Bookmarks.svelte`, `Settings.svelte`, `Dock.svelte`, `Column.svelte`, and `Home.svelte`.
3. Use one open/selected treatment for filter, add, tabs, and toggles.
4. Standardize icons and hit areas.
5. Add consistent `:focus-visible` rings.

### Phase 3 — Shared form controls

1. Create common input/select/number/toggle primitives.
2. Normalize height, font size, background, border, placeholder, and disabled state.
3. Add visible keyboard focus to `InputSelect`, `InputNumber`, and `ToggleSwitch`.
4. Align settings labels and controls consistently.
5. Increase number input affordance so it does not look like plain text.

### Phase 4 — Layout and state cleanup

1. Add bottom padding or relocate the dock so it never covers content.
2. Make the dock fully visible on touch devices.
3. Make video rows flexible or adapt the thumbnail layout for wider single-column widths.
4. Style `.general__error` and unify all error states.
5. Remove unused tokens and fix the `--color-warrning` typo.

### Phase 5 — Verification

- Recheck desktop, `~1000px`, and mobile widths.
- Recheck light and dark color schemes.
- Tab through every control and confirm visible focus.
- Verify the main contrast pairs meet WCAG AA.
- Check touch targets at mobile width.

The highest-value order is: **contrast/theme tokens → button and form primitives → disabled/focus states → dock/layout fixes → typography cleanup**.
