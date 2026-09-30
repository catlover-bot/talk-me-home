import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { GameError } from './errors.js'
import type { ReleaseCapability } from './release-admission.js'

interface ReleaseCodes { qa?: string; qaText?: string; allowed: (capability: ReleaseCapability, owner: string) => void }

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
  constructor(private readonly code: string | undefined, private readonly secure = true, private readonly now = Date.now, private readonly release?: ReleaseCodes) {
    if (release) {
      const configured = [code, release.qa, release.qaText].filter((value): value is string => Boolean(value))
      if (configured.some(value => value.length < 32 || value.length > 256) || new Set(configured).size !== configured.length) throw new Error('Protected release codes must be distinct and at least 32 characters')
    }
  }

  owner(request: IncomingMessage, response?: ServerResponse): string | undefined {
    const owner = cookie(request, 'tmh_browser')
    if (owner && /^[A-Za-z0-9_-]{43}$/.test(owner)) return owner
    if (!response) return undefined
    const created = randomBytes(32).toString('base64url')
    setCookie(response, 'tmh_browser', created, 7200, this.secure)
    return created
  }

  authorized(request: IncomingMessage): boolean {
    if (this.release) return Boolean(this.capability(request))
    const owner = this.owner(request)
    const grant = cookie(request, 'tmh_live')?.split('.')
    if (!owner || grant?.length !== 2 || !/^\d{13}$/.test(grant[0]!) || !/^[a-f0-9]{64}$/.test(grant[1]!)) return false
    const expiresAt = Number(grant[0])
    if (expiresAt <= this.now() || expiresAt > this.now() + 1_800_000) return false
    const expected = createHmac('sha256', this.signingKey).update(`${owner}.${expiresAt}`).digest()
    return timingSafeEqual(expected, Buffer.from(grant[1]!, 'hex'))
  }

  capability(request: IncomingMessage): ReleaseCapability | undefined {
    if (!this.release) return undefined
    const owner = this.owner(request)
    const parts = cookie(request, 'tmh_live')?.split('.')
    if (!owner || parts?.length !== 4) return undefined
    const [expiration, purpose, mode, signature] = parts
    if (!/^\d{13}$/.test(expiration!) || !['qa', 'reviewer'].includes(purpose!) || !['voice', 'text'].includes(mode!)
      || purpose === 'reviewer' && mode !== 'voice' || !/^[a-f0-9]{64}$/.test(signature!)) return undefined
    const expiresAt = Number(expiration)
    if (expiresAt <= this.now() || expiresAt > this.now() + 1_800_000) return undefined
    const expected = createHmac('sha256', this.signingKey).update(`${owner}.${expiration}.${purpose}.${mode}`).digest()
    if (!timingSafeEqual(expected, Buffer.from(signature!, 'hex'))) return undefined
    return { purpose, mode } as ReleaseCapability
  }

  exchange(request: IncomingMessage, response: ServerResponse, input: unknown): ReleaseCapability | undefined {
    this.attempts = this.attempts.filter(time => time > this.now() - 60_000)
    if (this.attempts.length >= 20) throw new GameError(429, 'Too many access attempts. Wait one minute or choose Practice.')
    this.attempts.push(this.now())
    if (!input || typeof input !== 'object' || Object.keys(input).join(',') !== 'code' || !('code' in input) || typeof input.code !== 'string' || input.code.length > 256) throw new GameError(400, 'Enter the demo access code supplied by the owner.')
    const submitted = input.code
    const matches = (candidate: string | undefined) => Boolean(candidate && candidate.length >= (this.release ? 32 : 16) && timingSafeEqual(createHash('sha256').update(candidate).digest(), createHash('sha256').update(submitted).digest()))
    if (this.release) {
      // The submitted code alone classifies the purpose. Headers, body fields and URLs cannot select a pool.
      const qa = matches(this.release.qa), qaText = matches(this.release.qaText), reviewer = matches(this.code)
      const capability: ReleaseCapability | undefined = qa ? { purpose: 'qa', mode: 'voice' } : qaText ? { purpose: 'qa', mode: 'text' } : reviewer ? { purpose: 'reviewer', mode: 'voice' } : undefined
      if (!capability) throw new GameError(403, 'That demo access code was not accepted. Check the code or choose Practice.')
      const owner = this.owner(request, response)!
      this.release.allowed(capability, owner)
      const expiresAt = this.now() + 1_800_000
      const content = `${expiresAt}.${capability.purpose}.${capability.mode}`
      const signature = createHmac('sha256', this.signingKey).update(`${owner}.${content}`).digest('hex')
      setCookie(response, 'tmh_live', `${content}.${signature}`, 1800, this.secure)
      return capability
    }
    if (!matches(this.code)) throw new GameError(403, 'That demo access code was not accepted. Check the code or choose Practice.')
    const owner = this.owner(request, response)!
    const expiresAt = this.now() + 1_800_000
    const signature = createHmac('sha256', this.signingKey).update(`${owner}.${expiresAt}`).digest('hex')
    setCookie(response, 'tmh_live', `${expiresAt}.${signature}`, 1800, this.secure)
  }
}
