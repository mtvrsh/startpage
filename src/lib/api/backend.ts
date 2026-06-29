import type { Channel } from '../../share/channels'
import type { SearchChannelsResult } from '../../util/piped'
import type { InstanceType } from '../../share/config'
import { get } from 'svelte/store'
import { config } from '../../share/config'
import { PipedBackend } from './piped-backend'
import { StartpageBackend } from './startpage-backend'

export type { Channel, SearchChannelsResult }

export interface Backend {
  search(query: string): Promise<SearchChannelsResult[]>
  fetchChannel(id: string, reload?: boolean): Promise<Channel>
  fetchPlaylist(id: string, reload?: boolean): Promise<Channel>
}

let cachedBackend: { type: InstanceType; backend: Backend } | null = null

export function getBackend(): Backend {
  const type = get(config).instanceType
  const cached = cachedBackend
  if (cached && cached.type === type) return cached.backend
  cachedBackend = { type, backend: createBackend(type) }
  return cachedBackend.backend
}

function createBackend(type: InstanceType): Backend {
  switch (type) {
    case 'startpage':
      return new StartpageBackend()
    case 'piped':
      return new PipedBackend()
  }
}
