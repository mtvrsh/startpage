<script lang="ts">
  import appConfig from '../config'
  import strings from '../share/strings'
  import { parseConfig, config, defaults } from '../share/config'
  import { BACKEND_TYPES, isInstanceType, type InstanceType } from '../lib/api/backend'
  import Bookmarks, { parseBookmarks } from '../share/bookmarks'
  import { Channels } from '../share/channels'
  import { Feeds } from '../share/feeds'
  import { isRecord } from '../util/validate'
  import { buildConfigFile } from '../share/config-file'
  import InputNumber from './InputNumber.svelte';
  import InputSelect from './InputSelect.svelte';
  import Text from './inputs/Text.svelte';
  import ToggleSwitch from './inputs/ToggleSwitch.svelte';

  let importError = $state('')

  const backendLabel: Record<InstanceType, string> = {
    piped: strings.piped,
    startpage: strings.startpageBackend,
  }

  const useBackend = (instanceType: InstanceType) => {
    backendUse = { value: instanceType, label: backendLabel[instanceType] }
  }

  const initialBackend: InstanceType = isInstanceType($config.instanceType)
    ? $config.instanceType
    : defaults.instanceType
  let backendUse = $state({
    value: initialBackend,
    label: backendLabel[initialBackend],
  })
  $effect(() => {
    $config.instanceType = backendUse.value
  })
  let importInput: HTMLInputElement

  let exportConfig = () => {
    const data = buildConfigFile()
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'startpage-config.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  let importConfig = () => {
    importError = ''
    const file = importInput.files?.[0]
    if (!file) return

    file.text()
      .then(text => JSON.parse(text))
      .then((imported: unknown) => {
        const payload = isRecord(imported) ? imported : {}
        const issues: string[] = []

        // Strict import: validate and normalize every section first, collecting
        // all problems. A single malformed entry rejects the whole payload, so
        // no store is ever left half-applied. Sections that are absent are left
        // untouched.
        const nextConfig = payload.config === undefined
          ? undefined
          : parseConfig(payload.config, issues)
        const nextBookmarks = payload.bookmarks === undefined
          ? undefined
          : parseBookmarks(payload.bookmarks, issues)
        const nextChannels = payload.channels === undefined
          ? undefined
          : Channels.parseStored(payload.channels, issues)
        const nextFeeds = payload.feeds === undefined
          ? undefined
          : Feeds.parseStored(payload.feeds, issues)

        if (issues.length) {
          console.error('Config import rejected', issues)
          importError = issues.length === 1
            ? `${strings.importFailed}: ${issues[0]}`
            : `${strings.importFailed}: ${issues[0]} (+${issues.length - 1} more)`
          return
        }

        if (nextConfig) {
          config.set(nextConfig)
          useBackend(nextConfig.instanceType)
        }
        if (nextBookmarks) Bookmarks.restore(nextBookmarks)
        if (nextChannels) Channels.restore(nextChannels)
        if (nextFeeds) Feeds.restore(nextFeeds)
      })
      .catch(() => {
        importError = strings.importFailed
      })
      .finally(() => {
        importInput.value = ''
      })
  }
</script>

{#snippet separator(title: string)}
  <div class="general__group-separator">
    <h1 class="general__group-separator-title">{title}</h1>
  </div>
{/snippet}

<ul class="general">
  <li class="general__group">
    {@render separator(strings.piped)}

    <ul class="general__group-list">
      <li class="general__group-list-item">
        <InputSelect
          id="settings-instance-type"
          label={strings.backendType}
          bind:use={backendUse}
          options={BACKEND_TYPES.map(t => ({ value: t, label: backendLabel[t] }))} />
      </li>

      {#if $config.instanceType === 'startpage'}
        <li class="general__group-list-item">
          <label for="settings-backend-url">{strings.backendUrl}</label>
          <Text id="settings-backend-url" bind:value={$config.backendUrl} />
        </li>
      {:else}
        <li class="general__group-list-item">
          <InputSelect
            id={strings.instanceId}
            label={strings.instance}
            bind:use={$config.instance}
            bind:options={$config.instances} />
        </li>
      {/if}
    </ul>
  </li>

  <li class="general__group">
    {@render separator(strings.videoFeed)}

    <ul class="general__group-list">
      <li>
        <label class="general__group-list-item">
          {strings.feedThumbnailThemed}
          <ToggleSwitch bind:checked={$config.feedThumbnailThemed} />
        </label>
      </li>

      <li>
        <label class="general__group-list-item">
          {strings.directThumbnails}
          <ToggleSwitch bind:checked={$config.useDirectThumbnails} />
        </label>
      </li>

      <li>
        <label class="general__group-list-item">
          {strings.feedFetchAll}
          <ToggleSwitch bind:checked={$config.feedFetchAll} />
        </label>
      </li>

      <li class="general__group-list-item">
        <InputNumber
          id={strings.feedCacheKebabCase}
          label={strings.feedCache}
          min={0}
          bind:value={$config.cacheLifetimeInMinutes} />
      </li>

      <li class="general__group-list-item">
        <InputNumber
          id={strings.feedLimitKebabCase}
          label={strings.feedLimit}
          min={0}
          bind:value={$config.feedLimit} />
      </li>

      {@render separator(strings.customProtocol)}

      <li>
        <label class="general__group-list-item">
          {strings.openVideosInApp}
          <ToggleSwitch bind:checked={$config.feedProtocolEnabledForVideos} />
        </label>
      </li>

      <li>
        <label
          class="general__group-list-item"
          class:disabled={!$config.feedProtocolEnabledForVideos}>
          {strings.useInTitles}
          <ToggleSwitch
            bind:checked={$config.feedProtocolEnabledForVideosInTitles}
            disabled={!$config.feedProtocolEnabledForVideos} />
        </label>
      </li>

      <li>
        <label
          class="general__group-list-item"
          class:disabled={!$config.feedProtocolEnabledForVideos}>
          {strings.customProtocolName}
          <Text
            bind:value={$config.feedProtocolName}
            disabled={!$config.feedProtocolEnabledForVideos} />
        </label>
      </li>
    </ul>
  </li>

  <li class="general__group">
    {@render separator(strings.readerFeed)}

    <ul class="general__group-list">
      <li>
        <label class="general__group-list-item">
          {strings.feedShowSummary}
          <ToggleSwitch bind:checked={$config.feedShowSummary} />
        </label>
      </li>

      <li class="general__group-list-item">
        <InputNumber
          id="reader-limit"
          label={strings.readerLimit}
          min={0}
          bind:value={$config.readerLimit} />
      </li>

      <li class="general__group-list-item">
        <label for="settings-feed-proxy-url">{strings.feedProxyUrl}</label>
        <Text id="settings-feed-proxy-url" bind:value={$config.feedProxyUrl} />
      </li>
    </ul>
  </li>

  <li class="general__group">
    {@render separator(strings.configManagement)}

    <ul class="general__group-list">
      <li class="general__group-list-item">
        <span class="general__version">{strings.version}: {appConfig.version}</span>
        <div class="general__group-list-item general__group-list-item--buttons">
          <button class="button" onclick={exportConfig}>
            {strings.exportConfig}
          </button>
          <button class="button" onclick={() => importInput.click()}>
            {strings.importConfig}
          </button>
          <input
            type="file"
            accept=".json"
            bind:this={importInput}
            onchange={importConfig}
            class="general__hidden-input"
          />
        </div>
      </li>
      {#if importError}
        <li class="general__group-list-item general__error">
          {importError}
        </li>
      {/if}
    </ul>
  </li>
</ul>

<style lang="scss">
  @use 'scss/variables' as *;

  .general {
    display: flex;
    flex-direction: column;
    gap: $gap-4;

    &__group {
      &-list {
        &-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: $gap-2 $gap-1;
          user-select: none;

          &.disabled {
            color: var(--color-fg-inactive);
          }

          &--buttons {
            justify-content: flex-end;
            gap: $gap-2;
            padding: 0;
          }
        }
      }

      &-separator {
        position: relative;
        height: .08rem;
        margin: $gap-4 $gap-1;
        background: var(--color-accent);

        &-title {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          padding-right: $gap-2;
          font-size: .8rem;
          color: var(--color-accent);
          background: var(--color-bg);
          user-select: none;
        }
      }
    }

    &__hidden-input {
      display: none;
    }

    &__version {
      font-size: .8rem;
      color: var(--color-fg-inactive);
    }
  }
</style>
