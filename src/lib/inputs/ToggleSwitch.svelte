<script lang="ts">
  let { checked = $bindable(), disabled = undefined } = $props()
</script>

<div class="toggle-switch">
  <input class="toggle-switch__input" type="checkbox" bind:checked {disabled} />
  <div class="toggle-switch__slider"></div>
</div>

<style lang="scss">
  @use '../scss/variables' as *;

  .toggle-switch {
    // The original switch scale (60×34 px), kept in rem so it still follows
    // the root font size. Shrinking it shortened every settings row and left
    // a visible gap at the bottom of the page.
    $width: 3.75rem;
    $height: 2.125rem;
    $offset: 0.25rem;

    position: relative;
    width: $width;
    height: $height;

    &__input {
      width: 0;
      height: 0;
      opacity: 0;

      &:checked + .toggle-switch__slider::before {
        background: var(--color-accent);
        transform: translateX($width - $height);
      }

      // The native checkbox is 0×0, so the slider must show keyboard focus.
      &:focus-visible + .toggle-switch__slider {
        outline: var(--outline) var(--color-accent);
        outline-offset: var(--gap-0);
      }

      // One de-emphasis color for the whole control, matching disabled text.
      // The thumb keeps its position, so a disabled checked switch is still
      // distinguishable from an unchecked one.
      &:disabled + .toggle-switch__slider {
        cursor: default;

        &::before {
          background: var(--color-fg-inactive);
        }
      }

      &:disabled:checked + .toggle-switch__slider::before {
        background: var(--color-fg-inactive);
      }
    }

    &__slider {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--color-surface);
      cursor: pointer;

      &::before {
        content: '';
        position: absolute;
        width: $height - 2 * $offset;
        height: $height - 2 * $offset;
        left: $offset;
        bottom: $offset;
        background: var(--color-surface-light);
        transition: transform $transition-duration;
      }
    }
  }
</style>
