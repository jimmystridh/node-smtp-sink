**smtp-sink is a simple testing smtp server that exposes the received mail on an http endpoint**

Useful for integration testing of e-mail sending or debugging.

Received emails are available via HTTP API at http://localhost:1080/emails by default, with rich parsed data:
```json
{
  "total": 2,
  "limit": 2,
  "offset": 0,
  "emails": [
    {
      "id": 0,
      "from": "joe@example.com",
      "to": "bob@example.com",
      "cc": null,
      "subject": "Hello",
      "text": "Hi Bob!",
      "html": "<p>Hi Bob!</p>",
      "date": "2025-11-16T10:30:00.000Z",
      "attachments": [],
      "headers": {...}
    }
  ]
}
```

##Install
```bash
  npm install -g smtp-sink
```

##Usage
```
Usage:
  smtp-sink [OPTIONS] [ARGS]

Options:
  -s, --smtpPort [NUMBER]SMTP port to listen on (Default is 1025)
  -h, --httpPort [NUMBER]HTTP port to listen on (Default is 1080)
  -w, --whitelist STRING Only accept e-mails from these adresses. Accepts
                         multiple e-mails comma-separated
  -m, --max [NUMBER]     Max number of e-mails to keep (Default is 10)
  -t, --tls              Enable TLS/STARTTLS support
      --cert PATH        Path to TLS certificate file (Default: certs/cert.pem)
      --key PATH         Path to TLS private key file (Default: certs/key.pem)
  -c, --catch            Catch unanticipated errors
```

### TLS Support

smtp-sink supports optional TLS/STARTTLS encryption for more realistic testing scenarios:

```bash
# Start with TLS enabled (uses default certificates)
smtp-sink --tls

# Start with custom certificates
smtp-sink --tls --cert /path/to/cert.pem --key /path/to/key.pem
```

A self-signed certificate is included for testing purposes in the `certs/` directory. For production testing, you can provide your own certificates.

## HTTP API

smtp-sink provides a RESTful HTTP API for accessing and managing emails:

### Endpoints

**GET /health** - Health check endpoint
```bash
curl http://localhost:1080/health
```
Returns server status, uptime, and configuration.

**GET /emails** - List all emails (with filtering and pagination)
```bash
# Get all emails
curl http://localhost:1080/emails

# Filter by sender
curl http://localhost:1080/emails?from=sender@example.com

# Filter by recipient
curl http://localhost:1080/emails?to=recipient@example.com

# Filter by subject
curl http://localhost:1080/emails?subject=test

# Pagination
curl http://localhost:1080/emails?limit=10&offset=0

# Combine filters
curl "http://localhost:1080/emails?from=test&limit=5"
```

**GET /emails/:id** - Get specific email by ID
```bash
curl http://localhost:1080/emails/0
```

**DELETE /emails/:id** - Delete specific email
```bash
curl -X DELETE http://localhost:1080/emails/0
```

**DELETE /emails** - Clear all emails
```bash
curl -X DELETE http://localhost:1080/emails
```

### CORS Support

All endpoints include CORS headers (`Access-Control-Allow-Origin: *`), making it easy to use from browser-based testing tools.

### Email Fields

Each email includes these parsed fields:
- `id` - Unique identifier
- `from` - Sender address
- `to` - Recipient address(es)
- `cc` - CC recipients (if any)
- `bcc` - BCC recipients (if any)
- `subject` - Email subject
- `text` - Plain text content
- `html` - HTML content (if any)
- `date` - Email date
- `messageId` - Message ID header
- `headers` - All email headers
- `attachments` - Array of attachment metadata (filename, contentType, size)
- `raw` - Raw email message

## Development

### Requirements

- Node.js >= 18.0.0

### Running Tests

The project includes a comprehensive test suite that validates RFC 5321 SMTP compliance:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:smtp        # SMTP protocol compliance tests
npm run test:http        # HTTP API tests
npm run test:integration # Integration tests
npm run test:tls         # TLS/STARTTLS tests
npm run test:phase1      # Phase 1 enhancements tests

# Run with coverage report
npm run test:coverage

# Run in watch mode for development
npm run test:watch
```

### Test Coverage

The test suite includes:

**SMTP Protocol Compliance (RFC 5321)**
- Basic SMTP connection handling
- EHLO/HELO command support
- MAIL FROM command validation
- RCPT TO command with support for 100+ recipients
- DATA command with multiline and large messages
- Email headers (including CC/BCC)
- MIME and content types (text, HTML, multipart)
- Sequential and concurrent connections
- Edge cases and error handling

**HTTP API**
- GET /emails endpoint with pagination
- GET /emails/:id for specific emails
- DELETE operations (single or all)
- Filtering by from, to, and subject
- CORS support
- Health check endpoint
- 404 handling for unknown routes

**Integration Tests**
- End-to-end email flow (SMTP → HTTP)
- Max email limit enforcement
- Whitelist functionality
- Server stability under load
- Concurrent operations

**TLS/STARTTLS Tests**
- TLS server configuration
- STARTTLS command support
- Encrypted email transmission
- Self-signed certificate handling
- TLS and plain connection compatibility
- Security features (large messages, multiple recipients over TLS)
- Concurrent TLS connections

**Phase 1 Enhancements Tests**
- Email parsing with mailparser (structured data extraction)
- Enhanced HTTP API (filtering, pagination, GET by ID, DELETE)
- CORS support validation
- Health check endpoint

All tests run in isolated environments with different port configurations to avoid conflicts.

## LICENSE

(MIT license)

Copyright (c) 2013 Jimmy Stridh <jimmy@stridh.nu>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
