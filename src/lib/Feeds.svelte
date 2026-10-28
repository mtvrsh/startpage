<script lang="ts">
  import strings from '../share/strings'
  import { config } from '../share/config'
  import { Feeds, entries, feedStates, feeds } from '../share/feeds'
  import { app } from './state/app.svelte'
  import Column from './Column.svelte'
  import Empty from './Empty.svelte'
  import FilterDropdown from './FilterDropdown.svelte'

  let adding = $state(false)
  let url = $state('')
  let name = $state('')
  let errorUrl = $state(false)
  let errorMessage = $state('')

  Feeds.refetch()

  const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

  let items = $derived(
    [...$feeds.values()]
      .sort((a, b) =>
        (a.name || a.url).localeCompare(b.name || b.url)
      )
      .map(feed => {
        const state = $feedStates.get(feed.url)

        return {
          id: feed.url,
          label: feed.name || feed.url,
          loading: !!state?.loading,
          error: state?.error,
          placeholder: feed.url
        }
      })
  )

  let visibleEntries = $derived.by(() => {
    const seen = new Set<string>()

    return [...$entries]
      .sort((a, b) =>
        b.published - a.published || a.title.localeCompare(b.title)
      )
      .filter(entry =>
        app.feedFilter === strings.allKebabCase || entry.feedUrl === app.feedFilter
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

  let selectedError = $derived(
    app.feedFilter === strings.allKebabCase
      ? undefined
      : $feedStates.get(app.feedFilter)?.error
  )

  let formatDate = (timestamp: number) =>
    timestamp ? dateFormat.format(timestamp) : ''
</script>

<Column title={strings.feeds} bind:adding addTitle={strings.addFeed}>
  {#snippet actions()}
    <FilterDropdown
      {items}
      selectedId={app.feedFilter}
      allId={strings.allKebabCase}
      onselect={id => app.feedFilter = id}
      onremove={url => {
        Feeds.remove(url)

        // The removed feed can be the active filter; its id would dangle
        // (the toggler would fall back to the All label while the body stays
        // filtered by the removed feed).
        if (app.feedFilter === url)
          app.feedFilter = strings.allKebabCase
      }}
      onrename={(url, value) => Feeds.rename(url, value)}
      renameLabel={strings.renameFeed}
      renameHint={strings.renameFeedHint}
    />
  {/snippet}
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

  {#if items.length}
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
    {:else if selectedError}
      <Empty message={`${strings.feedLoadFailed}: ${selectedError}`} error />
    {:else if !items.some(item => $feedStates.get(item.id)?.loading)}
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
