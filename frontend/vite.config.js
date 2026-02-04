
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Content Security Policy
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
]

const cspContent = cspDirectives.join('; ')

// Plugin to inject CSP and security headers
function securityHeadersPlugin() {
  return {
    name: 'security-headers',
    transformIndexHtml(html) {
      // Replace CSP placeholder with actual policy
      return html.replace('%VITE_CSP%', cspContent)
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Security headers for dev server
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('X-Frame-Options', 'DENY')
        res.setHeader('X-XSS-Protection', '1; mode=block')
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
        next()
      })
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  base: './',  // Relative base for GitHub Pages subdirectory deployment
  plugins: [
    react(),
    securityHeadersPlugin()
  ],
  server: { 
    port: 5173,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    }
  },
  build: {
    rollupOptions: {
      output: {
        // Hashing for cache busting
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    },
    // Enable source maps for production debugging (can be disabled for stricter security)
    sourcemap: false
  }
})
