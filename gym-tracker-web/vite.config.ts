import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

const versionPath = path.resolve(__dirname, '..', 'VERSION')
const appVersion = fs.existsSync(versionPath)
  ? fs.readFileSync(versionPath, 'utf8').trim()
  : '0.0.0'

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
})
