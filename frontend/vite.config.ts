import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:8000';
  const devServerPort = Number(env.VITE_PORT) || 3000;

  const createProxyConfig = () => ({
    target: backendUrl,
    changeOrigin: true,
  });

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '0.0.0.0',
      port: devServerPort,
      proxy: {
        '/api': createProxyConfig(),
        '/producto': createProxyConfig(),
        '/auth_app': createProxyConfig(),
        '/auth': createProxyConfig(),
      },
    },
    test: {
      globals: true,
      environment: 'node',
    },
  };
});
