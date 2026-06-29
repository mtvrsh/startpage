# Startpage - Agent Instructions

## Project Overview
Lightweight YouTube feed startpage built with Svelte 5 + Vite, using Piped API or YouTube.js backend for fetching channel videos. Deployed to GitHub Pages.

## Commands
- `deno task test` - Run Vitest tests
- `deno task check` - Svelte typecheck + TypeScript checks (node config + full tsc pass)
- `deno task dev` - Start dev server
- `deno task build` - Production build (output: `dist/`)
- `deno task preview` - Preview production build locally

## Architecture

### Entry Points
- `src/main.ts` - Mounts `App.svelte`
- `src/App.svelte` - Router (navaid), global state subscriptions, service worker registration
- `src/config.ts` - App-level config (base path `/startpage`, search delay, etc.)

### State Management
- **`src/share/config.ts`** - `config` store (writable), `Config` class extends `LocalStorage`
- **`src/share/status.ts`** - `status` store (writable), `Status` class extends `LocalStorage`
- **`src/share/channels.ts`** - `channels` store (`Map<string, Channel>`), `Channels` class extends `LocalStorage`
- **`src/share/bookmarks.ts`** - `bookmarks` store (`Map<string, Bookmark>`), `Bookmarks` class (manual localStorage sync, NOT `LocalStorage`)
- **`src/lib/state/app.svelte.ts`** - `$state` app object (route, filter)

### LocalStorage Pattern
- Subclasses of `LocalStorage` must define `static override LS_NAME = 'name'`
- `LocalStorage.get()` returns `undefined` on parse error (graceful degradation)
- `saveOnUpdate()` subscribes store to persist on every change
- `Bookmarks` uses its own `subscribeToLocalStorage()` with Map serialization

### Routing
- Uses `navaid` (client-side router)
- Routes defined in `src/routes.ts`
- Settings page reuses `Settings.svelte` component with `tabIndex` prop to switch tabs (General=0, Channels=1, Bookmarks=2)
- GitHub Pages SPA fallback: `public/404.html` stores path in localStorage, read by `src/util/github.ts`

### Key Components
- `Search.svelte` - Channel search via Piped API, global default `s` keybind to focus (configurable, guarded when typing in inputs)
- `Channels.svelte` - Video feed, calls `Channels.refetch()` on mount
- `ChannelsFilter.svelte` - Dropdown to filter feed by channel
- `Closeable.svelte` - Wrapper for dropdowns/menus, closes on configurable key (default Escape) or click-outside, has `onClose` callback
- `Dropdown.svelte` - Uses `Closeable`, `open = $bindable(false)` for two-way binding

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

## Important Conventions & Quirks

### Service Worker
- `public/sw.js` - versioned by commit hash (replaced during CI build via sed)
- Cached assets: `.`, `404.html`, `index.html`, `favicon.svg`, `assets/index.js`, `assets/index.css`

### Testing
- Test files in `tests/`
- Tests import from `../src/` paths
