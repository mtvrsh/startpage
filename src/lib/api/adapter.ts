import type { Channel } from '../../share/channels'
import type { SearchChannelsResult } from '../../util/piped'
import type { InstanceType } from '../../share/config'
import { get } from 'svelte/store'
import { config } from '../../share/config'
import { PipedAdapter } from './piped-adapter'
import { StartpageAdapter } from './startpage-adapter'

export type { Channel, SearchChannelsResult }

export interface ApiAdapter {
  search(query: string): Promise<SearchChannelsResult[]>
  fetchChannel(id: string, reload?: boolean): Promise<Channel>
  fetchPlaylist(id: string, reload?: boolean): Promise<Channel>
}

let cachedAdapter: { type: InstanceType; adapter: ApiAdapter } | null = null

export function getAdapter(): ApiAdapter {
  const type = get(config).instanceType
  const instance = cachedAdapter
  if (instance && instance.type === type) return instance.adapter
  cachedAdapter = { type, adapter: createAdapter(type) }
  return cachedAdapter.adapter
}

function createAdapter(type: InstanceType): ApiAdapter {
  switch (type) {
    case 'startpage':
      return new StartpageAdapter()
    case 'piped':
      return new PipedAdapter()
  }
}
