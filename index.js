#!/usr/bin/env node
import smtp from 'smtp-protocol';
import http from 'node:http';
import cli from 'cli';

cli.enable('catchall');

const config = cli.parse({
    smtpPort: ['s', 'SMTP port to listen on', 'number', 1025],
    httpPort: ['h', 'HTTP port to listen on', 'number', 1080],
    whitelist: ['w', 'Only accept e-mails from these adresses. Accepts multiple e-mails comma-separated', 'string'],
    max: ['m', 'Max number of e-mails to keep', 'number', 10]
});

const whitelist = config.whitelist != null ? config.whitelist.split(',') : [];

const mails = [];

smtp.createServer((req) => {
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

        stream.on('end', () => {
            if (message !== '') {
                const mail = {
                    to: req.to,
                    from: req.from,
                    message: message
                };

                cli.debug(JSON.stringify(mail));

                mails.push(mail);

                // Trim list of emails if necessary
                while (mails.length > config.max) {
                    mails.shift();
                }
            }
        });

        ack.accept();
    });
}).listen(config.smtpPort);

http.createServer((req, res) => {
    if (req.url === '/emails') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mails));
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
    }
}).listen(config.httpPort);

cli.info(`SMTP server listening on port ${config.smtpPort}`);
cli.info(`HTTP server listening on port ${config.httpPort}, e-mails are available on /emails.`);
