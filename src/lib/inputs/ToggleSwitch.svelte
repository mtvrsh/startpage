<script lang="ts">
  let { checked = $bindable(), disabled = undefined } = $props()
</script>

<div class="toggle-switch">
  <input class="toggle-switch__input" type="checkbox" bind:checked {disabled} />
  <div class="toggle-switch__slider"></div>
</div>

<style lang="scss">
  .toggle-switch {
    $width: 60px;
    $height: 34px;
    $offset: 4px;

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

      &:disabled + .toggle-switch__slider {
        cursor: default;
      }

      &:disabled + .toggle-switch__slider::before {
        background: var(--color-surface-light);
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
        transition: transform 0.1618s;
      }
    }
  }
</style>
