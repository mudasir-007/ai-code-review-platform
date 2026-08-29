import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-server proxy so the frontend can call /api/review without CORS
// friction while the Express backend runs on :5050.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true,
      },
    },
  },
});
