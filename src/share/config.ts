import { merge } from 'lodash'
import { writable } from 'svelte/store'
import { LocalStorage } from '../util/storage'
import type { InstanceType } from '../lib/api/backend'

export class Config extends LocalStorage{
  static LS_NAME = 'config'

  static saveOnUpdate() {
    config.subscribe(s => super.set(s))
  }

  static getUsedKeybind(keybind: Keybind) {
    return keybind.user || keybind.default
  }
}

export const defaults = {
  keybind: {
    close: 'Escape',
    focusSearch: { user: '', default: 's' }
  },
  instanceType: 'piped' as InstanceType,
  instance:
    { label: 'private.coffee', value: 'https://api.piped.private.coffee' },
  instances: [
    { label: 'kavin.rocks',    value: 'https://pipedapi.kavin.rocks' },
    { label: 'piped.yt',       value: 'https://api.piped.yt' },
    { label: 'private.coffee', value: 'https://api.piped.private.coffee' },
    { label: 'wireway.ch',     value: 'https://pipedapi.wireway.ch' }
  ],
  backendUrl: 'https://startpage-api.mtvrs.workers.dev',
  feedProtocolName: 'mpv',
  feedProtocolEnabledForVideos: false,
  feedProtocolEnabledForVideosInTitles: true,
  feedLimit: 100,
  feedThumbnailThemed: true,
  useDirectThumbnails: false,
  feedFetchAll: false,
  timeoutInSeconds: 5,
  cacheLifetimeInMinutes: 10
}

export const config = writable(merge({}, defaults, Config.get()))

interface Keybind {
  user: string;
  default: string;
}
