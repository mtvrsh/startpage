An Invidious backend is feasible with the existing `Backend` interface. The instance works from a browser, sends `access-control-allow-origin: *`, requires no API key for these endpoints, and needs **no CSP or `startpage-api` worker changes**. The only real data-model gap is upload timestamps on playlist items.

## What I verified against `https://yt.chocolatemoo53.com`

Invidious version: `2026.11.04-ada831e`.

| App operation     | Invidious v1 endpoint                 | Relevant response                                                                                                        |
| ----------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `search()`        | `GET /api/v1/search?q=…&type=channel` | `author`, `authorId`, `authorThumbnails`, `subCount`                                                                     |
| `fetchChannel()`  | `GET /api/v1/channels/:ucid/videos`   | `{ videos, continuation }`, 60 videos/page, `published` (epoch **seconds**), `publishedText`, `lengthSeconds`, `liveNow` |
| `feedFetchAll`    | `GET /api/v1/playlists/UU<ucid>`      | up to 200 videos, but **no `published`/`publishedText`**                                                                 |
| `fetchPlaylist()` | `GET /api/v1/playlists/:plid`         | `{ title, author, videos }`, also **no `published`/`publishedText`**                                                     |
| handle → UC id    | `GET /api/v1/resolveurl?url=…`        | `{ ucid }`                                                                                                               |

Notes from live testing:

- `GET /api/v1/channels/@handle/videos` returns **500** on this instance, so handles must be resolved through `resolveurl` first. `https://youtube.com/c/…` and `/user/…` also resolve successfully.
- Images are proxied (`/vi/<id>/hqdefault.jpg` redirects to `wsrv.nl`, `/ggpht/…` to `yt3.ggpht.com`) and send CORS `*`. The existing CSP (`connect-src 'self' https:`, `img-src 'self' https: data:`) already allows this.
- `resolveurl` and all listing endpoints are CORS-enabled.
- No API key/auth is required on this instance.

## Caveats

1. **Playlist dates are unavailable.** Invidious playlist video objects contain only `videoId`, `title`, `author`, `lengthSeconds`, `liveNow`, and thumbnails. So `feedFetchAll` and regular playlists would map `uploaded: 0` and `uploadedDate: ''`, which affects cross-channel chronological sorting. Normal channel mode has proper dates.
2. **Handle/legacy channels cost one extra request.** Each refetch of an `@handle` or legacy `/c/`/`/user/` channel needs a `resolveurl` call. Bare legacy keys also lose the `/c/` vs `/user/` distinction, so resolution has to try one then the other.
3. **Public instances are unreliable.** `inv.nadeko.net` returns 403 “Endpoint disabled”, `invidious.nerdvpn.de` returns 401 for channel endpoints, and the two instances in `scripts/instances.json` are dead. The provided instance is currently healthy, but the instance must be configurable.
4. **No pagination.** Normal channel mode returns 60 videos; `feedLimit > 60` won’t fill. Playlists return ~200. This matches the other backends, which also fetch one page.
5. **No API-key support.** Embedding a key in a client-side app is unsafe, so instances that require auth can’t be supported.
6. **Sub-second timestamps.** Invidious `published` is in seconds, while the shared contract fixtures use milliseconds. The contract test should use a whole-second timestamp so all three backends can assert the same value.

## Proposed implementation

1. **`src/lib/api/backend-types.ts`** — add `'invidious'` to `BACKEND_TYPES`.
2. **New `src/lib/api/invidious-backend.ts`**
   - `static name = 'invidious'`.
   - `search()`: `type=channel`, map `authorId` → `https://youtube.com/channel/<id>`, best `authorThumbnails` entry, `subCount`.
   - `fetchChannel()`: if the id is a `UC…` id, use it directly; otherwise resolve via `resolveurl`. Use `/playlists/UU…` when `feedFetchAll && isChannelId(id)`, otherwise `/channels/<ucid>/videos`.
   - `fetchPlaylist()`: `/api/v1/playlists/<id>`.
   - Map `published * 1000`, `publishedText`, `lengthSeconds` → `humanizeDuration`, `liveNow` → `live` + `now`, zero duration → `''`, `videoThumbnails` → `hqdefault`/`high`.
   - Same `cache: reload ? 'reload' : 'default'` and `AbortSignal.timeout` pattern as `StartpageBackend`.
3. **`src/lib/api/backend.ts`** — import and register `InvidiousBackend`.
4. **`src/share/config.ts`** — add an Invidious instance setting, defaulting to `https://yt.chocolatemoo53.com`.
5. **`src/share/strings.ts`** — add `invidious: 'Invidious'`; optionally add `backend: 'Backend'` for the settings separator (currently says “Piped” for every backend).
6. **`src/lib/SettingsGeneral.svelte`** — add `invidious` to `backendLabel` and render the Invidious instance control.
7. **Optional: `src/util/youtube.ts`** — extend `getDirectThumbnail` to rewrite Invidious `/vi/<id>/<file>` → `https://i.ytimg.com/...` and `/ggpht/<path>` → `https://yt3.ggpht.com/...` when `useDirectThumbnails` is enabled.
8. **Tests**
   - Add Invidious to `tests/backend-contract.test.ts` with a route adapter and fixtures.
   - Add Invidious-specific tests for handle resolution, playlist date fallback, and `feedFetchAll`.
   - Add config and thumbnail tests if those helpers change.
9. **`AGENTS.md`** — document the backend, resolution step, and playlist-date caveat.
10. Verify with `npm run check && npx vitest run && npx prettier --check .`.

## Decisions worth settling before implementation

1. **Instance config:** a plain text field (`invidiousUrl`, recommended because instances rotate and users need to change it without editing JSON) vs. the Piped-style `instance` + `instances` select. The select is more consistent with the existing UI but makes changing instances awkward.
2. **`feedFetchAll` behavior:** use the `UU` uploads playlist (all uploads including shorts/streams, but blank dates) vs. use `/channels/:ucid/videos` (dates, but no shorts/streams). I’d lean toward the `UU` playlist and document the blank dates.
