import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    base: './',
    server: {
      port: 3000,
      strictPort: true
    },
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@renderer': resolve('src/renderer/src'),
        'next/link': resolve('src/renderer/src/compat/NextLink.tsx')
      }
    },
    plugins: [react()]
  }
})
