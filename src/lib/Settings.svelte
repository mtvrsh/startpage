<script lang="ts">
  import strings from '../share/strings'
  import { app } from './state/app.svelte'
  import SettingsGeneral from './SettingsGeneral.svelte'

  let closeButton: HTMLButtonElement | undefined = $state()

  let close = () => (app.route.path = strings.paths.home)

  $effect(() => {
    closeButton?.focus()
  })
</script>

<div class="settings">
  <header class="settings__header">
    <h1 class="settings__title">{strings.settings}</h1>

    <button
      class="settings__close"
      type="button"
      title={strings.close}
      aria-label={strings.close}
      bind:this={closeButton}
      onclick={close}>×</button
    >
  </header>

  <div class="settings__list">
    <SettingsGeneral />
  </div>
</div>

<style lang="scss">
  @use 'scss/variables' as *;
  @use 'scss/mixins' as *;

  .settings {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    height: 100%;
    background: var(--color-bg);

    &__header {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: space-between;
      gap: $gap-1;
      padding: $gap-1;
      border-bottom: $border var(--color-surface);
    }

    &__title {
      overflow: hidden;
      font-size: $font-size-column-title;
      color: var(--color-fg-inactive);
      white-space: nowrap;
      text-overflow: ellipsis;
      user-select: none;
    }

    &__close {
      width: 1.5rem;
      height: 1.5rem;
      line-height: 1;
      // Reuse the delete buttons' destructive treatment instead of keeping a
      // private copy of the red hover recipe.
      @include button-danger($font-size-icon, 0, var(--color-surface));
    }

    &__list {
      flex: 1;
      min-height: 0;
      padding: $gap-2;
      overflow-y: auto;
    }
  }
</style>
