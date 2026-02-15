<script lang="ts">
  let {
    id,
    label,
    use = $bindable(),
    options = $bindable()
  } = $props()

  let setUse = (e: Event) => {
    const target = e.target as HTMLSelectElement
    use.value = target.options[target.selectedIndex].value
    use.label = target.options[target.selectedIndex].label
  }
</script>

{#snippet option(value: string, label: string)}
  <option {value}>{label}</option>
{/snippet}

<label for={id}>{label}</label>

<select onchange={setUse} {id}>
  {@render option(use.value, use.label)}

  {#each options as {value, label}}
    {#if use.value != value}
      {@render option(value, label)}
    {/if}
  {/each}
</select>

<style>
  label {
    user-select: none;
  }

  select {
    appearance: none;
    padding: .5rem;
    color: var(--color-accent);
    background-color: var(--color-bg);
    border: none;
    outline: none;
  }

  select:hover {
    background-color: var(--color-surface);
    cursor: pointer;
  }
</style>
