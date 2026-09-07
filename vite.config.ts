import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { jimengServerPlugin } from './server/jimeng-plugin'

function removeModuleTypePlugin() {
  return {
    name: 'remove-module-type',
    closeBundle() {
      const htmlPath = path.resolve(__dirname, 'dist/index.html')
      if (fs.existsSync(htmlPath)) {
        let html = fs.readFileSync(htmlPath, 'utf-8')
        html = html.replace(/ type="module"/g, ' defer')
        html = html.replace(/ crossorigin/g, '')
        fs.writeFileSync(htmlPath, html)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    base: mode === 'sites' ? '/' : './',
    publicDir: mode === 'sites' ? false : 'public',
    plugins: [react(), jimengServerPlugin(env), removeModuleTypePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          format: 'iife',
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]',
        },
      },
    },
  }
})
