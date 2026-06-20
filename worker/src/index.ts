import { Innertube } from 'youtubei.js/cf-worker';

let ytjs: Promise<Innertube> | null = null;

function getYt(): Promise<Innertube> {
  if (!ytjs) {
    ytjs = Innertube.create({
      retrieve_player: false,
    });
  }
  return ytjs;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

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

function parseRelativeMs(text: string): number {
  if (!text) return 0;
  const m = text.match(/^(\d+)\s*(d|w|mo|m|y|h|s)/);
  if (!m) return 0;
  const n = parseInt(m[1]);
  const mult: Record<string, number> = { d: 864e5, w: 6048e5, mo: 2592e6, m: 60000, y: 31536e6, h: 36e5, s: 1000 };
  return Date.now() - n * (mult[m[2]] || 0);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function handleSuggestions(searchParams: URLSearchParams): Promise<Response> {
  const q = searchParams.get('q');
  if (!q) return json({ error: 'query parameter is required' }, 400);

  const yt = await getYt();
  const suggestions = await yt.getSearchSuggestions(q);
  return json(suggestions);
}

async function rawChannel(channelId: string): Promise<Response> {
  const yt = await getYt();
  const channel = await yt.getChannel(channelId);
  return json(channel.page);
}

async function rawPlaylist(playlistId: string): Promise<Response> {
  const yt = await getYt();
  const playlist = await yt.getPlaylist(playlistId);
  return json(playlist.page);
}

async function searchChannels(searchParams: URLSearchParams): Promise<Response> {
  const q = searchParams.get('q');
  if (!q) return json({ error: 'query parameter is required' }, 400);

  const yt = await getYt();
  const results = await yt.search(q, { type: 'channel' });
  return json(results.channels);
}

async function getChannel(channelId: string): Promise<Response> {
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

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }
    if (request.method !== 'GET') {
      return json({ error: 'method not allowed' }, 405);
    }

    const url = new URL(request.url);
    const { pathname, searchParams } = url;

    try {
      if (pathname === '/search/channels') return searchChannels(searchParams);
      if (pathname === '/suggestions') return handleSuggestions(searchParams);

      const rawChannelMatch = pathname.match(/^\/raw\/channels\/(.+)$/);
      if (rawChannelMatch) return rawChannel(rawChannelMatch[1]);

      const rawPlaylistMatch = pathname.match(/^\/raw\/playlists\/(.+)$/);
      if (rawPlaylistMatch) return rawPlaylist(rawPlaylistMatch[1]);

      const channelMatch = pathname.match(/^\/channels\/(.+)$/);
      if (channelMatch) return getChannel(channelMatch[1]);

      const playlistMatch = pathname.match(/^\/playlists\/(.+)$/);
      if (playlistMatch) return getPlaylist(playlistMatch[1]);

      return json({ error: 'not found' }, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      console.error(JSON.stringify({ message: 'request failed', error: message, path: pathname }));
      return json({ error: message }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
