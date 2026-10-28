<script lang="ts">
  let {
    value = $bindable(),
    ...args
  } = $props()
</script>

<input class="text" bind:value {...args}>

<style lang="scss">
  @use '../scss/mixins' as *;

  .text {
    @include input-base;

    &:disabled {
      color: var(--color-fg-inactive);
    }

    &:required {
      border-color: var(--color-error);

      &:focus {
        border-color: transparent;
        outline-color: var(--color-error);
      }
    }
  }
</style>
