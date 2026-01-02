import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import http from 'http'
import nodemailer from 'nodemailer'
import { startSink, type RunningServers } from '../src/index.js'

function get(path: string, port: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => resolve({ status: res.statusCode || 0, body: data }))
    })
    req.on('error', reject)
    req.end()
  })
}


describe('smtp-sink', () => {
  let servers: RunningServers

  beforeAll(async () => {
    servers = await startSink({ smtpPort: 0, httpPort: 0, max: 5 })
  })

  afterAll(async () => {
    await servers.stop()
  })

  it('returns empty array initially', async () => {
    const res = await get('/emails', servers.ports.http)
    expect(res.status).toBe(200)
    const body = JSON.parse(res.body)
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBe(0)
  })

  it('accepts a message and exposes it over HTTP', async () => {
    const smtpPort = servers.ports.smtp
    const transport = nodemailer.createTransport({
      host: '127.0.0.1',
      port: smtpPort,
      secure: false,
      ignoreTLS: true,
      requireTLS: false,
      tls: { rejectUnauthorized: false }
    })

    await transport.sendMail({
      from: 'Alice <alice@example.com>',
      to: 'Bob <bob@example.com>',
      subject: 'Hello',
      text: 'Hi Bob!'
    })

    // wait a moment for processing
    await new Promise((r) => setTimeout(r, 300))

    const res = await get('/emails', servers.ports.http)
    const emails = JSON.parse(res.body)
    expect(emails.length).toBe(1)
    expect(emails[0].subject).toBe('Hello')
  })
})
