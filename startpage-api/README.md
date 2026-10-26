# startpage-api

Cloudflare Worker backend for the [startpage](../README.md) frontend. Serves channel
search/suggestions, channel/playlist listings (via YouTube.js), and an Atom/RSS
feed proxy at `/feed?url=...`.

## Self-hosting (wrangler / workerd)

You can run this worker yourself instead of using the deployed instance. Point the
frontend's `backendUrl` setting (Settings → Piped → Backend URL) and `feedProxyUrl`
setting (Settings → Reader feed → Feed reader proxy URL) at your instance.

### Egress safety (read this if you self-host)

The `/feed` endpoint fetches a caller-supplied URL — from *anyone* who can reach
your instance, since the frontend is served from a static site — and returns up
to 2 MB of the response body. That makes it an SSRF vector: without controls,
an attacker can use it to probe (and read responses from) services on the host
itself, VPS cloud metadata, or LAN devices.

Egress behavior differs by run mode:

| Run mode | Private/loopback egress |
|---|---|
| Deployed to Cloudflare | Blocked by the platform's egress filter. |
| Bare `workerd` (default config) | Blocked: `fetch()` routes through the implicit `internet` service, which is public-only. |
| `wrangler dev` (local/Miniflare) | **Allowed** — loopback fetches work, and DNS names that resolve to private addresses (e.g. `192-168-0-1.nip.io`, or a crafted `hosts` entry) resolve and connect. |

Note the DNS case: hostname-based checks in the worker code cannot catch a
public-looking name whose DNS resolves to a private IP — the danger only
materializes at the connect step. Egress policy at the runtime is what closes it.

**workerd config** — make the public-only policy explicit rather than relying on
the implicit default:

```jsonc
{
  "services": [
    { "name": "internet", "network": { "allow": ["public"] } },
    { "name": "main", "worker": { "compatibilityDate": "2026-06-20", "modules": [ /* ... */ ] } }
  ],
  "sockets": [{ "name": "http", "address": "*:8787", "http": [], "service": "main" }]
}
```

workerd resolves the hostname first and refuses to connect when the resolved
address is not public, which also blocks rebinding names. Do not widen `allow`
(this worker needs no `tcp` sockets or private-host access).

**OS-level belt-and-suspenders** (recommended): firewall egress from the worker
process so nothing on the box can reach RFC1918, loopback, link-local
(`169.254.0.0/16` — includes cloud metadata endpoints), or IPv6 ULA/link-local
ranges. Run the worker in a network namespace or a container without host
networking if possible. Do this especially for `wrangler dev`-based setups,
where the runtime itself does not filter.

Also be aware the worker replies with permissive CORS (`Access-Control-Allow-Origin:
*`) because the static frontend calls it cross-origin; any site can use a
publicly reachable instance as an XML-fetching proxy (subject to the same egress
limits).

### Development

```sh
npx wrangler dev          # local development
npx wrangler deploy       # deploy to Cloudflare
npx wrangler types        # generate TypeScript types after binding changes
```

Run `wrangler types` after changing bindings in `wrangler.jsonc`. Tests covering
the feed proxy live in the main repo's `tests/` (`deno task test` at the root).
