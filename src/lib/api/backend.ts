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
  piped: PipedBackend,
  startpage: StartpageBackend,
} satisfies Record<string, new () => Backend>

export type InstanceType = keyof typeof backends

function createBackend(type: InstanceType): Backend {
  return new backends[type]()
}

// Derive from instanceType only so createBackend() isn't called on every
// config change (e.g. feedLimit, timeoutInSeconds)
const instanceType = derived(config, $c => $c.instanceType)
export const backend = derived(instanceType, $t => createBackend($t))
