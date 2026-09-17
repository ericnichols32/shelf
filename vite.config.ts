import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the site from a folder named after the repository.
  base: '/shelf/',
  plugins: [react()],
})
