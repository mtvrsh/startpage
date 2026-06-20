# Known Issues

## Shorts-Only Channels: No Duration/Upload Date in UU Playlists

### Issue
When `feedFetchAll` mode fetches a UU (upload) playlist for a shorts-only channel
(e.g. `UCkQ774ot9mhH3wWMsjzGq2g` — Asmongold Shorts), YouTube returns items as
`ShortsLockupView` renderers. These items:

- Have **no duration** (`extractDuration()` returns null → `{seconds:"0", text:""}`)
- Have **no publish date** (`extractPublished()` returns `{text:""}`)
- Have **no duration** (`extractDuration()` returns null → `{seconds:"0", text:""}`)
- Have **no publish date** (`extractPublished()` returns `{text:""}`)
- Thumbnails are handled by extracting the video ID from `entity_id` via regex
  (`/([a-zA-Z0-9_-]{11})$/`) and constructing a synthetic URL
  (`https://i.ytimg.com/vi/{id}/hqdefault.jpg`). Works correctly.

### Why This Happens
For a **regular channel** that posts some shorts, YouTube renders all items in the
UU playlist as `LockupView` with `content_type = 'VIDEO' | 'SHORT' | 'MOVIE'`.
These have a consistent structure with `content_id`, `content_image.image`
(thumbnails), duration overlays, and metadata rows (published date).

For a **shorts-only channel**, YouTube switches to `ShortsLockupView` renderers
— an entirely different node type:

- Identifier: `entity_id` instead of `content_id` (format: `shorts-shelf-item-{videoId}`)
- Thumbnails: stored in `thumbnail.sources[]` or accessible via
  `on_tap_endpoint.payload.thumbnail.thumbnails[]`
- Duration: **not present** in the raw JSON at all
- Published date: **not present** in the raw JSON at all

### What NewPipe Extractor Does
The vendored NewPipe Extractor (`3party/NewPipeExtractor/`) confirms both the
limitation and the fix:

- `YoutubeShortsLockupInfoItemExtractor.getDuration()` → returns **`-1`** (no data)
- `YoutubeShortsLockupInfoItemExtractor.getTextualUploadDate()` → returns **`null`** (no data)
- Thumbnails: extracted from `thumbnail.sources[]` JSON path
- Piped's `CollectionUtils.java` maps `isShortFormContent() → isShort`, but returns
  `duration: -1` and `uploaded: -1` for shorts items. Piped's `uploadedDate` (text)
  is also null for these.

So even Piped/PipedBackend cannot provide duration or upload date for
`ShortsLockupView` items. This is a YouTube API limitation.

### Current Workaround (in worker)
- `mapPlaylistItem()` and `getChannel()`'s mapper check `v.content_id || v.entity_id`
- For `entity_id`-only items: thumbnails are constructed via regex extraction of the
  video ID from the entity_id (works correctly)
- Duration defaults to `{seconds:"0", text:""}` and uploaded to `0` (sorts first)

### Suggested Resolution (for future agents)
Thumbnails are already resolved. The duration/date limitation is inherent to the
YouTube API's `ShortsLockupView` renderer. No further work needed unless YouTube
changes their API response format.

If more precise data is needed for shorts, the video page itself (`getStreamInfo()`
or `player` endpoint) has the full data, but fetching per-item is too expensive for
a feed context.

### Related Files
- `worker/src/index.ts` — `mapPlaylistItem()` and `getChannel()` video mapper
- `3party/NewPipeExtractor/extractor/.../YoutubeShortsLockupInfoItemExtractor.java` — NewPipe's implementation showing same limitations
- `3party/NewPipeExtractor/extractor/.../YoutubeStreamInfoItemLockupExtractor.java` — NewPipe's LockupView extractor (has full duration/date)
