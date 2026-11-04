/**
 * First-page playlist continuation token.
 *
 * Shorts-only uploads playlists (`UU…`) render their initial page as
 * `ShortsLockupView` items, which carry no duration and no publish date. The
 * playlist continuation returns the same videos as `LockupView` items, which
 * do carry both. YouTube.js's `getPlaylist()` sends a plain `browseId: VL…`
 * request with no params, and reports `has_continuation === false` for such
 * playlists, so there is no token to reuse: one has to be built.
 *
 * The token is the protobuf NewPipeExtractor sends for every playlist first
 * page (`playlist_continuation_schema.proto`):
 *
 *   PlaylistContinuation { parameters = 80226972 }
 *   ContinuationParams {
 *     browseId = 2              // "VL" + playlist id
 *     continuationProperties = 3 // NewPipe's "CADCBgIIAA%3D%3D"
 *     playlistId = 35
 *   }
 *
 * Field 35 is what makes YouTube answer with `lockupViewModel` (and therefore
 * with durations/dates); without it the response stays `shortsLockupViewModel`.
 * Fields 2/3 alone are not enough. NewPipe URL-encodes its padded base64;
 * YouTube accepts unpadded base64url in the JSON body too, which is what this
 * encoder emits.
 */
const PLAYLIST_CONTINUATION_FIELD = 80226972

// Verbatim from NewPipeExtractor's
// YoutubePlaylistExtractor.PLAYLIST_CONTINUATION_PROPERTIES_BASE64. It is
// kept URL-encoded for parity; YouTube treats it as an opaque string.
export const PLAYLIST_CONTINUATION_PROPERTIES = 'CADCBgIIAA%3D%3D'

// Base-128 varint. Arithmetic rather than bitwise ops keeps the encoder
// independent of 32-bit signed conversions; the field key here happens to fit,
// but the arithmetic form stays correct if a larger field number is added.
function varint(value: number): number[] {
  const bytes: number[] = []
  while (value > 0x7f) {
    bytes.push((value % 0x80) + 0x80)
    value = Math.floor(value / 0x80)
  }
  bytes.push(value)
  return bytes
}

// Length-delimited (wire type 2) string field.
function stringField(fieldNumber: number, value: string): number[] {
  const encoded = new TextEncoder().encode(value)
  return [...varint(fieldNumber * 8 + 2), ...varint(encoded.length), ...encoded]
}

function base64Url(bytes: number[]): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function playlistContinuationToken(playlistId: string): string {
  const id = playlistId.startsWith('VL') ? playlistId.slice(2) : playlistId
  const params = [
    ...stringField(2, `VL${id}`),
    ...stringField(3, PLAYLIST_CONTINUATION_PROPERTIES),
    ...stringField(35, id),
  ]
  return base64Url([
    ...varint(PLAYLIST_CONTINUATION_FIELD * 8 + 2),
    ...varint(params.length),
    ...params,
  ])
}
