import type { Component } from 'svelte';
import strings from './share/strings.ts'
import Empty from './lib/Empty.svelte'
import Home from './lib/Home.svelte'
import Settings from './lib/Settings.svelte'

export const routes: Routes =  {
  home: {
    name: '',
    path: strings.paths.home,
    view: Home,
    args: {}
  },
  settings: {
    name: strings.settings,
    path: strings.paths.settings,
    view: Settings,
    args: { tabIndex: 0 }
  },
  channels: {
    name: strings.channels,
    path: strings.paths.channels,
    view: Settings,
    args: { tabIndex: 1 }
  },
  bookmarks: {
    name: strings.bookmarks,
    path: strings.paths.bookmarks,
    view: Settings,
    args: { tabIndex: 2 }
  },
  notFound: {
    name: strings.notFound,
    path: strings.paths.notFound,
    view: Empty,
    args: { message: strings.pageNotFound }
  }
}

export interface Route {
  name: string;
  path: string;
  view: Component;
  args: any;
}

export interface Routes {
  [key: string]: Route
}
