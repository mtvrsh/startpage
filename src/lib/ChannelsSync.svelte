<script lang="ts">
  import IconSync from './icons/Sync.svelte'
  import strings from '../share/strings'
  import { Channels } from '../share/channels'
  import { status } from '../share/status'

  let date = $derived((new Date($status.feed.fetchedAt)).toLocaleString())

  let sync = () => Channels.refetch({ reload: true })
</script>

<button class="column__action" type="button" onclick={sync} title={date} aria-label={strings.sync}>
  <IconSync />
</button>
