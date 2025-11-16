import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import nodemailer from 'nodemailer';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('TLS/STARTTLS Support', () => {
  let tlsServerProcess;
  let plainServerProcess;
  const TLS_SMTP_PORT = 5025;
  const TLS_HTTP_PORT = 5080;
  const PLAIN_SMTP_PORT = 6025;
  const PLAIN_HTTP_PORT = 6080;

  beforeAll(async () => {
    // Start TLS-enabled server
    tlsServerProcess = spawn('node', [
      'index.js',
      '--smtpPort', TLS_SMTP_PORT.toString(),
      '--httpPort', TLS_HTTP_PORT.toString(),
      '--tls'
    ], {
      cwd: join(__dirname, '..'),
      stdio: 'pipe'
    });

    // Start plain server for comparison
    plainServerProcess = spawn('node', [
      'index.js',
      '--smtpPort', PLAIN_SMTP_PORT.toString(),
      '--httpPort', PLAIN_HTTP_PORT.toString()
    ], {
      cwd: join(__dirname, '..'),
      stdio: 'pipe'
    });

    // Wait for servers to start
    await setTimeout(1500);
  });

  afterAll(async () => {
    if (tlsServerProcess) {
      tlsServerProcess.kill();
    }
    if (plainServerProcess) {
      plainServerProcess.kill();
    }
    await setTimeout(500);
  });

  describe('TLS Configuration', () => {
    test('should start server with TLS enabled', async () => {
      // Server should be running - test by making a connection
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: TLS_SMTP_PORT,
        secure: false,
        requireTLS: true,
        tls: {
          rejectUnauthorized: false // Self-signed cert
        }
      });

      const verified = await transporter.verify();
      expect(verified).toBe(true);

      transporter.close();
    });

    test('should start server without TLS when disabled', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: PLAIN_SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const verified = await transporter.verify();
      expect(verified).toBe(true);

      transporter.close();
    });
  });

  describe('STARTTLS Support', () => {
    test('should support STARTTLS command', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: TLS_SMTP_PORT,
        secure: false,
        requireTLS: true,
        tls: {
          rejectUnauthorized: false
        }
      });

      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'STARTTLS Test',
        text: 'Testing STARTTLS support'
      });

      expect(info.accepted).toContain('recipient@example.com');

      transporter.close();
    });

    test('should send email over TLS connection', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: TLS_SMTP_PORT,
        secure: false,
        requireTLS: true,
        tls: {
          rejectUnauthorized: false
        }
      });

      const uniqueMarker = `tls-test-${Date.now()}`;

      const info = await transporter.sendMail({
        from: 'tls-sender@example.com',
        to: 'tls-recipient@example.com',
        subject: 'TLS Email Test',
        text: uniqueMarker
      });

      expect(info.accepted).toContain('tls-recipient@example.com');

      transporter.close();

      // Verify email was stored
      await setTimeout(500);

      const response = await fetch(`http://localhost:${TLS_HTTP_PORT}/emails`);
      const data = await response.json();

      const foundEmail = data.emails.find(e => e.text && e.text.includes(uniqueMarker));
      expect(foundEmail).toBeDefined();
      expect(foundEmail.from).toContain('tls-sender@example.com');
    });

    test('should handle multiple TLS emails', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: TLS_SMTP_PORT,
        secure: false,
        requireTLS: true,
        tls: {
          rejectUnauthorized: false
        }
      });

      const uniqueMarker = `tls-multi-${Date.now()}`;

      for (let i = 0; i < 3; i++) {
        await transporter.sendMail({
          from: `sender${i}@example.com`,
          to: `recipient${i}@example.com`,
          subject: `TLS Test ${i}`,
          text: `${uniqueMarker}-${i}`
        });
      }

      transporter.close();

      await setTimeout(500);

      const response = await fetch(`http://localhost:${TLS_HTTP_PORT}/emails`);
      const data = await response.json();

      const ourEmails = data.emails.filter(e => e.text && e.text.includes(uniqueMarker));
      expect(ourEmails.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('TLS and Plain Connections', () => {
    test('TLS server should accept TLS connections', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: TLS_SMTP_PORT,
        secure: false,
        requireTLS: true,
        tls: {
          rejectUnauthorized: false
        }
      });

      const info = await transporter.sendMail({
        from: 'sender@test.com',
        to: 'recipient@test.com',
        subject: 'TLS Connection Test',
        text: 'Testing TLS connection'
      });

      expect(info.accepted.length).toBeGreaterThan(0);

      transporter.close();
    });

    test('TLS server should also accept plain connections', async () => {
      // TLS server with STARTTLS should also accept plain connections
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: TLS_SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const info = await transporter.sendMail({
        from: 'plain@test.com',
        to: 'recipient@test.com',
        subject: 'Plain Connection to TLS Server',
        text: 'Testing plain connection to TLS-enabled server'
      });

      expect(info.accepted.length).toBeGreaterThan(0);

      transporter.close();
    });

    test('plain server should accept plain connections', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: PLAIN_SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const info = await transporter.sendMail({
        from: 'sender@test.com',
        to: 'recipient@test.com',
        subject: 'Plain Server Test',
        text: 'Testing plain server'
      });

      expect(info.accepted.length).toBeGreaterThan(0);

      transporter.close();
    });
  });

  describe('TLS Security', () => {
    test('should use self-signed certificate', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: TLS_SMTP_PORT,
        secure: false,
        requireTLS: true,
        tls: {
          rejectUnauthorized: false // Required for self-signed cert
        }
      });

      // Should connect successfully with self-signed cert when rejectUnauthorized is false
      const verified = await transporter.verify();
      expect(verified).toBe(true);

      transporter.close();
    });

    test('should send large message over TLS', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: TLS_SMTP_PORT,
        secure: false,
        requireTLS: true,
        tls: {
          rejectUnauthorized: false
        }
      });

      // Create a 50KB message
      const largeMessage = 'A'.repeat(50 * 1024);

      const info = await transporter.sendMail({
        from: 'sender@test.com',
        to: 'recipient@test.com',
        subject: 'Large TLS Message',
        text: largeMessage
      });

      expect(info.accepted.length).toBeGreaterThan(0);

      transporter.close();
    });
  });

  describe('TLS with Features', () => {
    test('should support multiple recipients over TLS', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: TLS_SMTP_PORT,
        secure: false,
        requireTLS: true,
        tls: {
          rejectUnauthorized: false
        }
      });

      const recipients = ['user1@test.com', 'user2@test.com', 'user3@test.com'];

      const info = await transporter.sendMail({
        from: 'sender@test.com',
        to: recipients.join(','),
        subject: 'TLS Multiple Recipients',
        text: 'Testing multiple recipients over TLS'
      });

      expect(info.accepted.length).toBe(recipients.length);

      transporter.close();
    });

    test('should handle HTML emails over TLS', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: TLS_SMTP_PORT,
        secure: false,
        requireTLS: true,
        tls: {
          rejectUnauthorized: false
        }
      });

      const info = await transporter.sendMail({
        from: 'sender@test.com',
        to: 'recipient@test.com',
        subject: 'TLS HTML Email',
        html: '<h1>Hello</h1><p>This is an HTML email over TLS</p>'
      });

      expect(info.accepted.length).toBeGreaterThan(0);

      transporter.close();
    });

    test('should handle concurrent TLS connections', async () => {
      const sendEmail = async (id) => {
        const transporter = nodemailer.createTransport({
          host: 'localhost',
          port: TLS_SMTP_PORT,
          secure: false,
          requireTLS: true,
          tls: {
            rejectUnauthorized: false
          }
        });

        const result = await transporter.sendMail({
          from: `sender${id}@test.com`,
          to: `recipient${id}@test.com`,
          subject: `TLS Concurrent ${id}`,
          text: `Concurrent TLS message ${id}`
        });

        transporter.close();
        return result;
      };

      const promises = Array.from({ length: 5 }, (_, i) => sendEmail(i));
      const results = await Promise.all(promises);

      expect(results.length).toBe(5);
      results.forEach(info => {
        expect(info.accepted.length).toBeGreaterThan(0);
      });
    });
  });
});
