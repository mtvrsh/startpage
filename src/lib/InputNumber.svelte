<script lang="ts">
  import strings from '../share/strings'

  let {
    id,
    label,
    min = undefined,
    max = undefined,
    value = $bindable(),
    fallback = 0,
    disabled = false,
  }: {
    id: string
    label: string
    min?: number
    max?: number
    value: number
    fallback?: number
    disabled?: boolean
  } = $props()

  // A number input writes `null` while its field is being cleared, which would
  // put an invalid value into the config store (and blank both feeds). Keep the
  // field's text locally and only ever write valid numbers to the store.
  let text = $state(value == null ? '' : String(value))
  let lastValue = value
  let input = $state<HTMLInputElement>()

  $effect(() => {
    if (value === lastValue) return
    lastValue = value
    text = value == null ? '' : String(value)
  })

  let clamp = (number: number) => {
    if (typeof min === 'number' && number < min) return min
    if (typeof max === 'number' && number > max) return max
    return number
  }

  let setNumber = (number: number) => {
    const next = clamp(number)
    value = next
    text = String(next)
  }

  let onInput = (event: Event) => {
    text = (event.currentTarget as HTMLInputElement).value
    if (text.trim() === '') return

    const parsed = Number(text)
    if (Number.isFinite(parsed)) value = clamp(parsed)
  }

  let onBlur = () => {
    const parsed = Number(text)
    if (text.trim() === '' || !Number.isFinite(parsed)) {
      value = fallback
      text = String(fallback)
      return
    }

    setNumber(parsed)
  }

  // The native spinners are hidden by `appearance: none`; these buttons replace
  // them for pointer users. Keyboard users keep the input's native arrow keys.
  let stepBy = (delta: number) => {
    const parsed = Number(text)
    const current = text.trim() && Number.isFinite(parsed) ? parsed : (value ?? 0)
    setNumber(current + delta)
    // Restore the input's focus ring after the button takes focus on click.
    input?.focus()
  }
</script>

<label for={id}>{label}</label>
<div class="input-number" class:disabled>
  <input
    bind:this={input}
    type="number"
    {id}
    {min}
    {max}
    {disabled}
    value={text}
    oninput={onInput}
    onblur={onBlur}
  />

  <div class="input-number__spinners">
    <button
      type="button"
      class="input-number__spinner input-number__spinner--up"
      tabindex="-1"
      aria-label={strings.increase}
      {disabled}
      onclick={() => stepBy(1)}
    ></button>
    <button
      type="button"
      class="input-number__spinner input-number__spinner--down"
      tabindex="-1"
      aria-label={strings.decrease}
      {disabled}
      onclick={() => stepBy(-1)}
    ></button>
  </div>
</div>

<style lang="scss">
  @use 'scss/variables' as *;
  @use 'scss/mixins' as *;

  label {
    user-select: none;
  }

  .input-number {
    display: flex;
    align-items: stretch;
    width: 4rem;
    background: var(--color-surface);

    input {
      flex: 1;
      min-width: 0;
      @include input-base($gap-1);
      // Firefox keeps its native spinners with `appearance: none`; `textfield`
      // removes them there, while Chromium needs the spin-button pseudo-elements.
      -moz-appearance: textfield;
      appearance: textfield;
      // Leave room for the replacement spinners on the right.
      padding-right: $gap-0;

      &::-webkit-outer-spin-button,
      &::-webkit-inner-spin-button {
        margin: 0;
        -webkit-appearance: none;
      }

      // The ring belongs to the whole composed field, not just its text area.
      &:focus {
        outline: none;
      }
    }

    &:focus-within {
      outline: $outline var(--color-accent);
    }

    &__spinners {
      display: flex;
      flex: none;
      flex-direction: column;
      width: $gap-2;
    }

    &__spinner {
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: center;
      padding: 0;
      color: inherit;
      background: transparent;
      border: none;
      cursor: pointer;

      &:disabled {
        @include disabled-control;
        background: transparent;
      }

      &::before {
        content: '';
        width: 0;
        height: 0;
        border-right: $gap-0 solid transparent;
        border-left: $gap-0 solid transparent;
      }

      &--up::before {
        border-bottom: $gap-0 solid currentColor;
      }

      &--down::before {
        border-top: $gap-0 solid currentColor;
      }

      &:hover:not(:disabled) {
        color: var(--color-accent-text);
      }
    }
  }
</style>
