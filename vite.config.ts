import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  oxc: {
    target: 'es2023'
  },

  build: {
    target: 'es2023'
  }
})
