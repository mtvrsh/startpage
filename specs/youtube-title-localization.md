# YouTube title localization in feed listings

## Problem

A channel's video feed shows a mix of original-language and English titles even though every
video belongs to the same channel. In the SciFun channel
(`UCWTA5Yd0rAkQt5-9etIFoBA`) used by the screenshot demo config, the worker's
`/channels/:id` response contains e.g.:

| Video id      | Listing title (`lang=en`)            | Original title (`lang=pl` / watch page / oEmbed) |
| ------------- | ------------------------------------ | ------------------------------------------------ |
| `A5nRCzPuovk` | TOWARDS THE SUN - Serious Analysis   | W STRONĘ SŁOŃCA - Poważna Analiza                |
| `QzfXag4r7Vo` | Titan - Deep Analysis (Part 1)       | Titan - Głęboka Analiza (cz.1)                   |
| `pez2bxVnPYs` | Autumn under the microscope          | Jesień pod mikroskopem                           |
| `tUeIpeesU8Q` | Titan - Głęboka Analiza (cz.3) Finał | (unchanged — no English localization data)       |

17 of 29 videos were translated; 12 kept their Polish originals. Piped's channel listing
behaves the same way (see below). This surfaced while generating the README screenshot,
which fetches live data through the worker.

## Root cause

YouTube returns a _localized_ title in browse listings only for videos that have localization
data for the requested language. Where no localized title exists, it falls back to the
uploader's original title. There is no rule we can rely on; short slogans, proper nouns and
some older uploads commonly have no translation.

`youtubei.js` defaults the session language to `en` (`Innertube.create({ lang: 'en' })` by
default). The worker calls `Innertube.create({ retrieve_player: false })` in
`startpage-api/src/router.ts`, so it is effectively `lang=en`. Note that the option is
`lang`, **not** `hl`: `Innertube.create({ hl: 'pl' })` is ignored and still yields `en`.
`setTimeout`-free per-request overrides can be done by mutating
`yt.session.context.client.hl`, or by creating a client with `lang`.

The listing payload contains no flag saying "this title was translated". The raw
`LockupView` object has a single title string (`metadata.title.content` / `.text` /
`.runs[].text`) and no `originalTitle`, `translatedFrom`, or alternate-language field. A
JSON dump of a translated lockup does not even contain the original string. Therefore the
worker cannot detect and undo translation per video without another lookup.

### Verified behavior

- `lang=en`: mixed titles (17 translated, 12 original) and English metadata (`5mo ago`,
  `1.4M`).
- `lang=pl`: all 29 titles original, but metadata localized (`5 mies. temu`, `1,4 mln`).
- `lang=de`: all originals, metadata German — there is no German localization data for
  these titles.
- Empty/unknown `hl` values make `/browse` return HTTP 400.
- `Accept-Language` headers have no effect; client type does not matter (WEB, MWEB, TV,
  ANDROID all translate).
- Watch page (`yt.getBasicInfo(id).basic_info.title`) and
  `https://www.youtube.com/oembed?url=…&format=json` both return the **original** title,
  independent of language.
- The channel RSS feed (`channel.metadata.rss_url`) also returns original titles, for the
  newest ~15 videos only.

## Why a global language switch is unsafe

The worker derives `uploaded` from YouTube's relative-time text:
`extractPublished()` matches `/ago|year|month|week|day|hour|minute|second/i` and
`parseRelativeMs()` only understands English units (`y`, `mo`, `h`, `m`, `s`, …). A
localized response (`5 mies. temu`, `vor 1 Jahr`) produces `uploaded: 0` and wrong
ordering/dates in the frontend. So setting `lang=pl` globally is not a drop-in fix, and
hardcoding a language would be wrong for other channels anyway.

## Piped comparison

Piped does not solve this for listings:

- `Piped-Backend/src/main/java/me/kavin/piped/Main.java:49` hardcodes
  `NewPipe.init(..., new Localization("en", "US"), ContentCountry.DEFAULT)`.
- NewPipeExtractor sends `hl=en` on browse requests
  (`YoutubeParsingHelper.java:1054`, `:1541`).
- `YoutubeStreamInfoItemExtractor.getName()` reads `title.text`, and
  `YoutubeStreamInfoItemLockupExtractor.getName()` reads
  `metadata.lockupMetadataViewModel.title.content` — both verbatim, no original-title
  field.
- The single-video extractor is different: `YoutubeStreamExtractor.getName()` first tries
  `playerResponse.videoDetails.title` with the comment "Try to get the video's original
  title, which is untranslated", and only then falls back to the watch-page renderer.
  That is why Piped's `/streams/:id` can show originals while its channel listing cannot.

There is no Piped trick to copy for listings; getting originals for every listed video
requires one extra lookup per video there too.

## Candidate fixes (not implemented)

1. **Per-video original-title lookup** — oEmbed (lightweight) or watch page
   (`getBasicInfo`) per video, parallelized and cached with an isolate-level TTL. Fully
   generic and complete; highest upstream request count.
2. **Second listing request + merge** — keep `lang=en` for dates/durations, fetch a second
   browse in a locale without translations and merge by video id, replacing only
   `title.text`. Two requests per listing; needs a way to pick a language without
   hardcoding one, and a failure fallback to the current titles.
3. **Channel RSS merge** — one extra request, original titles, no language code. Covers
   only the newest ~15 videos and has no playlist equivalent.
4. **Per-request `lang` parameter** — feasible (`Innertube.create({ lang })` cached per
   language), but it only chooses which localization YouTube applies. It cannot guarantee
   originals and localizes metadata, so it is not a fix by itself.
5. **Leave as-is** — accept YouTube's per-video localization.

Any extra upstream request must respect the worker's rate budget: a page load already
fires one request per channel plus one per feed, with no client-side pacing. Listing
responses are cached in the browser for 10 minutes (`LISTING_CACHE_SECONDS`), so an
isolate-level TTL cache for original titles is the natural place to contain the extra
requests.
