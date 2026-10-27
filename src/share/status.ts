import { writable } from 'svelte/store'
import { LocalStorage } from '../util/storage'
import { countOr, isRecord } from '../util/validate'

export class Status extends LocalStorage {
  static LS_NAME = 'status'

  static saveOnUpdate() {
    status.subscribe(s => super.set(s))
  }
}

export interface AppStatus {
  feed: {
    fetching: {
      now: string[]
      max: number
    }
    fetchedAt: number
  }
}

/**
 * Validates stored status: a corrupt `feed`/`fetching` object must not break
 * `Channels.refetch()` (`.filter` on `fetching.now`) or `FetchProgress`.
 * Progress is transient, so anything malformed degrades to "idle".
 */
export function parseStoredStatus(raw: unknown): AppStatus {
  const source = isRecord(raw) ? raw : {}
  const feed = isRecord(source.feed) ? source.feed : {}
  const fetching = isRecord(feed.fetching) ? feed.fetching : {}

  return {
    feed: {
      fetching: {
        now: Array.isArray(fetching.now)
          ? fetching.now.filter((id): id is string => typeof id === 'string')
          : [],
        max: countOr(fetching.max, 0)
      },
      fetchedAt: countOr(feed.fetchedAt, 0)
    }
  }
}

export const status = writable<AppStatus>(parseStoredStatus(Status.get()))
