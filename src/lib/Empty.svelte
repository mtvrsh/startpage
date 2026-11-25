<script lang="ts">
  let { message, error = false }: { message: string; error?: boolean } = $props()
</script>

<p class="message" class:error>
  {message}
</p>

<style lang="scss">
  @use 'scss/variables' as *;

  .message {
    display: grid;
    flex: 1;
    align-content: center;
    justify-content: center;
    height: 100%;
    min-height: 6rem;
    padding: var(--gap-1);
    font-size: $font-size-body;
    color: var(--color-fg-inactive);
    user-select: none;
  }

  .error {
    color: var(--color-error);
  }
</style>
