<script lang="ts">
  let {
    value = $bindable(),
    ...args
  } = $props()
</script>

<input class="text" bind:value {...args}>

<style lang="scss">
  @use '../scss/variables' as *;
  
  .text {
    padding: $gap-1;
    color: var(--color-fg);
    background: var(--color-surface);
    border: none;

    &:hover {
      background: var(--color-surface-light);
    }

    &:disabled {
      color: var(--color-fg-inactive);
    }

    &:required {
      color: var(--color-error);
    }
  }
</style>
