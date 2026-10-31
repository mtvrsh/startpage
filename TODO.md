# Known Issues

## Shorts-Only Channels: No Duration/Upload Date in UU Playlists

### Issue

When `feedFetchAll` mode fetches a UU (upload) playlist for a shorts-only channel
(e.g. `UCkQ774ot9mhH3wWMsjzGq2g` — Asmongold Shorts), YouTube returns items as
`ShortsLockupView` renderers (verified live, 2026-10-31). These items:

- Have **no duration** — nothing duration-like exists in the renderer; the
  mapper yields `{seconds: "0", text: ""}`.
- Have **no publish date** — only view counts are available
  (`accessibility_text` is e.g. `"man, 8.8 thousand views - play Short"`,
  `overlay_metadata.secondary_text` is e.g. `"42K views"`), so the mapper
  yields `{text: ""}` and `uploaded: 0`.
- `uploaded: 0` sorts **last** (`Channels.BY_UPLOADED` is a descending
  comparator, `src/share/channels.ts`).

So even the vendored-then-removed Piped/NewPipeExtractor cannot provide
duration or upload date for these items; it is a YouTube API limitation. The
same limitation applies to Piped when it maps shorts items.

### Ids and thumbnails (the real bug)

`entity_id` is **not** `shorts-shelf-item-{videoId}` as once assumed — it is an
opaque 16-char hash (e.g. `C1A2D28FC54EBFE2`). The current workaround takes the
last 11 characters via `/([a-zA-Z0-9_-]{11})$/` and constructs a synthetic
thumbnail URL — which yields a **bogus video id** and **broken thumbnails**:

- Live worker output: `id: "28FC54EBFE2"`,
  `thumbnail: https://i.ytimg.com/vi/28FC54EBFE2/hqdefault.jpg` → **404**.
- Real id for that item: `8U19uSzmPUU` → `hqdefault.jpg` → 200.

The actual data lives elsewhere in the renderer (current youtubei.js):

- Real video id: `on_tap_endpoint.payload.videoId` (also `/shorts/<id>` in
  `on_tap_endpoint.metadata.url`).
- Real thumbnails: `on_tap_endpoint.payload.thumbnail.thumbnails[]`
  (`frame0.jpg`) or `thumbnail_view_model.image[]` (`oardefault.jpg`).
  `v.thumbnail` is an **empty array** for this renderer.

### Fix (in the worker)

In `startpage-api/src/router.ts` — `mapPlaylistItem()` and the `getChannel()`
video mapper:

- Resolve the id via `v.content_id` → `v.on_tap_endpoint?.payload?.videoId`;
  never derive it from `entity_id`.
- Resolve thumbnails via `v.content_image?.image` → `v.thumbnail` /
  `v.thumbnails` → `v.thumbnail_view_model?.image` →
  `v.on_tap_endpoint?.payload?.thumbnail?.thumbnails`; drop the `entity_id`
  regex fallback.
- Duration/date stay empty as today; fetching each video page
  (`getStreamInfo()` / `player`) has the full data but is too expensive for a
  feed context.

### Notes

- `/channels` mode is unaffected for this channel: it returns its long-form
  videos with real ids; shorts only appear via the UU playlist.
- No test covers the `entity_id` branch; add one alongside the fix using a
  captured `ShortsLockupView` fixture.

### Related Files

- `startpage-api/src/router.ts` — `mapPlaylistItem()` and `getChannel()` video
  mapper (`startpage-api/src/index.ts` is only the Workers entry point)
- `src/lib/api/startpage-backend.ts` — frontend mapping of the playlist items
- `src/share/channels.ts` — `BY_UPLOADED` sort order
- `startpage-api/node_modules/youtubei.js/dist/src/parser/classes/ShortsLockupView.d.ts` —
  renderer shape
