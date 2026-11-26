<script lang="ts">
  let { id, label, use = $bindable(), options = $bindable(), disabled = false } = $props()

  let setUse = (e: Event) => {
    const target = e.target as HTMLSelectElement
    use = {
      value: target.options[target.selectedIndex].value,
      label: target.options[target.selectedIndex].label,
    }
  }
</script>

{#snippet option(value: string, label: string)}
  <option {value}>{label}</option>
{/snippet}

<label for={id}>{label}</label>

<div class="select" class:disabled>
  <select onchange={setUse} {id} {disabled}>
    {@render option(use.value, use.label)}

    {#each options as { value, label }}
      {#if use.value != value}
        {@render option(value, label)}
      {/if}
    {/each}
  </select>
</div>

<style lang="scss">
  @use 'scss/variables' as *;
  @use 'scss/mixins' as *;

  label {
    user-select: none;
  }

  .select {
    position: relative;
    display: inline-flex;

    select {
      @include input-base;
      // Room for the replacement chevron on the right.
      padding-right: $gap-3;
      cursor: pointer;
    }

    // The native arrow is hidden by input-base's `appearance: none`. A CSS
    // triangle follows the field's color in both themes and ignores pointer
    // events so clicks still open the native dropdown.
    &::after {
      position: absolute;
      top: 50%;
      right: $gap-1;
      width: 0;
      height: 0;
      border-top: $gap-0 solid currentColor;
      border-right: $gap-0 solid transparent;
      border-left: $gap-0 solid transparent;
      content: '';
      transform: translateY(-50%);
      pointer-events: none;
    }

    &.disabled::after {
      color: var(--color-fg-inactive);
    }
  }
</style>
