#!/usr/bin/env node
import { Command } from 'commander'
import { startSink } from './index.js'

const program = new Command()
  .name('smtp-sink')
  .description('Receive emails via SMTP and expose them via HTTP for testing')
  .option('-s, --smtpPort <number>', 'SMTP port to listen on', (v) => parseInt(v, 10), 1025)
  .option('-h, --httpPort <number>', 'HTTP port to listen on', (v) => parseInt(v, 10), 1080)
  .option('-w, --whitelist <list>', 'Comma-separated list of allowed sender addresses')
.option('-m, --max <number>', 'Max number of emails to keep in memory', (v) => parseInt(v, 10), 10)
  .option('--tls', 'Enable TLS for SMTP (STARTTLS is not used; SMTPS only)', false)
  .option('--tlsKey <path>', 'Path to PEM private key for SMTPS')
  .option('--tlsCert <path>', 'Path to PEM certificate for SMTPS')
  .option('--tlsSelfSigned', 'Generate a self-signed cert when TLS is enabled and no key/cert provided', false)
  .showHelpAfterError(true)

program.action(async (opts) => {
  const whitelist = (opts.whitelist ? String(opts.whitelist).split(',') : []).map((s) => s.trim())
  await startSink({
    smtpPort: opts.smtpPort,
    httpPort: opts.httpPort,
    whitelist,
    max: opts.max,
    tls: !!opts.tls,
    tlsKeyPath: opts.tlsKey,
    tlsCertPath: opts.tlsCert,
    tlsSelfSigned: !!opts.tlsSelfSigned
  })
})

program.parseAsync(process.argv).catch((err) => {
  console.error(err)
  process.exit(1)
})
