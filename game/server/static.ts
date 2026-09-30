import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { GameError } from './errors.js'

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
}

export async function serveGame(request: IncomingMessage, response: ServerResponse, directory: string): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') throw new GameError(405, 'This page accepts GET requests only.')
  let path: string
  try { path = decodeURIComponent((request.url ?? '/').split('?')[0]!) }
  catch { throw new GameError(400, 'This page address is invalid.') }
  if (!path.startsWith('/') || path.includes('\\') || path.includes('\0') || path.split('/').some(part => part.startsWith('.'))) throw new GameError(404, 'This page does not exist.')
  const extension = extname(path)
  // Only known build outputs are files; unknown API paths never enter this function.
  const file = path === '/' || !extension ? '/index.html' : path
  const type = contentTypes[extname(file)]
  if (!type || (file.endsWith('.html') && file !== '/index.html')) throw new GameError(404, 'This page does not exist.')
  const root = await realpath(directory)
  let target: string
  try { target = await realpath(resolve(root, `.${file}`)) }
  catch { throw new GameError(404, 'This page does not exist.') }
  if (!target.startsWith(`${root}${sep}`)) throw new GameError(404, 'This page does not exist.')
  const information = await stat(target)
  if (!information.isFile()) throw new GameError(404, 'This page does not exist.')
  response.writeHead(200, {
    'content-type': type, 'content-length': information.size,
    'cache-control': /^\/assets\/.+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'self'; script-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' wss://agents.assemblyai.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    'permissions-policy': 'microphone=(self), camera=(), geolocation=()',
  })
  if (request.method === 'HEAD') { response.end(); return }
  await new Promise<void>((done, reject) => {
    const stream = createReadStream(target)
    stream.on('error', reject)
    response.once('close', () => { stream.destroy(); done() })
    stream.pipe(response)
  })
}
