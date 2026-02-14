<script lang="ts">
  import strings from '../share/strings'
  import { config } from '../share/config'
  import InputNumber from './InputNumber.svelte';
  import InputSelect from './InputSelect.svelte';
  import Text from './inputs/Text.svelte';
  import ToggleSwitch from './inputs/ToggleSwitch.svelte';
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
          id={strings.instanceId}
          label={strings.instance}
          bind:use={$config.instance}
          bind:options={$config.instances} />
      </li>
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
