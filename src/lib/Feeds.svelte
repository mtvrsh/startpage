<script lang="ts">
  import strings from '../share/strings'
  import { config } from '../share/config'
  import { Feeds, entries, feedStates, feeds } from '../share/feeds'
  import Empty from './Empty.svelte'

  let adding = $state(false)
  let url = $state('')
  let name = $state('')
  let errorUrl = $state(false)
  let errorMessage = $state('')

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
</script>

<section class="feeds">
  <header class="feeds__header">
    <h2 class="feeds__title">{strings.feeds}</h2>
    <button
      class="feeds__add-toggle"
      type="button"
      title={strings.addFeed}
      aria-label={strings.addFeed}
      aria-expanded={adding}
      onclick={() => adding = !adding}
    >+</button>
  </header>

  {#if adding}
    <form class="feeds__form" onsubmit={submit}>
      <input
        class="feeds__input"
        class:error={errorUrl}
        bind:value={url}
        placeholder={strings.feedUrl}
        aria-label={strings.feedUrl}
        aria-invalid={errorUrl}
      >
      <input
        class="feeds__input"
        bind:value={name}
        placeholder={strings.feedName}
        aria-label={strings.feedName}
      >
      <button class="feeds__submit" type="submit">{strings.add}</button>
      {#if errorMessage}
        <p class="feeds__error">{errorMessage}</p>
      {/if}
    </form>
  {/if}

  {#if subscriptions.length}
    <ul class="feeds__subscriptions">
      {#each subscriptions as feed (feed.url)}
        {@const state = $feedStates.get(feed.url)}
        <li class="feeds__subscription">
          <span class="feeds__subscription-name" title={feed.url}>
            {feed.name || feed.url}
          </span>
          {#if state?.loading}
            <span class="feeds__state">{strings.loading}</span>
          {:else if state?.error}
            <span class="feeds__state feeds__state--error" title={state.error}>
              {strings.feedLoadFailed}
            </span>
          {/if}
          <button
            class="feeds__remove"
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
      <div class="feeds__empty">
        <Empty message={strings.noEntriesFound} />
      </div>
    {/if}
  {:else}
    <div class="feeds__empty">
      <Empty message={strings.noFeedsFound} />
    </div>
  {/if}
</section>

<style lang="scss">
  @use 'scss/mixins' as *;
  @use 'scss/variables' as *;

  .feeds {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;

    &__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: $gap-1;
      padding: $gap-1;
      border-bottom: $border var(--color-surface);
    }

    &__title {
      font-size: .8rem;
      color: var(--color-accent);
      user-select: none;
    }

    &__add-toggle {
      width: 1.5rem;
      height: 1.5rem;
      padding: 0;
      font-size: 1.1rem;
      line-height: 1;
      color: var(--color-accent);
      background: var(--color-surface);
      border: none;
      cursor: pointer;

      &:hover,
      &:focus {
        color: var(--color-accent-fg);
        background: var(--color-accent);
        outline: none;
      }
    }

    &__form {
      display: grid;
      gap: $gap-0;
      padding: $gap-1;
      border-bottom: $border var(--color-surface);
    }

    &__input {
      width: 100%;
      min-width: 0;
      padding: $gap-1;
      color: var(--color-fg);
      background: var(--color-surface);
      border: none;
      border-bottom: $border transparent;

      &:focus {
        outline: $outline var(--color-accent);
      }

      &.error {
        border-color: var(--color-error);

        &:focus {
          outline-color: var(--color-error);
        }
      }
    }

    &__submit {
      padding: $gap-1;
      font-weight: bold;
      color: var(--color-accent-fg);
      background: var(--color-accent);
      border: none;
      cursor: pointer;

      &:hover,
      &:focus {
        background: var(--color-accent-light);
        outline: none;
      }
    }

    &__error {
      font-size: .75rem;
      color: var(--color-error);
    }

    &__subscriptions {
      display: flex;
      flex-wrap: wrap;
      gap: $gap-0;
      max-height: 7rem;
      padding: $gap-1;
      overflow-y: auto;
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
    }

    &__subscription-name {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    &__state {
      flex-shrink: 0;
      color: var(--color-fg-inactive);

      &--error {
        color: var(--color-error);
      }
    }

    &__remove {
      flex-shrink: 0;
      padding: 0 $gap-1;
      font-size: 1rem;
      line-height: 1.4;
      color: inherit;
      background: inherit;
      border: none;
      cursor: pointer;

      &:hover,
      &:focus {
        color: var(--color-error-fg);
        background: var(--color-error);
        outline: none;
      }
    }

    &__entries {
      flex: 1;
      overflow-y: auto;
    }

    &__entry {
      padding: $gap-1;
      border-bottom: $border var(--color-surface);

      &-title {
        font-size: .85rem;
        font-weight: bold;
        @include line-clamp(2);
      }

      &-summary {
        margin-top: $gap-0;
        font-size: .75rem;
        color: var(--color-fg-inactive);
        @include line-clamp(3);
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

    &__empty {
      flex: 1;
      overflow-y: auto;
    }
  }
</style>
