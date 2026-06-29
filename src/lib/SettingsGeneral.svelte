<script lang="ts">
  import { merge } from 'lodash'
  import strings from '../share/strings'
  import { config, defaults } from '../share/config'
  import { BACKEND_TYPES, type InstanceType } from '../lib/api/backend'
  import Bookmarks from '../share/bookmarks'
  import { Channels } from '../share/channels'
  import InputNumber from './InputNumber.svelte';
  import InputSelect from './InputSelect.svelte';
  import Text from './inputs/Text.svelte';
  import ToggleSwitch from './inputs/ToggleSwitch.svelte';

  let importError = $state('')

  const backendLabel: Record<InstanceType, string> = {
    piped: strings.piped,
    startpage: strings.startpageBackend,
  }

  let backendUse = $state({
    value: $config.instanceType,
    label: backendLabel[$config.instanceType as InstanceType],
  })
  $effect(() => {
    $config.instanceType = backendUse.value
  })
  let importInput: HTMLInputElement

  let exportConfig = () => {
    const data = {
      config: $config,
      bookmarks: Bookmarks.serialize(),
      channels: Channels.serialize()
    }
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
      .then(imported => {
        config.set(merge({}, defaults, imported.config))
        if (imported.bookmarks) Bookmarks.restore(imported.bookmarks)
        if (imported.channels) Channels.restore(imported.channels)
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
    {@render separator(strings.feed)}

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
    {@render separator(strings.configManagement)}

    <ul class="general__group-list">
      <li class="general__group-list-item general__group-list-item--buttons">
        <button class="nav__item" onclick={exportConfig}>
          {strings.exportConfig}
        </button>
        <button class="nav__item" onclick={() => importInput.click()}>
          {strings.importConfig}
        </button>
        <input
          type="file"
          accept=".json"
          bind:this={importInput}
          onchange={importConfig}
          style="display: none"
        />
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
  }
</style>
