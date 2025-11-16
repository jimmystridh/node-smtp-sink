#!/usr/bin/env node
import smtp from 'smtp-protocol';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { simpleParser } from 'mailparser';
import cli from 'cli';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

cli.enable('catchall');

const config = cli.parse({
    smtpPort: ['s', 'SMTP port to listen on', 'number', 1025],
    httpPort: ['h', 'HTTP port to listen on', 'number', 1080],
    whitelist: ['w', 'Only accept e-mails from these adresses. Accepts multiple e-mails comma-separated', 'string'],
    max: ['m', 'Max number of e-mails to keep', 'number', 10],
    tls: ['t', 'Enable TLS/STARTTLS support', 'boolean', false],
    cert: ['', 'Path to TLS certificate file', 'path', join(__dirname, 'certs', 'cert.pem')],
    key: ['', 'Path to TLS private key file', 'path', join(__dirname, 'certs', 'key.pem')]
});

const whitelist = config.whitelist != null ? config.whitelist.split(',') : [];

const mails = [];
let emailIdCounter = 0;
const serverStartTime = new Date();

// Configure TLS options if enabled
let serverOptions = {};
if (config.tls) {
    try {
        serverOptions = {
            key: readFileSync(config.key),
            cert: readFileSync(config.cert)
        };
        cli.info('TLS support enabled');
    } catch (error) {
        cli.error(`Failed to load TLS certificates: ${error.message}`);
        cli.info('Continuing without TLS support');
    }
}

smtp.createServer(serverOptions, (req) => {
    req.on('from', (from, ack) => {
        if (whitelist.length === 0 || whitelist.indexOf(from) !== -1) {
            ack.accept();
        } else {
            ack.reject();
        }
    });

    req.on('message', (stream, ack) => {
        let message = '';

        stream.on('data', (data) => {
            message += data;
        });

        stream.on('end', async () => {
            if (message !== '') {
                try {
                    // Parse the email using mailparser
                    const parsed = await simpleParser(message);

                    const mail = {
                        id: emailIdCounter++,
                        from: parsed.from?.text || req.from,
                        to: parsed.to?.text || (Array.isArray(req.to) ? req.to.join(', ') : req.to),
                        cc: parsed.cc?.text || null,
                        bcc: parsed.bcc?.text || null,
                        subject: parsed.subject || '(no subject)',
                        text: parsed.text || '',
                        html: parsed.html || null,
                        date: parsed.date || new Date(),
                        messageId: parsed.messageId || null,
                        inReplyTo: parsed.inReplyTo || null,
                        references: parsed.references || null,
                        headers: Object.fromEntries(parsed.headers),
                        attachments: parsed.attachments?.map(att => ({
                            filename: att.filename,
                            contentType: att.contentType,
                            size: att.size
                        })) || [],
                        raw: message
                    };

                    cli.debug(`Email received: ${mail.from} -> ${mail.to} (${mail.subject})`);

                    mails.push(mail);

                    // Trim list of emails if necessary
                    while (mails.length > config.max) {
                        mails.shift();
                    }
                } catch (error) {
                    cli.error(`Failed to parse email: ${error.message}`);
                }
            }
        });

        ack.accept();
    });
}).listen(config.smtpPort);

// Helper function to add CORS headers
const addCorsHeaders = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

// Helper function to parse URL and query params
const parseUrl = (url) => {
    const urlObj = new URL(url, `http://localhost:${config.httpPort}`);
    return {
        pathname: urlObj.pathname,
        query: Object.fromEntries(urlObj.searchParams)
    };
};

// Helper function to send JSON response
const sendJson = (res, statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
};

http.createServer((req, res) => {
    addCorsHeaders(res);

    // Handle OPTIONS requests for CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const { pathname, query } = parseUrl(req.url);

    // GET /health - Health check endpoint
    if (pathname === '/health' && (req.method === 'GET' || req.method === 'HEAD')) {
        sendJson(res, 200, {
            status: 'ok',
            uptime: Math.floor((Date.now() - serverStartTime.getTime()) / 1000),
            emailCount: mails.length,
            maxEmails: config.max,
            smtp: {
                port: config.smtpPort,
                tls: config.tls
            },
            http: {
                port: config.httpPort
            }
        });
        return;
    }

    // GET /emails - List emails with optional filtering and pagination
    if (pathname === '/emails' && (req.method === 'GET' || req.method === 'HEAD')) {
        let filteredMails = [...mails];

        // Filter by 'from'
        if (query.from) {
            filteredMails = filteredMails.filter(mail =>
                mail.from.toLowerCase().includes(query.from.toLowerCase())
            );
        }

        // Filter by 'to'
        if (query.to) {
            filteredMails = filteredMails.filter(mail =>
                mail.to.toLowerCase().includes(query.to.toLowerCase())
            );
        }

        // Filter by 'subject'
        if (query.subject) {
            filteredMails = filteredMails.filter(mail =>
                mail.subject.toLowerCase().includes(query.subject.toLowerCase())
            );
        }

        // Pagination
        const limit = parseInt(query.limit) || filteredMails.length;
        const offset = parseInt(query.offset) || 0;
        const paginatedMails = filteredMails.slice(offset, offset + limit);

        sendJson(res, 200, {
            total: filteredMails.length,
            limit: limit,
            offset: offset,
            emails: paginatedMails
        });
        return;
    }

    // GET /emails/:id - Get specific email by ID
    if (pathname.match(/^\/emails\/\d+$/) && (req.method === 'GET' || req.method === 'HEAD')) {
        const id = parseInt(pathname.split('/')[2]);
        const mail = mails.find(m => m.id === id);

        if (mail) {
            sendJson(res, 200, mail);
        } else {
            sendJson(res, 404, { error: 'Email not found' });
        }
        return;
    }

    // DELETE /emails/:id - Delete specific email by ID
    if (pathname.match(/^\/emails\/\d+$/) && req.method === 'DELETE') {
        const id = parseInt(pathname.split('/')[2]);
        const index = mails.findIndex(m => m.id === id);

        if (index !== -1) {
            const deleted = mails.splice(index, 1)[0];
            sendJson(res, 200, { message: 'Email deleted', email: deleted });
        } else {
            sendJson(res, 404, { error: 'Email not found' });
        }
        return;
    }

    // DELETE /emails - Clear all emails
    if (pathname === '/emails' && req.method === 'DELETE') {
        const count = mails.length;
        mails.length = 0;
        sendJson(res, 200, { message: 'All emails deleted', count: count });
        return;
    }

    // 404 - Not found
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
}).listen(config.httpPort);

cli.info(`SMTP server listening on port ${config.smtpPort}${config.tls ? ' (TLS enabled)' : ''}`);
cli.info(`HTTP server listening on port ${config.httpPort}, e-mails are available on /emails.`);
