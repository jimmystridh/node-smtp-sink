# smtp-sink

A minimal SMTP sink for local testing. It receives emails via SMTP and exposes them via an HTTP endpoint for inspection.

- Default HTTP endpoint: http://localhost:1080/emails
- Default SMTP port: 1025

Example response from GET /emails:
```json
[
  {
    "id": "1712345678901-abc123",
    "to": ["bob@example.com"],
    "from": "alice@example.com",
    "subject": "Hello",
    "text": "Hi Bob!",
    "date": "2025-01-01T12:34:56.000Z",
    "headers": {"subject": "Subject: Hello"}
  }
]
```

## Install (local development)
```bash
npm install
```

## Run
- Dev (no build):
```bash
npm run dev -- --smtpPort 1025 --httpPort 1080 --max 10 --whitelist bob@example.com,alice@example.com
```
- Build and run:
```bash
npm run build
npm start -- --smtpPort 1025 --httpPort 1080
```
- Docker (local):
```bash
npm run docker:build
npm run docker:run
# Or directly
# docker run --rm -p 1025:1025 -p 1080:1080 smtp-sink:dev --smtpPort 1025 --httpPort 1080
```
- Optional global install (publishing flow):
```bash
npm install -g smtp-sink
smtp-sink --smtpPort 1025 --httpPort 1080
```

### CLI Options
- -s, --smtpPort <number>   SMTP port to listen on (default 1025)
- -h, --httpPort <number>   HTTP port to listen on (default 1080)
- -w, --whitelist <list>    Comma-separated allowed sender addresses (MAIL FROM). Empty = allow all
- -m, --max <number>        Max number of emails to retain in memory (default 10)

### UI and HTTP API
- UI: open http://localhost:1080/ to view emails (auto-refresh)
- GET /emails: returns JSON array of recent emails
- DELETE /emails: clears stored emails (204 No Content)

## SMTP TLS (SMTPS)
Enable TLS for SMTP. You can supply your own key/cert or generate self-signed automatically.

- Self-signed for local testing:
```bash
npm run dev -- --tls --tlsSelfSigned
```
- Provide key/cert files:
```bash
npm run dev -- --tls --tlsKey ./certs/key.pem --tlsCert ./certs/cert.pem
```

## Sending a test email
You can use any SMTP client. For example with Python or swaks; or a raw TCP session:
```
$ nc 127.0.0.1 1025
220 localhost ESMTP
HELO localhost
250 Hello localhost
MAIL FROM:<alice@example.com>
250 OK
RCPT TO:<bob@example.com>
250 OK
DATA
354 End data with <CR><LF>.<CR><LF>
Subject: Hello

Hi Bob!
.
250 OK: queued
QUIT
221 Bye
```

## License
MIT
