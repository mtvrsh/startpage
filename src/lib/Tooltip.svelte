<script lang="ts">
  let {
    text,
    type = 'error',
    children
  } = $props();
</script>

<button class="tooltip">
  {@render children()}
  <p class={["tooltip__text", type].join(' ')}>{text}</p>
</button>

<style lang="scss">
  @use 'scss/variables' as *;

  .tooltip {
    position: relative;
    display: flex;
    padding: $gap-0;
    color: inherit;
    background: inherit;
    border: none;
    outline: none;

    &:hover &__text,
    &:focus &__text {
      display: initial;
    }

    &__text {
      $arrow-size: .5lh;

      position: absolute;
      top: calc(100% + $arrow-size + .1rem);
      left: calc(50% - $arrow-size);
      z-index: 1;
      display: none;
      padding: $gap-0;
      text-wrap: nowrap;
      font-size: $font-size-meta;
      font-style: normal;

      &::before {
        content: '';
        position: absolute;
        bottom: 100%;
        left: 0;
        border: $arrow-size solid transparent;
        border-bottom-color: currentColor;
      }

      &.error {
        color: var(--color-error-fg);
        background: var(--color-error);

        &::before {
          color: var(--color-error);
        }
      }
    }
  }
</style>
