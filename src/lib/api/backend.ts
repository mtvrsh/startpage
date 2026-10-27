import type { Channel } from '../../share/channels'
import type { SearchChannelsResult } from '../../util/piped'
import { derived } from 'svelte/store'
import { config } from '../../share/config'
import { BACKEND_TYPES, isInstanceType, type InstanceType } from './backend-types'
import { PipedBackend } from './piped-backend'
import { StartpageBackend } from './startpage-backend'

export { BACKEND_TYPES, isInstanceType, type InstanceType }

export type { Channel, SearchChannelsResult }

export interface Backend {
  search(query: string): Promise<SearchChannelsResult[]>
  fetchChannel(id: string, reload?: boolean): Promise<Channel>
  fetchPlaylist(id: string, reload?: boolean): Promise<Channel>
}

// Annotated (not inferred) so the compiler rejects a backend that is missing
// from BACKEND_TYPES or registered without being listed there.
const backends: Record<InstanceType, new () => Backend> = {
  [PipedBackend.name]: PipedBackend,
  [StartpageBackend.name]: StartpageBackend,
}

function createBackend(type: InstanceType): Backend {
  return new backends[type]()
}

// Derive from instanceType only so createBackend() isn't called on every
// config change (e.g. feedLimit, timeoutInSeconds)
const instanceType = derived(config, $c => $c.instanceType)
export const backend = derived(instanceType, $t => createBackend($t))
