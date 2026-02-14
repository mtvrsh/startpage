import { merge } from 'lodash'
import { writable } from 'svelte/store'
import { LocalStorage } from '../util/storage'

export class Config extends LocalStorage{
  static LS_NAME = 'config'

  static saveOnUpdate() {
    config.subscribe(s => super.set(s))
  }

  static getUsedKeybind(keybind: Keybind) {
    return keybind.user || keybind.default
  }
}

export const config = writable(merge({
  keybind: {
    close: 'Escape',
    focusSearch: { user: '', default: 's' }
  },
  instance:
    { label: 'private.coffee', value: 'https://api.piped.private.coffee' },
  instances: [
    { label: 'kavin.rocks',    value: 'https://pipedapi.kavin.rocks' },
    { label: 'piped.yt',       value: 'https://api.piped.yt' },
    { label: 'private.coffee', value: 'https://api.piped.private.coffee' },
    { label: 'wireway.ch',     value: 'https://pipedapi.wireway.ch' }
  ],
  feedProtocolName: 'mpv',
  feedProtocolEnabledForVideos: false,
  feedProtocolEnabledForVideosInTitles: true,
  feedLimit: 100,
  feedThumbnailThemed: true,
  feedFetchAll: false,
  timeoutInSeconds: 5,
  cacheLifetimeInMinutes: 10
}, Config.get()))

interface Keybind {
  user: string;
  default: string;
}
