**smtp-sink is a simple testing smtp server that exposes the received mail on an http endpoint**

Useful for integration testing of e-mail sending or debugging.

Recieved mails are listed on http://localhost:1080/emails by default, and looks like this:
```json
[
  {
    to: "bob@example.com",
    from: "joe@example.com",
    message: "Hi Bob! "
  },
  {
    to: "joe@example.com",
    from: "bob@example.com",
    message: "Hello Joe! "
  }
]
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
  -c, --catch            Catch unanticipated errors
```

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
- GET /emails endpoint
- JSON response validation
- Email field structure (from, to, message)
- 404 handling for unknown routes
- Multiple HTTP methods support

**Integration Tests**
- End-to-end email flow (SMTP → HTTP)
- Max email limit enforcement
- Whitelist functionality
- Server stability under load
- Concurrent operations

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
