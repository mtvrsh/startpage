import { writable } from 'svelte/store'
import { LocalStorage } from '../util/storage'
import { isHttpUrl, isRecord } from '../util/validate'
import { isInstanceType, type InstanceType } from '../lib/api/backend-types'

const API_URL = 'https://startpage-api.mtvrs.workers.dev'

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
    focusSearch: { user: '', default: 's' },
    openSettings: { user: '', default: ',' }
  },
  instanceType: 'piped' as InstanceType,
  instance:
    { label: 'private.coffee', value: 'https://api.piped.private.coffee' },
  instances: [
    { label: 'wireway.ch',     value: 'https://pipedapi.wireway.ch' },
    { label: 'private.coffee', value: 'https://api.piped.private.coffee' }
  ],
  backendUrl: API_URL,
  feedProxyUrl: API_URL,
  feedProtocolName: 'mpv',
  feedProtocolEnabledForVideos: false,
  feedProtocolEnabledForVideosInTitles: true,
  feedLimit: 100,
  feedThumbnailThemed: true,
  readerLimit: 30,
  useDirectThumbnails: false,
  feedFetchAll: false,
  feedShowSummary: false,
  timeoutInSeconds: 5,
  cacheLifetimeInMinutes: 10
}

export type AppConfig = typeof defaults

interface Instance {
  label: string
  value: string
}

interface Keybind {
  user: string;
  default: string;
}

function readString(value: unknown, fallback: string, path: string, issues?: string[]): string {
  if (value === undefined) return fallback

  if (typeof value !== 'string') {
    issues?.push(`${path}: expected a string`)
    return fallback
  }

  return value
}

function readBoolean(value: unknown, fallback: boolean, path: string, issues?: string[]): boolean {
  if (value === undefined) return fallback

  if (typeof value !== 'boolean') {
    issues?.push(`${path}: expected a boolean`)
    return fallback
  }

  return value
}

function readCount(value: unknown, fallback: number, path: string, issues?: string[]): number {
  // Svelte number inputs write `null` when the field is cleared, so that is a
  // valid "unset" marker rather than a malformed value.
  if (value === undefined || value === null) return fallback

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issues?.push(`${path}: expected a number`)
    return fallback
  }

  if (value < 0) {
    issues?.push(`${path}: expected a non-negative number`)
  }

  return Math.max(0, value)
}

function parseInstanceSource(
  value: unknown,
  path: string,
  issues?: string[]
): Instance | undefined {
  if (!isRecord(value)) {
    issues?.push(`${path}: expected an object`)
    return undefined
  }

  const label = readString(value.label, '', `${path}.label`, issues)

  if (typeof value.value !== 'string' || !isHttpUrl(value.value)) {
    issues?.push(`${path}.value: expected an http(s) url`)
    return undefined
  }

  return { label: label || value.value, value: value.value }
}

function readInstance(value: unknown, fallback: Instance, path: string, issues?: string[]): Instance {
  if (value === undefined) return { ...fallback }

  return parseInstanceSource(value, path, issues) ?? { ...fallback }
}

function readInstances(
  value: unknown,
  fallback: Instance[],
  path: string,
  issues?: string[]
): Instance[] {
  const fallbackInstances = () => fallback.map(instance => ({ ...instance }))

  if (value === undefined) return fallbackInstances()

  if (!Array.isArray(value)) {
    issues?.push(`${path}: expected an array`)
    return fallbackInstances()
  }

  const instances = value.flatMap((instance, index) =>
    parseInstanceSource(instance, `${path}[${index}]`, issues) ?? []
  )

  return instances.length ? instances : fallbackInstances()
}

function readKeybind(value: unknown, fallback: Keybind, path: string, issues?: string[]): Keybind {
  if (value === undefined) return { ...fallback }

  if (!isRecord(value)) {
    issues?.push(`${path}: expected an object`)
    return { ...fallback }
  }

  return {
    user: readString(value.user, fallback.user, `${path}.user`, issues),
    default: readString(value.default, fallback.default, `${path}.default`, issues)
  }
}

function readInstanceType(value: unknown, issues?: string[]): InstanceType {
  if (value === undefined) return defaults.instanceType

  if (!isInstanceType(value)) {
    issues?.push('config.instanceType: expected a known backend')
    return defaults.instanceType
  }

  return value
}

/**
 * Validates stored/imported config against the defaults, field by field:
 * unknown keys are dropped, missing or malformed values fall back to the
 * default. Never throws. Pass `issues` in strict mode (import) to collect
 * what was malformed instead of silently sanitizing it.
 */
export function parseConfig(raw: unknown, issues?: string[]): AppConfig {
  if (raw !== undefined && !isRecord(raw)) {
    issues?.push('config: expected an object')
  }

  const source = isRecord(raw) ? raw : {}
  const keybind = isRecord(source.keybind) ? source.keybind : {}

  if (source.keybind !== undefined && !isRecord(source.keybind)) {
    issues?.push('config.keybind: expected an object')
  }

  return {
    keybind: {
      close: readString(keybind.close, defaults.keybind.close, 'config.keybind.close', issues),
      focusSearch: readKeybind(
        keybind.focusSearch,
        defaults.keybind.focusSearch,
        'config.keybind.focusSearch',
        issues
      ),
      openSettings: readKeybind(
        keybind.openSettings,
        defaults.keybind.openSettings,
        'config.keybind.openSettings',
        issues
      )
    },
    instanceType: readInstanceType(source.instanceType, issues),
    instance: readInstance(source.instance, defaults.instance, 'config.instance', issues),
    instances: readInstances(source.instances, defaults.instances, 'config.instances', issues),
    backendUrl: readString(source.backendUrl, defaults.backendUrl, 'config.backendUrl', issues),
    feedProxyUrl: readString(source.feedProxyUrl, defaults.feedProxyUrl, 'config.feedProxyUrl', issues),
    feedProtocolName: readString(
      source.feedProtocolName,
      defaults.feedProtocolName,
      'config.feedProtocolName',
      issues
    ),
    feedProtocolEnabledForVideos: readBoolean(
      source.feedProtocolEnabledForVideos,
      defaults.feedProtocolEnabledForVideos,
      'config.feedProtocolEnabledForVideos',
      issues
    ),
    feedProtocolEnabledForVideosInTitles: readBoolean(
      source.feedProtocolEnabledForVideosInTitles,
      defaults.feedProtocolEnabledForVideosInTitles,
      'config.feedProtocolEnabledForVideosInTitles',
      issues
    ),
    feedLimit: readCount(source.feedLimit, defaults.feedLimit, 'config.feedLimit', issues),
    feedThumbnailThemed: readBoolean(
      source.feedThumbnailThemed,
      defaults.feedThumbnailThemed,
      'config.feedThumbnailThemed',
      issues
    ),
    readerLimit: readCount(source.readerLimit, defaults.readerLimit, 'config.readerLimit', issues),
    useDirectThumbnails: readBoolean(
      source.useDirectThumbnails,
      defaults.useDirectThumbnails,
      'config.useDirectThumbnails',
      issues
    ),
    feedFetchAll: readBoolean(
      source.feedFetchAll,
      defaults.feedFetchAll,
      'config.feedFetchAll',
      issues
    ),
    feedShowSummary: readBoolean(
      source.feedShowSummary,
      defaults.feedShowSummary,
      'config.feedShowSummary',
      issues
    ),
    timeoutInSeconds: readCount(
      source.timeoutInSeconds,
      defaults.timeoutInSeconds,
      'config.timeoutInSeconds',
      issues
    ),
    cacheLifetimeInMinutes: readCount(
      source.cacheLifetimeInMinutes,
      defaults.cacheLifetimeInMinutes,
      'config.cacheLifetimeInMinutes',
      issues
    )
  }
}

export const config = writable<AppConfig>(parseConfig(Config.get()))
