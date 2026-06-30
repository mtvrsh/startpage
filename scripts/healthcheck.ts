#!/usr/bin/env -S deno run --allow-net --allow-read --allow-import

import { parseArgs } from "jsr:@std/cli/parse-args";

const TIMEOUT = 5_000;
const PLAYLIST_ID = "UUWTA5Yd0rAkQt5-9etIFoBA";

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    if (!resp.ok) return "";
    return await resp.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function checkPiped() {
  const text = await Deno.readTextFile(
    new URL("./instances.json", import.meta.url),
  );
  const raw: { piped: { instances: string[] } } = JSON.parse(text);

  for (const uri of raw.piped.instances) {

    const [healthcheck, version, playlist] = await Promise.all([
      fetchText(`${uri}/healthcheck`),
      fetchText(`${uri}/version`),
      fetchJson<{ name?: string; relatedStreams?: { url?: string }[] }>(
        `${uri}/playlists/${PLAYLIST_ID}`,
      ),
    ]);

    if (!playlist?.name || !playlist.relatedStreams?.length) continue;

    console.log(
      `${uri}\t${healthcheck.trim()}\t${version.trim()}\t${playlist.relatedStreams.length}`,
    );
  }
}

async function checkInvidious() {
  const raw = await fetchJson<
    [string, { type: string; uri: string } | null][]
  >("https://api.invidious.io/instances.json");
  if (!raw) return;

  for (const [hostname, info] of raw) {
    if (!info || info.type !== "https") continue;
    const uri = info.uri;

    const [version, playlist] = await Promise.all([
      fetchJson<{ software?: { version?: string } }>(`${uri}/api/v1/stats`)
        .then((s) => s?.software?.version ?? ""),
      fetchJson<{ title?: string; videos?: { videoId: string }[] }>(
        `${uri}/api/v1/playlists/${PLAYLIST_ID}`,
      ),
    ]);

    if (!playlist?.title || !playlist.videos?.length) continue;

    console.log(`${uri}\t${version}\t${playlist.videos.length}`);
  }
}

const flags = parseArgs(Deno.args, { boolean: ["piped", "invidious"] });

if (flags.piped) await checkPiped();
if (flags.invidious) await checkInvidious();
if (Deno.args.length === 0) {
  await checkPiped();
  await checkInvidious();
}
