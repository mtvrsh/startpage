import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { BASE } from './src/constants.ts'

const CSP = `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self' https:; object-src 'none'; base-uri 'none'; form-action 'none'`

// CSP as a meta tag (GitHub Pages cannot set response headers). Only injected
// during builds: `vite dev` needs unsafe-inline styles (Svelte HMR) and
// non-https-scheme assets, which would break under this policy.
function csp() {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`
      )
    }
  }
}

export default defineConfig({
  plugins: [svelte(), csp()],
  base: BASE,
  build: {
    rollupOptions: {
      input: {
        index: './index.html',
        sw: './src/sw.js'
      },
      output: {
        assetFileNames: 'assets/[name].[ext]',
        chunkFileNames: 'assets/[name].js',
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'sw' ? 'sw.js' : 'assets/[name].js'
        }
      }
    }
  },
  test: {
    environment: 'jsdom'
  },
  resolve: process.env.VITEST
    ? {
      conditions: ['browser']
    }
    : undefined,
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler'
      }
    }
  }
});
