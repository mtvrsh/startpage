<script lang="ts">
  import IconSync from './icons/Sync.svelte'
  import strings from '../share/strings'
  import { Channels, channels } from '../share/channels'
  import { status } from '../share/status'

  let date = $derived(new Date($status.feed.fetchedAt).toLocaleString())
  // A refetch in flight is joined by further calls, so the button would be a
  // no-op; disable it instead of silently dropping a forced reload. With no
  // channels there is nothing to refresh either.
  let syncing = $derived($status.feed.fetching.max > 0)
  let noChannels = $derived($channels.size === 0)

  let sync = () => Channels.refetch({ reload: true })
</script>

<button
  class="column__action"
  type="button"
  onclick={sync}
  disabled={syncing || noChannels}
  aria-busy={syncing}
  title={date}
  aria-label={strings.sync}
>
  <IconSync />
</button>
