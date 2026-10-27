import { Innertube } from 'youtubei.js/cf-worker';
import { feedProxy, ProxyError } from './feed-proxy';
import { corsHeaders, isAllowedOrigin, isRateLimited } from './access';
import type { WorkerEnv } from './access';

let ytjs: Promise<Innertube> | null = null;

// Path parameters come straight from the URL and are passed to InnerTube;
// cap them so junk / oversized input cannot be relayed to YouTube on every
// request. Channel ids are either browse-style alphanumeric plus `-`/`_`
// (UCxxxxx) or a handle (`@foo`, letters/digits/`.`/`-`/`_` per YouTube's
// handle grammar — YouTube.js resolves handles via its NavigateAction
// fallback); playlist ids are alphanumeric plus `-`/`_`. All are well under
// 64 characters.
const ID_PATTERN = /^(@[\w.-]{1,63}|[\w-]{1,64})$/;
const MAX_QUERY_LENGTH = 100;

function isInvalidId(id: string): boolean {
  return !ID_PATTERN.test(id);
}

function getYt(): Promise<Innertube> {
  ytjs ||= Innertube.create({
    retrieve_player: false,
  }).catch(err => {
    // Drop the failed singleton so the next request retries a fresh create()
    // instead of replaying the same rejection forever.
    ytjs = null;
    throw err;
  });
  return ytjs;
}

function json(
  data: unknown,
  status = 200,
  cors: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function extractDuration(lockup: any): { seconds: string; text: string; is_live: boolean } | null {
  const overlays = lockup.content_image?.overlays || [];
  for (const overlay of overlays) {
    if (overlay.type === 'ThumbnailBottomOverlayView' && overlay.badges) {
      for (const badge of overlay.badges) {
        const t: string = badge.text || '';
        if (/\d+:\d+/.test(t)) {
          const parts = t.split(':').map(Number);
          let seconds: number;
          if (parts.length === 3) {
            seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
          } else if (parts.length === 2) {
            seconds = parts[0] * 60 + parts[1];
          } else {
            seconds = parts[0];
          }
          return { seconds: String(seconds), text: t, is_live: false };
        }
        if (/live|streaming/i.test(t)) {
          return { seconds: '0', text: t, is_live: true };
        }
      }
    }
  }
  return null;
}

function extractPublished(v: any): { text: string } {
  const rows = v.metadata?.metadata?.metadata_rows || [];
  for (const row of rows) {
    for (const part of row.metadata_parts || []) {
      const t = part.text?.toString() || '';
      if (/ago|year|month|week|day|hour|minute|second/i.test(t))
        return { text: t };
    }
  }
  return { text: '' };
}

// Publish dates arrive as free text, not just YouTube's compact "1 day ago":
// premieres and streams are prefixed ("Streamed 2 years ago", "Premiered 5
// hours ago") and long-form units are spelled out. Match the first
// <number><unit> pair anywhere in the string and accept both full and
// abbreviated unit names. The map is keyed by exact unit, so `mo` stays months
// while `m` stays minutes.
const UNIT_MS: Record<string, number> = {
  y: 31536e6, year: 31536e6, yr: 31536e6, // 365 days
  mo: 2592e6, month: 2592e6, mth: 2592e6, // 30 days
  w: 6048e5, week: 6048e5, wk: 6048e5, // 7 days
  d: 864e5, day: 864e5,
  h: 36e5, hour: 36e5, hr: 36e5,
  m: 60000, minute: 60000, min: 60000,
  s: 1000, second: 1000, sec: 1000,
};

export function parseRelativeMs(text: string): number {
  if (!text) return 0;
  for (const m of text.matchAll(/(\d+)\s*([a-z]+)/gi)) {
    // Skip numbers that are part of a decimal/grouped figure ("1.5M views").
    if (m.index > 0 && /[\d.,]/.test(text[m.index - 1])) continue;
    const raw = m[2].toLowerCase();
    // A lone `s` is seconds; for real words drop a trailing plural `s`
    // ("hours" → "hour", "mins" → "min").
    const unit = raw === 's' ? raw : raw.replace(/s$/, '');
    const ms = UNIT_MS[unit];
    // Skip unmatched pairs (e.g. "12K views 2 days ago") and keep looking.
    if (ms) return Date.now() - parseInt(m[1], 10) * ms;
  }
  return 0;
}

async function handleSuggestions(searchParams: URLSearchParams): Promise<Response> {
  const q = searchParams.get('q');
  if (!q) return json({ error: 'query parameter is required' }, 400);
  if (q.length > MAX_QUERY_LENGTH) return json({ error: 'query is too long' }, 400);

  const yt = await getYt();
  const suggestions = await yt.getSearchSuggestions(q);
  return json(suggestions);
}

async function rawChannel(channelId: string): Promise<Response> {
  if (isInvalidId(channelId)) return json({ error: 'invalid channel id' }, 400);
  const yt = await getYt();
  const channel = await yt.getChannel(channelId);
  return json(channel.page);
}

async function rawPlaylist(playlistId: string): Promise<Response> {
  if (isInvalidId(playlistId)) return json({ error: 'invalid playlist id' }, 400);
  const yt = await getYt();
  const playlist = await yt.getPlaylist(playlistId);
  return json(playlist.page);
}

async function searchChannels(searchParams: URLSearchParams): Promise<Response> {
  const q = searchParams.get('q');
  if (!q) return json({ error: 'query parameter is required' }, 400);
  if (q.length > MAX_QUERY_LENGTH) return json({ error: 'query is too long' }, 400);

  const yt = await getYt();
  const results = await yt.search(q, { type: 'channel' });
  return json(results.channels);
}

async function getChannel(channelId: string): Promise<Response> {
  if (isInvalidId(channelId)) return json({ error: 'invalid channel id' }, 400);
  const yt = await getYt();
  const channel = await yt.getChannel(channelId);

  if (!channel.has_videos) {
    return json([]);
  }

  const videosTab = await channel.getVideos();
  let videos: any[] = videosTab.videos || [];

  if (videos.length === 0) {
    const extracted: any[] = [];
    for (const [, items] of videosTab.memo) {
      for (const item of items) {
        const i = item as any;
        let target: any = null;
        if (i.type === 'LockupView' && i.content_type) {
          target = i;
        } else if (i.type === 'RichItem' && i.content) {
          const c = i.content as any;
          if (c.content_type) target = c;
          else if (c.type === 'Video' || c.type === 'GridVideo' || c.type === 'ReelItem') target = c;
        }
        if (target) extracted.push(target);
      }
    }
    videos = extracted;
  }

  const chMeta: any = channel.metadata || {};
  const chHeader: any = channel.header || {};
  const chName = chMeta.title || chHeader.author?.name || '';
  const chThumbs = chHeader.author?.thumbnails || chMeta.avatar || [];

  const result = videos.map((v: any) => {
    if (v.content_id || v.entity_id) {
      const rawId = v.content_id || v.entity_id || '';
      const id = v.content_id ? rawId : (rawId.match(/([a-zA-Z0-9_-]{11})$/) || [])[0] || rawId;
      let thumbnails = v.content_image?.image || v.thumbnail || [];
      if (!thumbnails.length && v.entity_id) {
        const vidMatch = v.entity_id.match(/([a-zA-Z0-9_-]{11})$/);
        if (vidMatch) {
          thumbnails = [{ url: `https://i.ytimg.com/vi/${vidMatch[1]}/hqdefault.jpg`, width: 336, height: 188 }];
        }
      }
      const best = thumbnails[0] || null;
      const durText = v.content_id ? extractDuration(v) : null;
      const published = v.content_id ? extractPublished(v) : { text: '' };
      return {
        video_id: id,
        title: { text: v.metadata?.title?.toString() || v.overlay_metadata?.primary_text?.toString() || '' },
        thumbnails,
        author: { name: chName, thumbnails: chThumbs },
        published,
        uploaded: v.content_id ? parseRelativeMs(published.text) : 0,
        duration: durText || { seconds: '0', text: '' },
        is_live: durText?.is_live || false,
        is_upcoming: false,
        is_premiere: false,
        best_thumbnail: best ? { url: best.url, width: best.width, height: best.height } : null,
      };
    }
  }).filter(Boolean);

  return json(result);
}

function mapPlaylistItem(v: any) {
  if (v.content_id || v.entity_id) {
    const rawId = v.content_id || v.entity_id || '';
    const id = v.content_id ? rawId : (rawId.match(/([a-zA-Z0-9_-]{11})$/) || [])[0] || rawId;
    const published = v.content_id ? extractPublished(v) : { text: '' };
    let thumbnails = v.content_image?.image || v.thumbnail || v.thumbnails || [];
    if (!thumbnails.length && v.entity_id) {
      const vidMatch = v.entity_id.match(/([a-zA-Z0-9_-]{11})$/);
      if (vidMatch) {
        thumbnails = [{ url: `https://i.ytimg.com/vi/${vidMatch[1]}/hqdefault.jpg`, width: 336, height: 188 }];
      }
    }
    return {
      id,
      title: { text: v.metadata?.title?.toString() || v.overlay_metadata?.primary_text?.toString() || v.title?.toString() || '' },
      thumbnails,
      author: v.author,
      published,
      uploaded: v.content_id ? parseRelativeMs(published.text) : 0,
      duration: (v.content_id ? extractDuration(v) : null) || { seconds: '0', text: '' },
      is_live: false,
      is_upcoming: false,
    };
  }
}

async function getPlaylist(playlistId: string): Promise<Response> {
  if (isInvalidId(playlistId)) return json({ error: 'invalid playlist id' }, 400);
  const yt = await getYt();
  const playlist = await yt.getPlaylist(playlistId);

  let items: any[] = (playlist.videos || []);

  if (items.length === 0) {
    const extracted: any[] = [];
    for (const [, memos] of playlist.memo) {
      for (const item of memos) {
        const i = item as any;
        if (i.type === 'LockupView' && i.content_id) extracted.push(i);
      }
    }
    items = extracted;
  }

  items = items.map(mapPlaylistItem).filter(Boolean);

  return json({
    name: playlist.info?.title,
    author: playlist.info?.author,
    items,
  });
}

async function dispatch(
  pathname: string,
  searchParams: URLSearchParams,
  cors: Record<string, string>,
): Promise<Response> {
  if (pathname === '/feed') return await feedProxy(searchParams, cors);
  if (pathname === '/search/channels') return await searchChannels(searchParams);
  if (pathname === '/suggestions') return await handleSuggestions(searchParams);

  const rawChannelMatch = pathname.match(/^\/raw\/channels\/(.+)$/);
  if (rawChannelMatch) return await rawChannel(rawChannelMatch[1]);

  const rawPlaylistMatch = pathname.match(/^\/raw\/playlists\/(.+)$/);
  if (rawPlaylistMatch) return await rawPlaylist(rawPlaylistMatch[1]);

  const channelMatch = pathname.match(/^\/channels\/(.+)$/);
  if (channelMatch) return await getChannel(channelMatch[1]);

  const playlistMatch = pathname.match(/^\/playlists\/(.+)$/);
  if (playlistMatch) return await getPlaylist(playlistMatch[1]);

  return json({ error: 'not found' }, 404, cors);
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
  if (resp.headers.has('Access-Control-Allow-Origin')) return resp;
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: [...resp.headers, ...Object.entries(cors)],
  });
}

export async function handleRequest(request: Request, env: WorkerEnv): Promise<Response> {
  // Origin gate first: reject anything not coming from an allowlisted browser
  // origin (with no CORS headers, so the fetch stays opaque there).
  if (!isAllowedOrigin(request, env)) {
    return json({ error: 'origin not allowed' }, 403);
  }

  const cors = corsHeaders(request, env);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'GET') {
    return json({ error: 'method not allowed' }, 405, cors);
  }

  if (await isRateLimited(request, env)) {
    return json({ error: 'rate limit exceeded' }, 429, cors);
  }

  const url = new URL(request.url);
  const { pathname, searchParams } = url;

  try {
    return withCors(await dispatch(pathname, searchParams, cors), cors);
  } catch (err) {
    if (err instanceof ProxyError)
      return json({ error: err.message }, err.status, cors);

    // Detail goes to the logs only; the client gets a generic message so
    // internal errors never leak library internals.
    console.error(JSON.stringify({ message: 'request failed', error: describeError(err), path: pathname }));
    return json({ error: 'internal error' }, 500, cors);
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}
