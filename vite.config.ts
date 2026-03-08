import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Dev proxy plugin: Mimics the Vercel serverless /api/proxy function
    // by extracting `path` from query params and forwarding to Discogs API.
    {
      name: 'discogs-dev-proxy',
      configureServer(server) {
        server.middlewares.use('/api/proxy', async (req, res) => {
          try {
            const url = new URL(req.url || '/', `http://${req.headers.host}`);
            const discogsPath = url.searchParams.get('path');
            if (!discogsPath) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Path is required' }));
              return;
            }

            // Build Discogs URL with all query params except 'path'
            const discogsUrl = new URL(`https://api.discogs.com${discogsPath}`);
            url.searchParams.forEach((value, key) => {
              if (key !== 'path') {
                discogsUrl.searchParams.append(key, value);
              }
            });

            // Add token from env if available
            const token = process.env.VITE_DISCOGS_TOKEN;
            if (token) {
              discogsUrl.searchParams.append('token', token);
            }

            const response = await fetch(discogsUrl.toString(), {
              headers: {
                'User-Agent': 'OldieButGoldie/1.0',
                'Accept': 'application/json',
              },
            });

            const data = await response.text();
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.statusCode = response.status;
            res.end(data);
          } catch (error) {
            console.error('Dev proxy error:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Dev proxy failed' }));
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'framer-motion', 'lucide-react'],
        },
      },
    },
  },
})
