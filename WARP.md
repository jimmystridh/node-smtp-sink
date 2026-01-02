# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project: node-smtp-sink

Overview
- A minimal Node.js CLI (TypeScript) that starts an SMTP server to receive emails and exposes them via an HTTP endpoint for inspection. Intended for local testing/integration scenarios.

Commands
- Install dependencies (local dev):
```bash path=null start=null
npm install
```
- Dev (no build, TypeScript via tsx):
```bash path=null start=null
npm run dev -- --smtpPort 1025 --httpPort 1080 --max 10 --whitelist bob@example.com,alice@example.com
```
- Build and run:
```bash path=null start=null
npm run build
npm start -- --smtpPort 1025 --httpPort 1080
```
- Docker:
```bash path=null start=null
npm run docker:build
npm run docker:run
```
- Lint and format:
```bash path=null start=null
npm run lint
npm run format
```
- Tests (uses Vitest):
```bash path=null start=null
npm test
npm run test:watch
```
  - Run a specific test file:
```bash path=null start=null
npx vitest run test/basic.test.ts
```
  - Run a single test by name:
```bash path=null start=null
npx vitest run test/basic.test.ts -t "accepts a message"
```
- SMTP TLS options:
```bash path=null start=null
# self-signed (local) - automatically generated if no key/cert provided
npm run dev -- --tls --tlsSelfSigned
# provide key/cert
npm run dev -- --tls --tlsKey ./certs/key.pem --tlsCert ./certs/cert.pem
```
- Global install (published package):
```bash path=null start=null
npm install -g smtp-sink
smtp-sink --smtpPort 1025 --httpPort 1080
```

High-level architecture
- CLI and server split (TypeScript):
  - src/cli.ts: Argument parsing with commander; invokes startSink
  - src/index.ts: Core server that wires SMTP (smtp-server) and HTTP (built-in http)
  - Exports types (MailRecord, SinkOptions, RunningServers) for programmatic use
- SMTP ingestion (smtp-server + mailparser)
  - onMailFrom: optional whitelist check against MAIL FROM
  - onData: uses mailparser.simpleParser to extract subject/text/html/to/from/headers
  - In-memory store is a ring buffer (drops oldest emails when max is reached)
- HTTP exposure (built-in http)
  - GET / serves a minimal HTML UI (public/index.html) to inspect emails with auto-refresh
  - GET /emails returns the current in-memory array of parsed emails as JSON
  - DELETE /emails clears the store (returns 204 No Content)
- Data model
  - Each record includes id, to, from, subject, text/html (if present), date, and headers
- Build tooling
  - tsup bundles src/cli.ts and src/index.ts into dist/ with TypeScript definitions
  - Dockerfile uses multi-stage builds for optimized image size

Notes from README
- Default behavior: after starting, browse http://localhost:1080/emails to see collected emails
- To validate end-to-end, send an email to SMTP on port 1025 (e.g., with nc, swaks, or any SMTP client)

Ports and defaults
- SMTP: 1025 (can run in SMTPS mode with --tls; auto-generates self-signed cert if no key/cert provided)
- HTTP: 1080
- Adjustable via CLI flags as above

Release process
- Automated via GitHub Actions on tags starting with v* (e.g., v1.0.0)
- Publishes to both npm registry and GitHub Container Registry (ghcr.io)
- Workflow runs build and tests before publishing
