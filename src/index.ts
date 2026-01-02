import http from 'http'
import { SMTPServer, SMTPServerSession, SMTPServerAddress } from 'smtp-server'
import { simpleParser, ParsedMail } from 'mailparser'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { generate as generateSelfSigned } from 'selfsigned'
import { WebSocketServer, WebSocket } from 'ws'

export type MailRecord = {
  id: string
  to: string | string[]
  from: string
  subject?: string
  text?: string
  html?: string
  date: string
  headers: Record<string, string>
}

export type SinkOptions = {
  smtpPort?: number
  httpPort?: number
  whitelist?: string[]
  max?: number
  tls?: boolean
  tlsKeyPath?: string
  tlsCertPath?: string
  tlsSelfSigned?: boolean
}

export type RunningServers = {
  smtp: SMTPServer
  http: http.Server
  wss: WebSocketServer
  ports: { smtp: number; http: number }
  stop: () => Promise<void>
}

function createRingBuffer<T extends { id: string }>(max: number, onChange?: () => void) {
  let arr: T[] = []
  return {
    push(item: T) {
      arr.push(item)
      while (arr.length > max) arr.splice(0, 1)
      onChange?.()
    },
    toArray() {
      return [...arr]
    },
    clear() {
      arr = []
      onChange?.()
    },
    remove(id: string) {
      const idx = arr.findIndex((item) => item.id === id)
      if (idx !== -1) {
        arr.splice(idx, 1)
        onChange?.()
        return true
      }
      return false
    }
  }
}

export async function startSink(opts: SinkOptions = {}): Promise<RunningServers> {
  const smtpPort = opts.smtpPort ?? 1025
  const httpPort = opts.httpPort ?? 1080
  const whitelist = (opts.whitelist ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean)
  const max = opts.max ?? 10

  // WebSocket clients
  const wsClients = new Set<WebSocket>()

  function broadcast(event: string, data?: unknown) {
    const msg = JSON.stringify({ event, data })
    for (const client of wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg)
      }
    }
  }

  const store = createRingBuffer<MailRecord>(max, () => {
    broadcast('emails', store.toArray())
  })

  // Load UI (if available) at startup
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  let indexHtml: string | null = null
  try {
    const p = path.join(__dirname, '../public/index.html')
    indexHtml = await fs.readFile(p, 'utf8')
  } catch {}

  // Prepare TLS options if requested
  let secure = false
  let key: Buffer | undefined
  let cert: Buffer | undefined
  if (opts.tls) {
    secure = true
    if (opts.tlsKeyPath && opts.tlsCertPath) {
      key = await fs.readFile(opts.tlsKeyPath)
      cert = await fs.readFile(opts.tlsCertPath)
    } else if (opts.tlsSelfSigned) {
      const pems = generateSelfSigned(undefined, { days: 365 })
      key = Buffer.from(pems.private)
      cert = Buffer.from(pems.cert)
    } else {
      // If TLS requested but no material provided, fall back to self-signed
      const pems = generateSelfSigned(undefined, { days: 365 })
      key = Buffer.from(pems.private)
      cert = Buffer.from(pems.cert)
    }
  }

  const smtpServer = new SMTPServer({
    disabledCommands: ['AUTH'],
    logger: false,
    secure,
    key,
    cert,
    onMailFrom(address: SMTPServerAddress, session: SMTPServerSession, callback: (err?: Error | null) => void) {
      if (whitelist.length === 0) return callback()
      const from = (address.address || '').toLowerCase()
      if (from && whitelist.includes(from)) return callback()
      const err = new Error('Sender not allowed') as any
      err.responseCode = 550
      return callback(err)
    },
    async onData(stream: NodeJS.ReadableStream, session: SMTPServerSession, callback: (err?: Error | null) => void) {
      try {
        const parsed: ParsedMail = await simpleParser(stream as any)
        const toList = ((): string[] => {
          const p: any = parsed as any
          if (p.to && Array.isArray(p.to.value)) {
            return p.to.value.map((v: any) => v?.address ?? '').filter(Boolean)
          }
          const rcpts: any[] = (session.envelope.rcptTo || []) as any[]
          return rcpts.map((r: any) => (r && r.address) || '').filter(Boolean)
        })()
        const fromAddr = (() => {
          const p: any = parsed as any
          if (p.from && typeof p.from.text === 'string') return p.from.text
          const mf: any = session.envelope.mailFrom
          return (mf && mf.address) || 'unknown'
        })()
        const headers = Object.fromEntries(
          Array.from(((parsed as any).headers as Map<string, any>) || new Map()).map(([k, v]) => [k, String(v)])
        )
        const rec: MailRecord = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          to: toList,
          from: fromAddr,
          subject: parsed.subject || undefined,
          text: parsed.text || undefined,
          html: typeof parsed.html === 'string' ? parsed.html : undefined,
          date: (parsed.date || new Date()).toISOString(),
          headers
        }
        store.push(rec)
        callback()
      } catch (err) {
        callback(err as Error)
      }
    }
  })

  await new Promise<void>((resolve, reject) => {
    smtpServer.once('error', reject)
    smtpServer.listen(smtpPort, () => resolve())
  })

  const httpServer = http.createServer((req, res) => {
    if (!req.url) {
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end('Bad Request')
      return
    }
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      if (indexHtml) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(indexHtml)
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('UI not found')
      }
      return
    }
    if (req.method === 'GET' && req.url === '/emails') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(store.toArray()))
      return
    }
    if (req.method === 'DELETE' && req.url === '/emails') {
      store.clear()
      res.writeHead(204)
      res.end()
      return
    }
    // DELETE /emails/:id - delete single email
    const deleteMatch = req.method === 'DELETE' && req.url?.match(/^\/emails\/([^/]+)$/)
    if (deleteMatch) {
      const id = decodeURIComponent(deleteMatch[1])
      const removed = store.remove(id)
      if (removed) {
        res.writeHead(204)
        res.end()
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Email not found')
      }
      return
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  })

  await new Promise<void>((resolve) => {
    httpServer.listen(httpPort, () => resolve())
  })

  // WebSocket server attached to HTTP server
  const wss = new WebSocketServer({ server: httpServer })
  wss.on('connection', (ws) => {
    wsClients.add(ws)
    // Send current emails on connect
    ws.send(JSON.stringify({ event: 'emails', data: store.toArray() }))
    ws.on('close', () => wsClients.delete(ws))
    ws.on('error', () => wsClients.delete(ws))
  })

  const resolved = {
    smtp: smtpServer,
    http: httpServer,
    wss,
    ports: {
      smtp: (smtpServer.server.address() as any)?.port ?? smtpPort,
      http: (httpServer.address() as any)?.port ?? httpPort
    },
    async stop() {
      wss.close()
      for (const client of wsClients) client.terminate()
      await Promise.all([
        new Promise<void>((resolve) => httpServer.close(() => resolve())),
        new Promise<void>((resolve) => smtpServer.close(() => resolve()))
      ])
    }
  }

  // eslint-disable-next-line no-console
  console.info(`SMTP server listening on port ${resolved.ports.smtp}`)
  // eslint-disable-next-line no-console
  console.info(`HTTP server listening on port ${resolved.ports.http}, emails at /emails`)

  return resolved
}
