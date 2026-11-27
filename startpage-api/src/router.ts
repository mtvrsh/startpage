import { Innertube } from 'youtubei.js/cf-worker'
import { feedProxy, ProxyError } from './feed-proxy'
import { playlistContinuationToken } from './playlist-continuation'
import { corsHeaders, isAllowedOrigin, isRateLimited } from './access'
import type { WorkerEnv } from './access'

let ytjs: Promise<Innertube> | null = null

// Path parameters come straight from the URL and are passed to InnerTube;
// cap them so junk / oversized input cannot be relayed to YouTube on every
// request. Channel ids are either browse-style alphanumeric plus `-`/`_`
// (UCxxxxx) or a handle (`@foo`, letters/digits/`.`/`-`/`_` per YouTube's
// handle grammar); handles are resolved with resolveURL() below because
// getChannel() browses `browseId: '@handle'`, which YouTube rejects with a 400
// (so YouTube.js's NavigateAction fallback never gets a response to follow).
// Playlist ids are alphanumeric plus `-`/`_`. All are well under 64 characters.
const ID_PATTERN = /^(@[\w.-]{1,63}|[\w-]{1,64})$/
const MAX_QUERY_LENGTH = 100

// Browser cache lifetime for channel/playlist listings. It matches the
// frontend's default `cacheLifetimeInMinutes` (10 min): a reload inside that
// window is served from the browser cache, while `Channels.refetch({reload:
// true})` (the sync button) and any refetch past the window send
// `cache: 'reload'`, which bypasses it. `private` because freshness is tracked
// per browser (`status.fetchedAt`), not shared between users.
const LISTING_CACHE_SECONDS = 600

function isInvalidId(id: string): boolean {
  return !ID_PATTERN.test(id)
}

function getYt(): Promise<Innertube> {
  ytjs ||= Innertube.create({
    retrieve_player: false,
  }).catch((err) => {
    // Drop the failed singleton so the next request retries a fresh create()
    // instead of replaying the same rejection forever.
    ytjs = null
    throw err
  })
  return ytjs
}

function json(
  data: unknown,
  status = 200,
  cors: Record<string, string> = {},
  cacheSeconds = 0,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      // Only the fixed-lifetime listing responses opt in; errors, search and
      // the raw debug routes must never be stored by the browser.
      'Cache-Control': cacheSeconds > 0 ? `private, max-age=${cacheSeconds}` : 'no-store',
    },
  })
}

/** Reads both raw `Text`-like objects (`{text}` / `toString()`) and plain strings. */
function asText(value: any): string {
  if (typeof value === 'string') return value
  if (!value) return ''
  if (typeof value.text === 'string') return value.text
  if (typeof value.toString === 'function') {
    const text = value.toString()
    if (typeof text === 'string' && text !== '[object Object]') return text
  }
  return ''
}

/** "1:37", "0:13", "1:02:03" and comma-grouped badges like "1,234:56". */
function durationSeconds(text: string): number {
  const cleaned = text.replace(/,/g, '')
  if (!/^\d+(?::\d{1,2}){1,2}$/.test(cleaned)) return 0
  const parts = cleaned.split(':').map(Number)
  if (parts.some((part) => !Number.isFinite(part))) return 0
  return parts.reduce((seconds, part) => seconds * 60 + part, 0)
}

/**
 * youtubei.js parses most listings into class instances (PlaylistVideo, Video,
 * GridVideo, …) whose duration is already a `{text, seconds}` object. Raw
 * view-model payloads (memo/continuation) carry it in a thumbnail badge, so
 * both shapes are read here. The lockup getter also accepts
 * `ThumbnailOverlayBadgeView` and `CollectionThumbnailView.primary_thumbnail`.
 */
function extractDuration(v: any): { seconds: string; text: string; is_live: boolean } | null {
  if (v.duration) {
    const text = asText(v.duration.text)
    const parsed = Number(v.duration.seconds)
    const seconds = Number.isFinite(parsed) && parsed > 0 ? parsed : durationSeconds(text)
    if (seconds > 0) return { seconds: String(seconds), text, is_live: !!v.is_live }
  }

  const image = v.content_image?.primary_thumbnail || v.content_image
  for (const overlay of image?.overlays || []) {
    if (
      overlay.type !== 'ThumbnailBottomOverlayView' &&
      overlay.type !== 'ThumbnailOverlayBadgeView'
    )
      continue
    for (const badge of overlay.badges || []) {
      const text = asText(badge.text)
      const seconds = durationSeconds(text)
      if (seconds > 0) return { seconds: String(seconds), text, is_live: false }
      if (/live|streaming/i.test(text)) return { seconds: '0', text, is_live: true }
    }
  }
  return null
}

function upcomingIso(v: any): string | undefined {
  if (!v.upcoming) return undefined
  const date = v.upcoming instanceof Date ? v.upcoming : new Date(v.upcoming)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function extractPublished(v: any): { text: string } {
  // Parsed renderer classes expose `published` as a Text object; raw lockups
  // keep it in the content metadata rows.
  const published = asText(v.published)
  if (published) return { text: published }

  const rows = v.metadata?.metadata?.metadata_rows || []
  for (const row of rows) {
    for (const part of row.metadata_parts || []) {
      const t = asText(part.text)
      if (/ago|year|month|week|day|hour|minute|second/i.test(t)) return { text: t }
    }
  }
  return { text: '' }
}

// Publish dates arrive as free text, not just YouTube's compact "1 day ago":
// premieres and streams are prefixed ("Streamed 2 years ago", "Premiered 5
// hours ago") and long-form units are spelled out. Match the first
// <number><unit> pair anywhere in the string and accept both full and
// abbreviated unit names. The map is keyed by exact unit, so `mo` stays months
// while `m` stays minutes.
const UNIT_MS: Record<string, number> = {
  y: 31536e6,
  year: 31536e6,
  yr: 31536e6, // 365 days
  mo: 2592e6,
  month: 2592e6,
  mth: 2592e6, // 30 days
  w: 6048e5,
  week: 6048e5,
  wk: 6048e5, // 7 days
  d: 864e5,
  day: 864e5,
  h: 36e5,
  hour: 36e5,
  hr: 36e5,
  m: 60000,
  minute: 60000,
  min: 60000,
  s: 1000,
  second: 1000,
  sec: 1000,
}

export function parseRelativeMs(text: string): number {
  if (!text) return 0
  for (const m of text.matchAll(/(\d+)\s*([a-z]+)/gi)) {
    // Skip numbers that are part of a decimal/grouped figure ("1.5M views").
    if (m.index > 0 && /[\d.,]/.test(text[m.index - 1])) continue
    const raw = m[2].toLowerCase()
    // A lone `s` is seconds; for real words drop a trailing plural `s`
    // ("hours" → "hour", "mins" → "min").
    const unit = raw === 's' ? raw : raw.replace(/s$/, '')
    const ms = UNIT_MS[unit]
    // Skip unmatched pairs (e.g. "12K views 2 days ago") and keep looking.
    if (ms) return Date.now() - parseInt(m[1], 10) * ms
  }
  return 0
}

// Lockup-shaped items (LockupView for regular videos, ShortsLockupView for
// shorts) do not carry the video id in `entity_id` — it is an opaque hash
// (e.g. `C1A2D28FC54EBFE2`, unrelated to the item being trimmed to its last 11
// characters). `content_id` is the id for LockupView items. ShortsLockupView
// has neither `content_id` nor real thumbnails (`thumbnail` is an empty
// array), so its id and thumbnails come from the tap endpoint
// (`reelWatchEndpoint` payload, with the `/shorts/<id>` URL as a secondary).
// Classic renderers parsed by youtubei.js (PlaylistVideo, Video, GridVideo,
// ReelItem, …) use `id` or `video_id` instead — they must not be dropped just
// because they are not lockups.
function resolveVideoId(v: any): string {
  if (v.content_id) return v.content_id
  if (typeof v.id === 'string' && v.id) return v.id
  if (typeof v.video_id === 'string' && v.video_id) return v.video_id
  const videoId = v.on_tap_endpoint?.payload?.videoId
  if (typeof videoId === 'string' && videoId) return videoId
  const url: string = v.on_tap_endpoint?.metadata?.url || ''
  // The URL form varies between captures (absolute in some, relative in the
  // live shorts one), so the match is not anchored — both /shorts/<id> forms
  // hit the same fallback.
  return url.match(/\/shorts\/([\w-]{11})/)?.[1] || ''
}

// Thumbnails appear in various view-model wrappers depending on the renderer
// batch. The first candidate for ShortsLockupView is an empty (truthy) array,
// so candidates are tested for actual entries rather than truthiness.
function resolveLockupThumbnails(v: any): any[] {
  for (const candidate of [
    v.content_image?.image,
    v.content_image?.primary_thumbnail?.image,
    v.thumbnail,
    v.thumbnails,
    v.thumbnail_view_model?.image,
    v.on_tap_endpoint?.payload?.thumbnail?.thumbnails,
  ]) {
    if (Array.isArray(candidate) && candidate.length) return candidate
  }
  return []
}

// Parses the subscriber label YouTube puts on search rows ("525K
// subscribers", "1.2M subscribers", "12,345 subscribers"). Only the palette's
// sort order consumes the number, so an unrecognized label degrades to 0 (a
// tie) rather than a display bug. The "subscribers" word is stripped and the
// remainder must be a pure number, so a count that arrives with a different
// unit — e.g. "1,234 videos" if YouTube.js un-inverts the field skeleton — is
// not mistaken for subscribers.
export function parseSubscriberCount(text: string): number {
  if (!text) return 0
  const label = text.replace(/\bsubscribers?\b/i, '').trim()
  // Compact suffix: "525K", "12.3K subscribers".
  const compact = label.match(/^([\d][\d.,]*)\s*([KMB])$/i)
  if (compact) {
    const value = parseFloat(compact[1].replace(/,/g, ''))
    const multiplier = { K: 1000, M: 1000000, B: 1000000000 }[compact[2].toUpperCase()] || 1
    return Math.round(value * multiplier)
  }
  // Plain counts, with or without grouping ("12", "1,234,567",
  // "12,345 subscribers").
  const plain = label.match(/^[\d.,]+$/)
  if (plain) {
    return Math.round(parseFloat(plain[0].replace(/,/g, '')))
  }
  return 0
}

async function handleSuggestions(searchParams: URLSearchParams): Promise<Response> {
  const q = searchParams.get('q')
  if (!q) return json({ error: 'query parameter is required' }, 400)
  if (q.length > MAX_QUERY_LENGTH) return json({ error: 'query is too long' }, 400)

  const yt = await getYt()
  const suggestions = await yt.getSearchSuggestions(q)
  return json(suggestions)
}

// Resolves a handle (`@foo`) to the canonical browseId via YouTube's
// navigation endpoint. `UC…` ids pass through untouched. A resolution failure
// falls back to the raw id so failure semantics stay identical to the
// pre-handle-fix path: an unresolvable handle still fails in getChannel()
// (YouTube rejects a handle browseId with 400) and surfaces as the same
// generic 500. It does not make broken resolves work — it only keeps the
// failing component unchanged instead of adding a resolveURL-specific mode.
async function resolveChannelId(yt: any, id: string): Promise<string> {
  if (!id.startsWith('@')) return id
  try {
    const endpoint = await yt.resolveURL(`https://www.youtube.com/${id}`)
    return endpoint?.payload?.browseId || id
  } catch {
    return id
  }
}

async function rawChannel(channelId: string): Promise<Response> {
  if (isInvalidId(channelId)) return json({ error: 'invalid channel id' }, 400)
  const yt = await getYt()
  const channel = await yt.getChannel(await resolveChannelId(yt, channelId))
  return json(channel.page)
}

async function rawPlaylist(playlistId: string): Promise<Response> {
  if (isInvalidId(playlistId)) return json({ error: 'invalid playlist id' }, 400)
  const yt = await getYt()
  const playlist = await yt.getPlaylist(playlistId)
  return json(playlist.page)
}

// `SearchFilter{type: CHANNEL}` — the params youtubei.js builds for
// `search(q, { type: 'channel' })`. Search reads the raw response below, so the
// constant has to be supplied explicitly.
const CHANNEL_SEARCH_PARAMS = 'EgIQAg%3D%3D'

type SearchChannel = {
  id: string
  author: { id: string; name: string; thumbnails: any[] }
  subscribers: number
}

/** Text fields in raw InnerTube JSON use `simpleText`, `content` or `runs`. */
function rawSearchText(value: any): string {
  if (typeof value === 'string') return value
  if (!value) return ''
  if (typeof value.simpleText === 'string') return value.simpleText
  if (typeof value.content === 'string') return value.content
  if (Array.isArray(value.runs)) return value.runs.map((run: any) => run.text || '').join('')
  return ''
}

// Channel-lockup avatars arrive in several raw view models depending on the
// response batch. The decorated-avatar form is the one youtubei.js 18.3.0
// rejects in `LockupView#content_image` (upstream PR #1329), so read it here
// instead of losing the avatar.
function rawLockupThumbnails(contentImage: any): any[] {
  for (const image of [
    contentImage?.thumbnailViewModel?.image,
    contentImage?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image,
    contentImage?.avatarViewModel?.image,
  ]) {
    const sources = image?.sources || image?.thumbnails
    if (Array.isArray(sources) && sources.length) return sources
  }
  return []
}

// YouTube alternates channel-search rows between classic `channelRenderer`
// items and `lockupViewModel` items with contentType
// LOCKUP_CONTENT_TYPE_CHANNEL. youtubei.js parses the latter into `LockupView`,
// whose `contentImage` typecheck rejects channel avatars; the item survives but
// has no thumbnails and is absent from `results.channels`. Reading the raw
// response keeps both variants (and their avatars). Other lockup types such as
// videos and shorts are deliberately skipped.
function channelFromSearchNode(node: any): SearchChannel | null {
  if (node.lockupViewModel) {
    const v = node.lockupViewModel
    if (v.contentType !== 'LOCKUP_CONTENT_TYPE_CHANNEL') return null
    const meta = v.metadata?.lockupMetadataViewModel
    const rows = meta?.metadata?.contentMetadataViewModel?.metadataRows
    const parts: string[] = Array.isArray(rows)
      ? rows.flatMap((row: any) =>
          Array.isArray(row.metadataParts)
            ? row.metadataParts.map((part: any) => rawSearchText(part.text))
            : [],
        )
      : []
    // Rows carry the handle first and the subscriber label second; only the
    // latter parses to a count.
    const subscribers = parts.map(parseSubscriberCount).find((n) => n > 0) ?? 0
    const id = v.contentId || ''
    return {
      id,
      author: {
        id,
        name: rawSearchText(meta?.title),
        thumbnails: rawLockupThumbnails(v.contentImage),
      },
      subscribers,
    }
  }
  if (node.channelRenderer) {
    const v = node.channelRenderer
    const id = v.channelId || v.navigationEndpoint?.browseEndpoint?.browseId || ''
    // YouTube puts the subscriber label in `videoCountText` and the handle in
    // `subscriberCountText` — the inversion youtubei.js exposes as
    // `video_count`/`subscriber_count`.
    return {
      id,
      author: {
        id,
        name: rawSearchText(v.title),
        thumbnails: v.thumbnail?.thumbnails || [],
      },
      subscribers: parseSubscriberCount(
        rawSearchText(v.videoCountText) || rawSearchText(v.subscriberCountText),
      ),
    }
  }
  return null
}

function collectSearchChannels(node: any, out: Map<string, SearchChannel>): void {
  if (!node || typeof node !== 'object') return
  const channel = channelFromSearchNode(node)
  if (channel && channel.id && !out.has(channel.id)) out.set(channel.id, channel)
  for (const value of Object.values(node)) collectSearchChannels(value, out)
}

async function searchChannels(searchParams: URLSearchParams): Promise<Response> {
  const q = searchParams.get('q')
  if (!q) return json({ error: 'query parameter is required' }, 400)
  if (q.length > MAX_QUERY_LENGTH) return json({ error: 'query is too long' }, 400)

  const yt = await getYt()
  const response: any = await yt.actions.execute('/search', {
    query: q,
    params: CHANNEL_SEARCH_PARAMS,
    parse: false,
  })
  if (!response.success) throw new Error(`search failed: ${response.status_code}`)

  const channels = new Map<string, SearchChannel>()
  collectSearchChannels(response.data, channels)
  return json([...channels.values()])
}

async function getChannel(channelId: string): Promise<Response> {
  if (isInvalidId(channelId)) return json({ error: 'invalid channel id' }, 400)
  const yt = await getYt()
  const channel = await yt.getChannel(await resolveChannelId(yt, channelId))

  if (!channel.has_videos) {
    return json([], 200, {}, LISTING_CACHE_SECONDS)
  }

  const videosTab = await channel.getVideos()
  let videos: any[] = videosTab.videos || []

  if (videos.length === 0) {
    const extracted: any[] = []
    for (const [, items] of videosTab.memo) {
      for (const item of items) {
        const i = item as any
        let target: any = null
        if (i.type === 'LockupView' && i.content_type) {
          target = i
        } else if (i.type === 'ShortsLockupView') {
          target = i
        } else if (i.type === 'RichItem' && i.content) {
          const c = i.content as any
          if (c.content_type) target = c
          else if (c.type === 'Video' || c.type === 'GridVideo' || c.type === 'ReelItem') target = c
        }
        if (target) extracted.push(target)
      }
    }
    videos = extracted
  }

  const chMeta: any = channel.metadata || {}
  const chHeader: any = channel.header || {}
  const chName = chMeta.title || chHeader.author?.name || ''
  const chThumbs = chHeader.author?.thumbnails || chMeta.avatar || []
  // `external_id` is the canonical UC id even for handle-resolved channels;
  // without it the frontend would emit `youtube.com/channel/@handle` instead
  // of `youtube.com/channel/UC…`, diverging from Piped's canonical output.
  const chId = chMeta.external_id || chHeader.author?.id || channelId

  // Same gap as uploads playlists: a channel whose videos tab contains
  // `ShortsLockupView` items has no duration/date for those entries. Reuse the
  // uploads-playlist continuation, which is derivable for `UC…` ids (`UU` +
  // the rest). Other ids have no uploads playlist to ask for.
  if (chId.startsWith('UC') && videos.some((v: any) => v.type === 'ShortsLockupView')) {
    const lockups = await fetchPlaylistLockups(yt, `UU${chId.slice(2)}`)
    if (lockups.length > 0) videos = lockups
  }

  const result = videos
    .map((v: any) => {
      const id = resolveVideoId(v)
      if (!id) return null
      const thumbnails = resolveLockupThumbnails(v)
      const best = thumbnails[0] || null
      const durText = extractDuration(v)
      const published = extractPublished(v)
      return {
        video_id: id,
        title: {
          text:
            v.metadata?.title?.toString() ||
            v.overlay_metadata?.primary_text?.toString() ||
            v.title?.toString() ||
            '',
        },
        thumbnails,
        author: { id: chId, name: chName, thumbnails: chThumbs },
        published,
        uploaded: parseRelativeMs(published.text),
        duration: durText || { seconds: '0', text: '' },
        is_live: durText?.is_live || !!v.is_live,
        is_upcoming: !!v.is_upcoming,
        upcoming: upcomingIso(v),
        is_premiere: false,
        best_thumbnail: best ? { url: best.url, width: best.width, height: best.height } : null,
      }
    })
    .filter(Boolean)

  return json(result, 200, {}, LISTING_CACHE_SECONDS)
}

function mapPlaylistItem(v: any) {
  const id = resolveVideoId(v)
  if (!id) return null
  const published = extractPublished(v)
  const durText = extractDuration(v)
  return {
    id,
    title: {
      text:
        v.metadata?.title?.toString() ||
        v.overlay_metadata?.primary_text?.toString() ||
        v.title?.toString() ||
        '',
    },
    thumbnails: resolveLockupThumbnails(v),
    author: v.author,
    published,
    uploaded: parseRelativeMs(published.text),
    duration: durText || { seconds: '0', text: '' },
    is_live: durText?.is_live || !!v.is_live,
    is_upcoming: !!v.is_upcoming,
    upcoming: upcomingIso(v),
  }
}

// Reads the lockup items out of a `/browse` continuation response. YouTube
// answers the first page with a reload command and later pages with an append
// action; both expose `contents`, so the action is read structurally. The
// trailing ContinuationItemView node has no `content_id` and is skipped.
async function fetchPlaylistLockups(yt: any, playlistId: string): Promise<any[]> {
  try {
    const response: any = await yt.actions.execute('/browse', {
      continuation: playlistContinuationToken(playlistId),
      parse: true,
    })
    const lockups: any[] = []
    for (const action of response.on_response_received_actions || []) {
      for (const item of action.contents || []) {
        if (item.type === 'LockupView' && item.content_id) lockups.push(item)
      }
    }
    if (lockups.length === 0) {
      // The request succeeded but the payload is not the shape this fallback
      // understands (or the playlist genuinely has no items). Log it so a
      // silent return to empty durations stays diagnosable.
      console.error(
        JSON.stringify({
          message: 'playlist continuation returned no lockups',
          playlist: playlistId,
        }),
      )
    }
    return lockups
  } catch (err) {
    // Degrade to the ShortsLockupView page: the listing loads with empty
    // duration/publish dates, exactly as it did before this fallback existed.
    console.error(
      JSON.stringify({
        message: 'playlist continuation failed',
        error: describeError(err),
        playlist: playlistId,
      }),
    )
    return []
  }
}

async function getPlaylist(playlistId: string): Promise<Response> {
  if (isInvalidId(playlistId)) return json({ error: 'invalid playlist id' }, 400)
  const yt = await getYt()
  const playlist = await yt.getPlaylist(playlistId)

  let items: any[] = playlist.videos || []

  if (items.length === 0) {
    const extracted: any[] = []
    for (const [, memos] of playlist.memo) {
      for (const item of memos) {
        const i = item as any
        if ((i.type === 'LockupView' && i.content_id) || i.type === 'ShortsLockupView') {
          extracted.push(i)
        }
      }
    }
    items = extracted
  }

  // Shorts-only uploads playlists render their first page as
  // ShortsLockupView items, which carry neither a duration nor a publish date.
  // The continuation NewPipe uses for every playlist first page returns the
  // same videos as LockupView items with both. Trigger it whenever the page
  // contains at least one shorts lockup, mixed pages included: those still
  // have gaps for every shorts entry. The continuation is the authoritative
  // first page, so its items replace the initial list (pages that already
  // render LockupViews only keep their single request).
  if (items.some((v) => v.type === 'ShortsLockupView')) {
    const lockups = await fetchPlaylistLockups(yt, playlistId)
    if (lockups.length > 0) items = lockups
  }

  items = items.map(mapPlaylistItem).filter(Boolean)

  return json(
    {
      name: playlist.info?.title,
      author: playlist.info?.author,
      items,
    },
    200,
    {},
    LISTING_CACHE_SECONDS,
  )
}

async function dispatch(
  pathname: string,
  searchParams: URLSearchParams,
  cors: Record<string, string>,
): Promise<Response> {
  if (pathname === '/feed') return await feedProxy(searchParams, cors)
  if (pathname === '/search/channels') return await searchChannels(searchParams)
  if (pathname === '/suggestions') return await handleSuggestions(searchParams)

  const rawChannelMatch = pathname.match(/^\/raw\/channels\/(.+)$/)
  if (rawChannelMatch) return await rawChannel(rawChannelMatch[1])

  const rawPlaylistMatch = pathname.match(/^\/raw\/playlists\/(.+)$/)
  if (rawPlaylistMatch) return await rawPlaylist(rawPlaylistMatch[1])

  const channelMatch = pathname.match(/^\/channels\/(.+)$/)
  if (channelMatch) return await getChannel(channelMatch[1])

  const playlistMatch = pathname.match(/^\/playlists\/(.+)$/)
  if (playlistMatch) return await getPlaylist(playlistMatch[1])

  return json({ error: 'not found' }, 404, cors)
}

/**
 * Attach the CORS headers to every dispatched response. Without this,
 * endpoints built with plain `json()` omit `Access-Control-Allow-Origin` and
 * the browser silently rejects even successful (non-safelisted) responses —
 * so it is applied centrally instead of trusting each route to remember.
 * Responses that already carry CORS (feed proxy) are returned untouched so
 * per-origin values are never duplicated or clobbered.
 */
function withCors(resp: Response, cors: Record<string, string>): Response {
  if (resp.headers.has('Access-Control-Allow-Origin')) return resp
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: [...resp.headers, ...Object.entries(cors)],
  })
}

export async function handleRequest(request: Request, env: WorkerEnv): Promise<Response> {
  // Origin gate first: reject anything not coming from an allowlisted browser
  // origin (with no CORS headers, so the fetch stays opaque there).
  if (!isAllowedOrigin(request, env)) {
    return json({ error: 'origin not allowed' }, 403)
  }

  const cors = corsHeaders(request, env)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }
  if (request.method !== 'GET') {
    return json({ error: 'method not allowed' }, 405, cors)
  }

  if (await isRateLimited(request, env)) {
    return json({ error: 'rate limit exceeded' }, 429, cors)
  }

  const url = new URL(request.url)
  const { pathname, searchParams } = url

  try {
    return withCors(await dispatch(pathname, searchParams, cors), cors)
  } catch (err) {
    if (err instanceof ProxyError) return json({ error: err.message }, err.status, cors)

    // Detail goes to the logs only; the client gets a generic message so
    // internal errors never leak library internals.
    console.error(
      JSON.stringify({ message: 'request failed', error: describeError(err), path: pathname }),
    )
    return json({ error: 'internal error' }, 500, cors)
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`
  return String(err)
}
