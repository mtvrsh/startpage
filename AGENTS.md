# Startpage - Agent Instructions

## Project Overview
Lightweight YouTube feed startpage built with Svelte 5 + Vite, using Piped API or YouTube.js backend for fetching channel videos. Deployed to GitHub Pages.

## Commands
- `deno task test` - Run Vitest tests
- `deno task check` - Svelte typecheck + TypeScript checks (node config + full tsc pass; `tsc -p tsconfig.node.json` is `composite` and regenerates the gitignored `src/constants.d.ts`)
- `deno task dev` - Start dev server
- `deno task build` - Production build (output: `dist/`)
- `deno task preview` - Preview production build locally

### Deno usage
`deno task <name>` falls back to `package.json` scripts; the toolchain (`vite`, `vitest`, `svelte-check`) runs under Node. Only `scripts/healthcheck.ts` is native Deno (`deno run`, JSR). A full Deno-runtime migration is not feasible (vitest `.svelte` imports via Vite, `svelte-check` typechecker, `wrangler` backend, `node:23-slim` CI/Docker).

## Architecture

### Entry Points
- `src/main.ts` - Mounts `App.svelte`
- `src/App.svelte` - Router (navaid), global state subscriptions, service worker registration, settings overlay, dock
- `src/config.ts` - App-level config (base path `/startpage`, search delay, etc.)

### Layout
- No top navigation bar. `Home.svelte` shows the three main columns (Channels, Bookmarks, Feeds); below the `xl` breakpoint only the selected column is shown with a bottom tab bar.
- All three columns use `Column.svelte`: compact header with title + header actions + `+` toggle, an optional collapsible form snippet, and a scrollable body.
- Shared control primitives (`.column__*`, `.button`) live in `src/app.scss` because they are used across component scopes.
- `Dock.svelte` is the fixed bottom-right entry point for the floating search palette and settings (mouse/touch access alongside keybinds).
- `SearchPalette.svelte` renders only when `app.searchOpen` is true; it is mounted globally in `App.svelte`.

### State Management
- **`src/share/config.ts`** - `config` store (writable), `Config` class extends `LocalStorage`
- **`src/share/status.ts`** - `status` store (writable), `Status` class extends `LocalStorage`
- **`src/share/channels.ts`** - `channels` store (`Map<string, Channel>`), `Channels` class extends `LocalStorage`
- **`src/share/bookmarks.ts`** - `bookmarks` store (`Map<string, Bookmark>`), `Bookmarks` class (manual localStorage sync, NOT `LocalStorage`)
- **`src/share/feeds.ts`** - `feeds` store (`Map<string, Feed>`, Atom/RSS subscriptions persisted as `[url, Feed][]`) + in-memory `entries` and `feedStates` caches, `Feeds` class extends `LocalStorage`
- **`src/lib/state/app.svelte.ts`** - `$state` app object (route, filter)

### LocalStorage Pattern
- Subclasses of `LocalStorage` must define `static override LS_NAME = 'name'`
- `LocalStorage.get()` returns `undefined` on parse error (graceful degradation)
- `saveOnUpdate()` subscribes store to persist on every change
- `Bookmarks` uses its own `subscribeToLocalStorage()` with Map serialization

### Routing
- Uses `navaid` (client-side router)
- Routes defined in `src/routes.ts`
- Settings is a single-page overlay at `/settings` (`Settings.svelte` wrapping `SettingsGeneral`). The old `/settings/channels` and `/settings/bookmarks` URLs redirect to `/settings`.
- Settings renders as a modal overlay over a still-mounted `Home`; close (button, `Escape`/configured close key, backdrop) navigates home. Deep links still work because the real route is preserved.
- GitHub Pages SPA fallback: `public/404.html` stores path in localStorage, read by `src/util/github.ts`

### Key Components
- `SearchPalette.svelte` - Floating channel search/add palette, opened by the configurable `s` keybind or the dock; searches via the active backend, adds channel/playlist URLs, closes after adding
- `Column.svelte` - Shared compact column shell (header, actions, add toggle, form slot, scrolling body)
- `Channels.svelte` - Video feed column; calls `Channels.refetch()` on mount, inline channel URL add form
- `ChannelsFilter.svelte` - Header dropdown to filter the feed by channel; rows support inline rename (right-click or long-press, Enter/blur saves, Escape cancels) and remove (`×`)
- `ChannelsSync.svelte` - Header sync button
- `Bookmarks.svelte` - Bookmarks column grouped by tag, inline add form, inline edit form (name/tag/URL via right-click or long-press), per-entry remove
- `Feeds.svelte` - Atom/RSS reader column; merges entries from all subscriptions, inline add/remove and rename (click, right-click, or long-press). Parsing lives in `src/util/feed.ts` (Atom, RSS 2.0, RSS 1.0/RDF); entry summaries are text-only, never `{@html}`, and hidden unless `feedShowSummary` is enabled
- `Dock.svelte` - Fixed search/settings buttons (also handles the `,` settings keybind)
- `Closeable.svelte` - Wrapper for dropdowns/menus, closes on configurable key (default Escape) or click-outside, has `onClose` callback

### Backend (API Strategy)
- Two API sources: **Piped API** (public instances) and **startpage-api** (YouTube.js deployed on Cloudflare Worker in `startpage-api/`)
- `src/lib/api/backend.ts` — `Backend` interface, `backends` record mapping keys to classes, `backend` derived store
- Each backend class has `static backendKey = 'name' as const` — the single source of truth for its identifier
- `BACKEND_TYPES` array derived from record keys, `InstanceType` type derived from `BACKEND_TYPES`
- `SettingsGeneral.svelte` maps `InstanceType` → UI labels via `backendLabel` record

Adding a new backend:
1. Create `src/lib/api/<name>-backend.ts` with `class <Name>Backend implements Backend { static backendKey = '<name>' as const }`
2. Add import + entry to `backends` record in `backend.ts`
3. Add UI label to `src/share/strings.ts`
4. Add label entry in `SettingsGeneral.svelte` `backendLabel` map
5. If it needs unique config fields, add an `{#if}` block in the settings template

### SCSS
- Variables: `src/lib/scss/_variables.scss` (gaps, z-index, etc.)
- Themes: `src/lib/scss/_themes.scss` (Gruvbox color palette)
- Breakpoints: `src/lib/scss/_breakpoints.scss`
- Mixins: `src/lib/scss/_mixins.scss` (line-clamp)
- Components use `@use 'scss/variables' as *;` (Vite resolves via `src/lib/scss/`)
- Global layout/control primitives live in `src/app.scss` (`Column` chrome form controls, `.button`)

## Important Conventions & Quirks

### Inline editing
- Editable labels use the `editGesture` action (`src/lib/gestures.ts`): right-click on desktop or long-press on touch. Feeds additionally rename on a normal click.
- Single-field renames use the `inlineRename` action (`src/lib/inline-rename.ts`): Enter/blur saves, Escape (keyup) cancels. Focus is flushed synchronously so mobile keyboards open from the gesture.
- Bookmarks edit name, tag, and URL inline. URL changes are re-keyed through `Bookmarks.replace()` and rejected when the new URL already exists.

### Service Worker
- `src/sw.js` — built via `vite.config.js:10-20` Rollup `input: { index: './index.html', sw: './src/sw.js' }` + `output.entryFileNames: sw ? 'sw.js' : 'assets/[name].js'` to keep scope at `/startpage/sw.js` (registered in `src/App.svelte:18` as `config.base + '/sw.js'` — `config.base` is `src/constants.ts:1` `BASE`; registration is prod-only via the `import.meta.env.PROD` guard at `src/App.svelte:17`, because `vite dev` does not serve the bundled SW). Do not move SW under `assets/` or scope breaks.
- `vite.config.js:15-16` `assetFileNames: 'assets/[name].[ext]'` / `chunkFileNames: 'assets/[name].js'` are **intentionally without `[hash]`** — SW manifest in `src/sw.js:7-13` hard-codes `'.', '404.html', 'index.html', 'favicon.svg', 'assets/index.js', 'assets/index.css'`. **Invariant:** if hashing is re-enabled or code-splitting emits extra chunks, the hard-coded list will 404 or miss coverage — update `src/sw.js` manifest or switch to generated manifest (`workbox` / `vite-plugin-pwa`).
- Version `src/sw.js:1` `VERSION = import.meta.env.VITE_GIT_COMMIT` (also `src/config.ts:14` / `src/lib/SettingsGeneral.svelte:211`) — no fallback, must be set at build: `.github/workflows/deploy.yml:24` `VITE_GIT_COMMIT=$(git rev-parse --short HEAD) npm run build` (Vite replaces at build time via `VITE_` prefix). Local builds without it produce `void 0` / `"undefined"` cache name — intentional.
- Install `src/sw.js:15-17` guards `resp.ok` before `cache.put` to avoid caching 404/500 error responses (prevents cache poisoning).

### Atom/RSS reader (CORS)
- `feedProxyUrl` in `src/share/config.ts` defaults to the `startpage-api` worker. Requests become `<feedProxyUrl>/feed?url=<encoded feed URL>`; an empty value means direct `fetch`, which only works for feeds that send `Access-Control-Allow-Origin` (many blogs and `youtube.com/feeds` do not).
- `startpage-api/src/feed-proxy.ts` implements `GET /feed?url=`. It returns raw XML so the frontend remains the only parser, allows only XML feed content types, caps responses at 2 MB, times out after 10 s, and blocks local/private hosts plus every redirect target. It follows at most four redirects manually.
- Feed metadata is persisted; parsed entries are memory-only and re-fetched per `cacheLifetimeInMinutes` (`reload` bypasses it). Entries across feeds are deduped by URL and capped by `readerLimit`.
- Feed summaries are stripped to plain text deliberately — do not switch to `{@html}` without a sanitizer.

### Testing
- Test files in `tests/`
- Tests import from `../src/` paths
