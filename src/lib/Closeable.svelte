<script lang="ts">
  import { config } from '../share/config'
  import { isTypedCharacter } from '../util/keyboard'

  let {
    children,
    open = $bindable(),
    onClose = undefined
  } = $props()

  let container: HTMLElement;

  let close = () => {
    open = false;
    onClose?.();
  }

  let closeIfPressedCloseKey = (e: KeyboardEvent) => {
    // A character being typed into a field (e.g. inline rename) must not
    // close the dropdown; named keys like Escape still work.
    if (isTypedCharacter(e))
      return

    if (e.key == $config.keybind.close)
      close()
  }

  let closeIfClickedElementNotInContainer = (e: MouseEvent) =>
    container.contains(e.target as HTMLElement) || close()
</script>

<svelte:window
  onkeyup={closeIfPressedCloseKey}
  onclick={closeIfClickedElementNotInContainer}
/>

<div bind:this={container}>
  {@render children()}
</div>
