<script>
  let {
    id,
    label,
    min = undefined,
    max = undefined,
    value = $bindable()
  } = $props()

  // `min`/`max` only constrain the spinner and form validation; typed values
  // still reach the store. Normalize on change so out-of-range numbers (a
  // negative feed limit, a zero timeout) cannot leak into persisted config.
  let normalize = () => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return

    if (typeof min === 'number' && value < min) value = min
    else if (typeof max === 'number' && value > max) value = max
  }
</script>

<label for={id}>{label}</label>
<input type="number" bind:value={value} onchange={normalize} {id} {min} {max}>

<style>
  label {
    user-select: none;
  }

  input {
    width: 3.5rem;
    padding: .5rem .25rem .5rem .5rem;
    color: var(--color-accent);
    background-color: var(--color-bg);
    border: none;
    outline: none;
  }

  input:hover,
  input:focus {
    color: var(--color-fg);
    background-color: var(--color-accent);
  }
</style>
