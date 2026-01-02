import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import http from 'http'
import nodemailer from 'nodemailer'
import { startSink, type RunningServers } from '../src/index.js'

function httpRequest(
  method: string,
  path: string,
  port: number
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method }, (res) => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => resolve({ status: res.statusCode || 0, body: data }))
    })
    req.on('error', reject)
    req.end()
  })
}

function get(path: string, port: number) {
  return httpRequest('GET', path, port)
}

function del(path: string, port: number) {
  return httpRequest('DELETE', path, port)
}

function createTransport(port: number, secure = false) {
  return nodemailer.createTransport({
    host: '127.0.0.1',
    port,
    secure,
    ignoreTLS: !secure,
    requireTLS: false,
    tls: { rejectUnauthorized: false }
  })
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ─────────────────────────────────────────────────────────────────────────────
// Basic functionality tests
// ─────────────────────────────────────────────────────────────────────────────
describe('smtp-sink basic', () => {
  let servers: RunningServers

  beforeAll(async () => {
    servers = await startSink({ smtpPort: 0, httpPort: 0, max: 5 })
  })

  afterAll(async () => {
    await servers.stop()
  })

  afterEach(async () => {
    // Clear emails between tests
    await del('/emails', servers.ports.http)
  })

  it('returns empty array initially', async () => {
    const res = await get('/emails', servers.ports.http)
    expect(res.status).toBe(200)
    const body = JSON.parse(res.body)
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBe(0)
  })

  it('accepts a message and exposes it over HTTP', async () => {
    const transport = createTransport(servers.ports.smtp)

    await transport.sendMail({
      from: 'Alice <alice@example.com>',
      to: 'Bob <bob@example.com>',
      subject: 'Hello',
      text: 'Hi Bob!'
    })

    await wait(300)

    const res = await get('/emails', servers.ports.http)
    const emails = JSON.parse(res.body)
    expect(emails.length).toBe(1)
    expect(emails[0].subject).toBe('Hello')
    expect(emails[0].text).toContain('Hi Bob!')
    expect(emails[0].from).toContain('alice@example.com')
    expect(emails[0].to).toContain('bob@example.com')
    expect(emails[0].id).toBeDefined()
    expect(emails[0].date).toBeDefined()
  })

  it('DELETE /emails clears stored emails', async () => {
    const transport = createTransport(servers.ports.smtp)

    await transport.sendMail({
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'To be deleted',
      text: 'This will be deleted'
    })

    await wait(300)

    let res = await get('/emails', servers.ports.http)
    expect(JSON.parse(res.body).length).toBe(1)

    const delRes = await del('/emails', servers.ports.http)
    expect(delRes.status).toBe(204)

    res = await get('/emails', servers.ports.http)
    expect(JSON.parse(res.body).length).toBe(0)
  })

  it('serves web UI on GET /', async () => {
    const res = await get('/', servers.ports.http)
    expect(res.status).toBe(200)
    expect(res.body.toLowerCase()).toContain('<!doctype html>')
    expect(res.body).toContain('smtp-sink')
  })

  it('serves web UI on GET /index.html', async () => {
    const res = await get('/index.html', servers.ports.http)
    expect(res.status).toBe(200)
    expect(res.body.toLowerCase()).toContain('<!doctype html>')
  })

  it('returns 404 for unknown paths', async () => {
    const res = await get('/unknown', servers.ports.http)
    expect(res.status).toBe(404)
  })

  it('handles multiple recipients', async () => {
    const transport = createTransport(servers.ports.smtp)

    await transport.sendMail({
      from: 'sender@example.com',
      to: ['alice@example.com', 'bob@example.com', 'charlie@example.com'],
      subject: 'Group email',
      text: 'Hello everyone!'
    })

    await wait(300)

    const res = await get('/emails', servers.ports.http)
    const emails = JSON.parse(res.body)
    expect(emails.length).toBe(1)
    expect(emails[0].to).toContain('alice@example.com')
    expect(emails[0].to).toContain('bob@example.com')
    expect(emails[0].to).toContain('charlie@example.com')
  })

  it('handles HTML emails', async () => {
    const transport = createTransport(servers.ports.smtp)

    await transport.sendMail({
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'HTML Email',
      html: '<h1>Hello</h1><p>This is <strong>HTML</strong> content.</p>'
    })

    await wait(300)

    const res = await get('/emails', servers.ports.http)
    const emails = JSON.parse(res.body)
    expect(emails.length).toBe(1)
    expect(emails[0].html).toContain('<h1>Hello</h1>')
    expect(emails[0].html).toContain('<strong>HTML</strong>')
  })

  it('handles emails with both text and HTML', async () => {
    const transport = createTransport(servers.ports.smtp)

    await transport.sendMail({
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Mixed content',
      text: 'Plain text version',
      html: '<p>HTML version</p>'
    })

    await wait(300)

    const res = await get('/emails', servers.ports.http)
    const emails = JSON.parse(res.body)
    expect(emails.length).toBe(1)
    expect(emails[0].text).toContain('Plain text version')
    expect(emails[0].html).toContain('HTML version')
  })

  it('includes headers in email record', async () => {
    const transport = createTransport(servers.ports.smtp)

    await transport.sendMail({
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Headers test',
      text: 'Testing headers'
    })

    await wait(300)

    const res = await get('/emails', servers.ports.http)
    const emails = JSON.parse(res.body)
    expect(emails.length).toBe(1)
    expect(emails[0].headers).toBeDefined()
    expect(typeof emails[0].headers).toBe('object')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Ring buffer / max emails test
// ─────────────────────────────────────────────────────────────────────────────
describe('smtp-sink max emails (ring buffer)', () => {
  let servers: RunningServers

  beforeAll(async () => {
    servers = await startSink({ smtpPort: 0, httpPort: 0, max: 3 })
  })

  afterAll(async () => {
    await servers.stop()
  })

  it('limits stored emails to max and removes oldest first', async () => {
    const transport = createTransport(servers.ports.smtp)

    // Send 5 emails with max=3
    for (let i = 1; i <= 5; i++) {
      await transport.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: `Email ${i}`,
        text: `Content ${i}`
      })
      await wait(100)
    }

    await wait(300)

    const res = await get('/emails', servers.ports.http)
    const emails = JSON.parse(res.body)

    // Should only have 3 emails (the last 3)
    expect(emails.length).toBe(3)
    expect(emails[0].subject).toBe('Email 3')
    expect(emails[1].subject).toBe('Email 4')
    expect(emails[2].subject).toBe('Email 5')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Whitelist tests
// ─────────────────────────────────────────────────────────────────────────────
describe('smtp-sink whitelist', () => {
  let servers: RunningServers

  beforeAll(async () => {
    servers = await startSink({
      smtpPort: 0,
      httpPort: 0,
      max: 10,
      whitelist: ['allowed@example.com', 'ALSO.ALLOWED@EXAMPLE.COM']
    })
  })

  afterAll(async () => {
    await servers.stop()
  })

  afterEach(async () => {
    await del('/emails', servers.ports.http)
  })

  it('accepts emails from whitelisted senders', async () => {
    const transport = createTransport(servers.ports.smtp)

    await transport.sendMail({
      from: 'allowed@example.com',
      to: 'recipient@example.com',
      subject: 'From allowed sender',
      text: 'Should be accepted'
    })

    await wait(300)

    const res = await get('/emails', servers.ports.http)
    const emails = JSON.parse(res.body)
    expect(emails.length).toBe(1)
  })

  it('accepts emails from whitelisted senders (case insensitive)', async () => {
    const transport = createTransport(servers.ports.smtp)

    await transport.sendMail({
      from: 'also.allowed@example.com',
      to: 'recipient@example.com',
      subject: 'Case insensitive test',
      text: 'Should be accepted'
    })

    await wait(300)

    const res = await get('/emails', servers.ports.http)
    const emails = JSON.parse(res.body)
    expect(emails.length).toBe(1)
  })

  it('rejects emails from non-whitelisted senders', async () => {
    const transport = createTransport(servers.ports.smtp)

    try {
      await transport.sendMail({
        from: 'notallowed@example.com',
        to: 'recipient@example.com',
        subject: 'From blocked sender',
        text: 'Should be rejected'
      })
      // Should not reach here
      expect.fail('Expected email to be rejected')
    } catch (err: any) {
      expect(err.responseCode).toBe(550)
    }

    const res = await get('/emails', servers.ports.http)
    const emails = JSON.parse(res.body)
    expect(emails.length).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TLS/SMTPS tests
// ─────────────────────────────────────────────────────────────────────────────
describe('smtp-sink TLS (self-signed)', () => {
  let servers: RunningServers

  beforeAll(async () => {
    servers = await startSink({
      smtpPort: 0,
      httpPort: 0,
      max: 10,
      tls: true,
      tlsSelfSigned: true
    })
  })

  afterAll(async () => {
    await servers.stop()
  })

  it('accepts emails over TLS with self-signed cert', async () => {
    const transport = createTransport(servers.ports.smtp, true)

    await transport.sendMail({
      from: 'secure@example.com',
      to: 'recipient@example.com',
      subject: 'Secure email',
      text: 'Sent over TLS'
    })

    await wait(300)

    const res = await get('/emails', servers.ports.http)
    const emails = JSON.parse(res.body)
    expect(emails.length).toBe(1)
    expect(emails[0].subject).toBe('Secure email')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────────
describe('smtp-sink edge cases', () => {
  let servers: RunningServers

  beforeAll(async () => {
    servers = await startSink({ smtpPort: 0, httpPort: 0, max: 10 })
  })

  afterAll(async () => {
    await servers.stop()
  })

  afterEach(async () => {
    await del('/emails', servers.ports.http)
  })

  it('handles email with no subject', async () => {
    const transport = createTransport(servers.ports.smtp)

    await transport.sendMail({
      from: 'sender@example.com',
      to: 'recipient@example.com',
      text: 'No subject line'
    })

    await wait(300)

    const res = await get('/emails', servers.ports.http)
    const emails = JSON.parse(res.body)
    expect(emails.length).toBe(1)
    expect(emails[0].subject).toBeUndefined()
  })

  it('handles email with empty body', async () => {
    const transport = createTransport(servers.ports.smtp)

    await transport.sendMail({
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Empty body'
    })

    await wait(300)

    const res = await get('/emails', servers.ports.http)
    const emails = JSON.parse(res.body)
    expect(emails.length).toBe(1)
    expect(emails[0].subject).toBe('Empty body')
  })

  it('handles email with unicode content', async () => {
    const transport = createTransport(servers.ports.smtp)

    await transport.sendMail({
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: '你好世界 🌍',
      text: 'Héllo Wörld! 日本語 한국어 🎉'
    })

    await wait(300)

    const res = await get('/emails', servers.ports.http)
    const emails = JSON.parse(res.body)
    expect(emails.length).toBe(1)
    expect(emails[0].subject).toBe('你好世界 🌍')
    expect(emails[0].text).toContain('Héllo Wörld!')
    expect(emails[0].text).toContain('日本語')
    expect(emails[0].text).toContain('🎉')
  })

  it('handles rapid sequential emails', async () => {
    const transport = createTransport(servers.ports.smtp)

    const promises = []
    for (let i = 0; i < 5; i++) {
      promises.push(
        transport.sendMail({
          from: 'sender@example.com',
          to: 'recipient@example.com',
          subject: `Rapid ${i}`,
          text: `Content ${i}`
        })
      )
    }

    await Promise.all(promises)
    await wait(500)

    const res = await get('/emails', servers.ports.http)
    const emails = JSON.parse(res.body)
    expect(emails.length).toBe(5)
  })

  it('generates unique IDs for each email', async () => {
    const transport = createTransport(servers.ports.smtp)

    await transport.sendMail({
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'First',
      text: 'First email'
    })

    await transport.sendMail({
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Second',
      text: 'Second email'
    })

    await wait(300)

    const res = await get('/emails', servers.ports.http)
    const emails = JSON.parse(res.body)
    expect(emails.length).toBe(2)
    expect(emails[0].id).not.toBe(emails[1].id)
  })
})
