<script lang="ts">
  import { flushSync } from 'svelte'
  import strings from '../share/strings'
  import { config } from '../share/config'
  import { Feeds, entries, feedStates, feeds, type Feed } from '../share/feeds'
  import Column from './Column.svelte'
  import Empty from './Empty.svelte'
  import { editGesture } from './gestures'
  import { inlineRename } from './inline-rename'

  let adding = $state(false)
  let url = $state('')
  let name = $state('')
  let errorUrl = $state(false)
  let errorMessage = $state('')
  let renamingUrl = $state('')
  let renameValue = $state('')

  Feeds.refetch()

  const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

  let subscriptions = $derived(
    [...$feeds.values()].sort((a, b) =>
      (a.name || a.url).localeCompare(b.name || b.url)
    )
  )

  let visibleEntries = $derived.by(() => {
    const seen = new Set<string>()

    return [...$entries]
      .sort((a, b) =>
        b.published - a.published || a.title.localeCompare(b.title)
      )
      .filter(entry => {
        const key = entry.url || `${entry.feedUrl}\u0000${entry.title}`
        if (seen.has(key)) return false

        seen.add(key)
        return true
      })
      .slice(0, $config.readerLimit)
  })

  let submit = (event: SubmitEvent) => {
    event.preventDefault()

    errorUrl = false
    errorMessage = ''

    if (!url.trim()) {
      errorUrl = true
      return
    }

    Feeds.add(url, name)
      .then(() => {
        url = ''
        name = ''
        adding = false
      })
      .catch(error => {
        errorUrl = true
        errorMessage = error instanceof Error ? error.message : String(error)
      })
  }

  let formatDate = (timestamp: number) =>
    timestamp ? dateFormat.format(timestamp) : ''

  let startRename = (feed: Feed) => {
    renamingUrl = feed.url
    renameValue = feed.name

    // Flush before the input mounts so focus happens inside the gesture
    // (needed for the mobile keyboard).
    flushSync()
  }

  let commitRename = (url: string, value: string) => {
    if (renamingUrl !== url) return

    Feeds.rename(url, value)
    renamingUrl = ''
    renameValue = ''
  }

  let cancelRename = (url: string) => {
    if (renamingUrl !== url) return

    renamingUrl = ''
    renameValue = ''
  }
</script>

<Column title={strings.feeds} bind:adding addTitle={strings.addFeed}>
  {#snippet form()}
    <form onsubmit={submit}>
      <input
        class="column__input"
        class:error={errorUrl}
        bind:value={url}
        placeholder={strings.feedUrl}
        aria-label={strings.feedUrl}
        aria-invalid={errorUrl}
      >
      <input
        class="column__input"
        bind:value={name}
        placeholder={strings.feedName}
        aria-label={strings.feedName}
      >
      <button class="column__submit" type="submit">{strings.add}</button>
      {#if errorMessage}
        <p class="column__error">{errorMessage}</p>
      {/if}
    </form>
  {/snippet}

  {#if subscriptions.length}
    <ul class="feeds__subscriptions">
      {#each subscriptions as feed (feed.url)}
        {@const state = $feedStates.get(feed.url)}
        <li class="feeds__subscription">
          {#if renamingUrl === feed.url}
            <input
              class="feeds__subscription-input"
              bind:value={renameValue}
              placeholder={feed.url}
              aria-label={strings.renameFeed}
              use:inlineRename={{
                onSave: value => commitRename(feed.url, value),
                onCancel: () => cancelRename(feed.url)
              }}
            >
          {:else}
            <button
              class="feeds__subscription-name"
              type="button"
              title={`${feed.url} - ${strings.renameFeedHint}`}
              use:editGesture={{ onEdit: () => startRename(feed), clickToEdit: true }}
            >
              {feed.name || feed.url}
            </button>
          {/if}
          {#if state?.loading}
            <span class="feeds__state">{strings.loading}</span>
          {:else if state?.error}
            <span class="feeds__state feeds__state--error" title={state.error}>
              {strings.feedLoadFailed}
            </span>
          {/if}
          <button
            class="column__remove"
            type="button"
            title={strings.remove}
            aria-label={`${strings.remove} ${feed.name || feed.url}`}
            onclick={() => Feeds.remove(feed.url)}
          >×</button>
        </li>
      {/each}
    </ul>

    {#if visibleEntries.length}
      <ul class="feeds__entries">
        {#each visibleEntries as entry (entry.feedUrl + '\u0000' + (entry.url || entry.title))}
          <li class="feeds__entry">
            {#if entry.url}
              <a
                class="feeds__entry-title"
                href={entry.url}
                title={entry.title}
              >{entry.title}</a>
            {:else}
              <span class="feeds__entry-title" title={entry.title}>
                {entry.title}
              </span>
            {/if}

            {#if $config.feedShowSummary && entry.summary}
              <p class="feeds__entry-summary">{entry.summary}</p>
            {/if}

            <p class="feeds__entry-meta">
              <span class="feeds__entry-feed" title={entry.feedName}>
                {entry.feedName}
              </span>
              {#if entry.published}
                <time datetime={new Date(entry.published).toISOString()}>
                  {formatDate(entry.published)}
                </time>
              {/if}
            </p>
          </li>
        {/each}
      </ul>
    {:else if !subscriptions.some(feed => $feedStates.get(feed.url)?.loading)}
      <Empty message={strings.noEntriesFound} />
    {/if}
  {:else}
    <Empty message={strings.noFeedsFound} />
  {/if}
</Column>

<style lang="scss">
  @use 'scss/mixins' as *;
  @use 'scss/variables' as *;

  .feeds {
    &__subscriptions {
      display: flex;
      flex-wrap: wrap;
      flex-shrink: 0;
      gap: $gap-0;
      padding: $gap-1;
      border-bottom: $border var(--color-surface);
    }

    &__subscription {
      display: flex;
      align-items: center;
      gap: $gap-0;
      max-width: 100%;
      padding-left: $gap-1;
      font-size: .75rem;
      color: var(--color-surface-fg);
      background: var(--color-surface);

      // Match the subscription/name background while the row is hovered or
      // focused; the button's own hover/focus rules still turn it red.
      &:hover > .column__remove:not(:hover):not(:focus),
      &:focus-within > .column__remove:not(:hover):not(:focus) {
        background: inherit;
      }
    }

    &__subscription-name {
      min-width: 0;
      padding: 0;
      overflow: hidden;
      font: inherit;
      color: inherit;
      text-align: left;
      text-overflow: ellipsis;
      white-space: nowrap;
      background: none;
      border: none;
      cursor: pointer;

      &:hover,
      &:focus-visible {
        color: var(--color-accent);
      }

      &:focus-visible {
        outline: $outline var(--color-accent);
      }
    }

    &__subscription-input {
      width: 10rem;
      min-width: 0;
      max-width: 100%;
      padding: 0 $gap-0;
      font: inherit;
      color: var(--color-surface-fg);
      background: var(--color-bg);
      border: none;
      outline: $outline var(--color-accent);
    }

    &__state {
      flex-shrink: 0;
      color: var(--color-fg-inactive);

      &--error {
        color: var(--color-error);
      }
    }

    &__entries {
      flex-shrink: 0;
    }

    &__entry {
      padding: $gap-1;
      border-bottom: $border var(--color-surface);

      &-title {
        font-size: .85rem;
        font-weight: bold;
        @include line-clamp(2);
        overflow: hidden;

        // Only real anchors match `:visited`; the span fallback is unaffected.
        &:visited {
          color: var(--color-visited);
        }
      }

      &-summary {
        margin-top: $gap-0;
        font-size: .75rem;
        color: var(--color-fg-inactive);
        @include line-clamp(3);
        overflow: hidden;
      }

      &-meta {
        display: flex;
        justify-content: space-between;
        gap: $gap-1;
        margin-top: $gap-0;
        font-size: .7rem;
        color: var(--color-fg-inactive);
      }

      &-feed {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
    }
  }
</style>
