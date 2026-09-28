import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
	plugins: [react()],
	server: {allowedHosts: ['.ngrok-free.dev'], // разрешает все ngrok-домены
		port: 5173,
		host: true,
		strictPort: true,
		proxy: {
			'/api': {
				target: 'http://localhost:4000',
				changeOrigin: true,
			},
		},
	},
})
