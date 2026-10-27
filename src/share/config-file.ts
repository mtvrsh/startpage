import { get } from 'svelte/store'
import { hasSafeScheme } from '../util/scheme'
import { config, parseConfig } from './config'
import Bookmarks from './bookmarks'
import { Channels } from './channels'
import { Feeds } from './feeds'

/**
 * Builds the exported backup. Everything goes through the same validators the
 * importer uses, so a file the app produces always imports back cleanly:
 * cleared number inputs persist `null`, and bookmarks whose URL scheme is
 * unsafe can never be re-imported (restore drops them anyway).
 */
export function buildConfigFile() {
  return {
    config: parseConfig(get(config)),
    bookmarks: Bookmarks.serialize().filter(([, bookmark]) => hasSafeScheme(bookmark.url)),
    channels: Channels.serialize(),
    feeds: Feeds.serialize()
  }
}
