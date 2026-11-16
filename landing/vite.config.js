import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// frontend/ (5173番) と同時に動かせるよう、landing は 5174番を使う
export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5174, strictPort: true },
})