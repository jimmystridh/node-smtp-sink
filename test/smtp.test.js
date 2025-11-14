import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import nodemailer from 'nodemailer';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

describe('SMTP Protocol Compliance (RFC 5321)', () => {
  let serverProcess;
  const SMTP_PORT = 2025;
  const HTTP_PORT = 2080;

  beforeAll(async () => {
    // Start the SMTP server
    serverProcess = spawn('node', ['index.js', '--smtpPort', SMTP_PORT.toString(), '--httpPort', HTTP_PORT.toString()], {
      cwd: process.cwd(),
      stdio: 'pipe'
    });

    // Wait for server to start
    await setTimeout(1000);
  });

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill();
      await setTimeout(500);
    }
  });

  describe('Basic SMTP Connection', () => {
    test('should accept SMTP connections', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true,
        tls: {
          rejectUnauthorized: false
        }
      });

      const verified = await transporter.verify();
      expect(verified).toBe(true);

      transporter.close();
    });

    test('should handle EHLO command', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      // Verify connection which uses EHLO
      const verified = await transporter.verify();
      expect(verified).toBe(true);

      transporter.close();
    });
  });

  describe('MAIL FROM Command', () => {
    test('should accept valid MAIL FROM command', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test MAIL FROM',
        text: 'This tests the MAIL FROM command'
      });

      expect(info.accepted).toContain('recipient@example.com');

      transporter.close();
    });

    test('should accept multiple different sender addresses', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const senders = [
        'alice@example.com',
        'bob@example.org',
        'charlie@test.net'
      ];

      for (const sender of senders) {
        const info = await transporter.sendMail({
          from: sender,
          to: 'recipient@example.com',
          subject: `Test from ${sender}`,
          text: 'Testing sender'
        });

        expect(info.accepted.length).toBeGreaterThan(0);
      }

      transporter.close();
    });
  });

  describe('RCPT TO Command', () => {
    test('should accept valid RCPT TO command', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test RCPT TO',
        text: 'This tests the RCPT TO command'
      });

      expect(info.accepted).toContain('recipient@example.com');

      transporter.close();
    });

    test('should accept multiple recipients', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const recipients = [
        'user1@example.com',
        'user2@example.com',
        'user3@example.com'
      ];

      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: recipients.join(','),
        subject: 'Test Multiple Recipients',
        text: 'Testing multiple recipients'
      });

      expect(info.accepted.length).toBe(recipients.length);
      recipients.forEach(recipient => {
        expect(info.accepted).toContain(recipient);
      });

      transporter.close();
    });

    test('should handle at least 100 recipients (RFC 5321 requirement)', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      // Generate 100 recipients
      const recipients = Array.from({ length: 100 }, (_, i) => `user${i}@example.com`);

      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: recipients.join(','),
        subject: 'Test 100 Recipients',
        text: 'Testing RFC 5321 minimum recipient requirement'
      });

      expect(info.accepted.length).toBe(100);

      transporter.close();
    });
  });

  describe('DATA Command', () => {
    test('should accept and store message data', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const messageText = 'This is a test message body.';
      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test DATA Command',
        text: messageText
      });

      expect(info.accepted).toContain('recipient@example.com');

      // Verify message was stored (will check in HTTP tests)
      await setTimeout(500);

      transporter.close();
    });

    test('should handle multiline messages', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const messageText = `Line 1
Line 2
Line 3
Line 4`;

      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Multiline Message',
        text: messageText
      });

      expect(info.accepted).toContain('recipient@example.com');

      transporter.close();
    });

    test('should handle messages with special characters', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const messageText = 'Special chars: @#$%^&*()_+-=[]{}|;:,.<>?/~`';

      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Special Characters',
        text: messageText
      });

      expect(info.accepted).toContain('recipient@example.com');

      transporter.close();
    });

    test('should handle large messages', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      // Create a large message (10KB)
      const messageText = 'A'.repeat(10 * 1024);

      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Large Message',
        text: messageText
      });

      expect(info.accepted).toContain('recipient@example.com');

      transporter.close();
    });
  });

  describe('Email Headers', () => {
    test('should handle standard email headers', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Email Headers',
        text: 'Testing headers',
        headers: {
          'X-Custom-Header': 'CustomValue',
          'Reply-To': 'replyto@example.com'
        }
      });

      expect(info.accepted).toContain('recipient@example.com');

      transporter.close();
    });

    test('should handle CC and BCC recipients', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        cc: 'cc@example.com',
        bcc: 'bcc@example.com',
        subject: 'Test CC/BCC',
        text: 'Testing CC and BCC'
      });

      expect(info.accepted).toContain('recipient@example.com');
      expect(info.accepted).toContain('cc@example.com');
      expect(info.accepted).toContain('bcc@example.com');

      transporter.close();
    });
  });

  describe('MIME and Content Types', () => {
    test('should handle HTML emails', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test HTML Email',
        html: '<h1>Hello</h1><p>This is HTML content</p>'
      });

      expect(info.accepted).toContain('recipient@example.com');

      transporter.close();
    });

    test('should handle multipart emails (text and HTML)', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Multipart Email',
        text: 'Plain text version',
        html: '<p>HTML version</p>'
      });

      expect(info.accepted).toContain('recipient@example.com');

      transporter.close();
    });
  });

  describe('Sequential Transactions', () => {
    test('should handle multiple sequential emails', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true,
        pool: false
      });

      for (let i = 0; i < 5; i++) {
        const info = await transporter.sendMail({
          from: `sender${i}@example.com`,
          to: `recipient${i}@example.com`,
          subject: `Sequential Test ${i}`,
          text: `Message number ${i}`
        });

        expect(info.accepted.length).toBeGreaterThan(0);
      }

      transporter.close();
    });

    test('should handle concurrent connections', async () => {
      const sendEmail = (id) => {
        const transporter = nodemailer.createTransport({
          host: 'localhost',
          port: SMTP_PORT,
          secure: false,
          ignoreTLS: true
        });

        return transporter.sendMail({
          from: `sender${id}@example.com`,
          to: `recipient${id}@example.com`,
          subject: `Concurrent Test ${id}`,
          text: `Concurrent message ${id}`
        }).finally(() => transporter.close());
      };

      const promises = Array.from({ length: 10 }, (_, i) => sendEmail(i));
      const results = await Promise.all(promises);

      expect(results.length).toBe(10);
      results.forEach(info => {
        expect(info.accepted.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty message body', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Empty Body Test',
        text: ''
      });

      expect(info.accepted).toContain('recipient@example.com');

      transporter.close();
    });

    test('should handle emails with only whitespace', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const info = await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Whitespace Test',
        text: '   \n\n\t\t   '
      });

      expect(info.accepted).toContain('recipient@example.com');

      transporter.close();
    });
  });
});
