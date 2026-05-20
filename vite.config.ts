import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Connect } from 'vite'
import https from 'https'
import http from 'http'

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyGp8v0O4yW3BdLBCSDVBE9g1JPBmiFPDNsnNczypOQ0PCJJsqdsI1JCtSUkrztY-VZ/exec'

// Follow GAS redirect chain server-side, returning final JSON
function gasRequest(method: string, body: string | null): Promise<string> {
  return new Promise((resolve, reject) => {
    function get(url: string) {
      const lib = url.startsWith('https') ? https : http
      const parsed = new URL(url)
      const opts = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }
      lib.request(opts, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location)
          return
        }
        let data = ''
        res.on('data', (c: Buffer) => { data += c })
        res.on('end', () => resolve(data))
      }).on('error', reject).end()
    }

    // Step 1: POST to GAS exec
    const parsed = new URL(GAS_URL)
    const postOpts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(body ?? ''),
        'User-Agent': 'Mozilla/5.0',
      },
    }
    const req = https.request(postOpts, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect as GET (simulates browser 302 handling)
        get(res.headers.location)
        return
      }
      let data = ''
      res.on('data', (c: Buffer) => { data += c })
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

const gasMiddleware: Connect.NextHandleFunction = (req, res, next) => {
  if (req.url !== '/api/gas') return next()

  if (req.method === 'GET') {
    gasRequest('GET', null)
      .then((data) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(data)
      })
      .catch((err) => { res.statusCode = 502; res.end(JSON.stringify({ error: String(err) })) })
    return
  }

  if (req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      gasRequest('POST', body)
        .then((data) => {
          res.setHeader('Content-Type', 'application/json')
          res.end(data)
        })
        .catch((err) => { res.statusCode = 502; res.end(JSON.stringify({ error: String(err) })) })
    })
    return
  }

  next()
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'gas-proxy',
      configureServer(server) {
        server.middlewares.use(gasMiddleware)
      },
    },
  ],
  server: {
    port: 3000,
    headers: {
      'Content-Security-Policy':
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:; " +
        "worker-src 'self' blob:; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob: https:; " +
        "connect-src 'self' https://script.google.com https:; " +
        "font-src 'self' data:;",
    },
  },
})
