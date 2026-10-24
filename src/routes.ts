import type { Component } from 'svelte';
import strings from './share/strings'
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
    args: {}
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
  view: Component<any>;
  args: any;
}

export interface Routes {
  [key: string]: Route
}
