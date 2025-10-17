import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,                       // listen on 0.0.0.0
    port: 5173,                       // your dev port
    allowedHosts: ['relaygielda.com', 'www.relaygielda.com'],
  },
})
