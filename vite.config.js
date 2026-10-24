import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { BASE } from './src/constants'

export default defineConfig({
  plugins: [svelte()],
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
