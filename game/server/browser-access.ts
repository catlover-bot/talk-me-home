import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { GameError } from './errors.js'

function cookie(request: IncomingMessage, name: string): string | undefined {
  const matches = (request.headers.cookie ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith(`${name}=`))
  return matches.length === 1 ? matches[0]!.slice(name.length + 1) : undefined
}
function setCookie(response: ServerResponse, name: string, value: string, seconds: number, secure: boolean): void {
  const previous = response.getHeader('set-cookie')
  const cookies = Array.isArray(previous) ? previous.map(String) : previous ? [String(previous)] : []
  response.setHeader('set-cookie', [...cookies, `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${secure ? '; Secure' : ''}`])
}

export class BrowserAccess {
  private readonly signingKey = randomBytes(32)
  private attempts: number[] = []
  constructor(private readonly code: string | undefined, private readonly secure = true, private readonly now = Date.now) {}

  owner(request: IncomingMessage, response?: ServerResponse): string | undefined {
    const owner = cookie(request, 'tmh_browser')
    if (owner && /^[A-Za-z0-9_-]{43}$/.test(owner)) return owner
    if (!response) return undefined
    const created = randomBytes(32).toString('base64url')
    setCookie(response, 'tmh_browser', created, 7200, this.secure)
    return created
  }

  authorized(request: IncomingMessage): boolean {
    const owner = this.owner(request)
    const grant = cookie(request, 'tmh_live')?.split('.')
    if (!owner || grant?.length !== 2 || !/^\d{13}$/.test(grant[0]!) || !/^[a-f0-9]{64}$/.test(grant[1]!)) return false
    const expiresAt = Number(grant[0])
    if (expiresAt <= this.now() || expiresAt > this.now() + 1_800_000) return false
    const expected = createHmac('sha256', this.signingKey).update(`${owner}.${expiresAt}`).digest()
    return timingSafeEqual(expected, Buffer.from(grant[1]!, 'hex'))
  }

  exchange(request: IncomingMessage, response: ServerResponse, input: unknown): void {
    this.attempts = this.attempts.filter(time => time > this.now() - 60_000)
    if (this.attempts.length >= 20) throw new GameError(429, 'Too many access attempts. Wait one minute or choose Practice.')
    this.attempts.push(this.now())
    if (!input || typeof input !== 'object' || Object.keys(input).join(',') !== 'code' || !('code' in input) || typeof input.code !== 'string' || input.code.length > 256) throw new GameError(400, 'Enter the demo access code supplied by the owner.')
    if (!this.code || this.code.length < 16 || !timingSafeEqual(createHash('sha256').update(this.code).digest(), createHash('sha256').update(input.code).digest())) throw new GameError(403, 'That demo access code was not accepted. Check the code or choose Practice.')
    const owner = this.owner(request, response)!
    const expiresAt = this.now() + 1_800_000
    const signature = createHmac('sha256', this.signingKey).update(`${owner}.${expiresAt}`).digest('hex')
    setCookie(response, 'tmh_live', `${expiresAt}.${signature}`, 1800, this.secure)
  }
}
