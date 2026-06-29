import type { Channel } from '../../share/channels'
import type { SearchChannelsResult } from '../../util/piped'
import { derived } from 'svelte/store'
import { config } from '../../share/config'
import { PipedBackend } from './piped-backend'
import { StartpageBackend } from './startpage-backend'

export type { Channel, SearchChannelsResult }

export interface Backend {
  search(query: string): Promise<SearchChannelsResult[]>
  fetchChannel(id: string, reload?: boolean): Promise<Channel>
  fetchPlaylist(id: string, reload?: boolean): Promise<Channel>
}

const backends = {
  [PipedBackend.name]: PipedBackend,
  [StartpageBackend.name]: StartpageBackend,
} satisfies Record<string, new () => Backend>

export type InstanceType = keyof typeof backends

export const BACKEND_TYPES = Object.keys(backends) as InstanceType[]

function createBackend(type: InstanceType): Backend {
  return new backends[type]()
}

// Derive from instanceType only so createBackend() isn't called on every
// config change (e.g. feedLimit, timeoutInSeconds)
const instanceType = derived(config, $c => $c.instanceType)
export const backend = derived(instanceType, $t => createBackend($t))
