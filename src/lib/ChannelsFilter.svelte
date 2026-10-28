<script lang="ts">
  import strings from '../share/strings'
  import { Channels, channels, channelStates } from '../share/channels'
  import { status } from '../share/status'
  import { app } from './state/app.svelte'
  import FilterDropdown from './FilterDropdown.svelte'

  let items = $derived(
    [...$channels]
      .sort(Channels.BY_NAME)
      .map(([id, { name, displayName }]) => ({
        id,
        label: displayName || name,
        // Refetch progress already tracks per-channel loading globally.
        loading: $status.feed.fetching.now.includes(id),
        error: $channelStates.get(id)?.error,
        placeholder: name
      }))
  )

  let remove = (id: string) => {
    Channels.remove(id)

    if (app.filter === id)
      app.filter = strings.allKebabCase
  }
</script>

<FilterDropdown
  {items}
  selectedId={app.filter}
  allId={strings.allKebabCase}
  onselect={id => app.filter = id}
  onremove={remove}
  onrename={(id, value) => Channels.update(id, { displayName: value.trim() })}
  renameLabel={strings.renameChannel}
  renameHint={strings.renameChannelHint}
/>
