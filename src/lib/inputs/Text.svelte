<script lang="ts">
  let { value = $bindable(), class: className = '', ...args } = $props()
</script>

<input class="text {className}" bind:value {...args} />

<style lang="scss">
  @use '../scss/mixins' as *;

  .text {
    @include input-base;
  }
</style>
