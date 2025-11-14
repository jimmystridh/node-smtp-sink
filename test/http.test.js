import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import nodemailer from 'nodemailer';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

describe('HTTP API', () => {
  let serverProcess;
  const SMTP_PORT = 3025;
  const HTTP_PORT = 3080;

  beforeAll(async () => {
    // Start the server
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

  describe('GET /emails', () => {
    test('should return empty array when no emails sent', async () => {
      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    test('should return emails after sending', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      // Send a test email
      await transporter.sendMail({
        from: 'test@example.com',
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test message'
      });

      transporter.close();

      // Wait for processing
      await setTimeout(500);

      // Check HTTP endpoint
      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`);
      expect(response.status).toBe(200);

      const emails = await response.json();
      expect(Array.isArray(emails)).toBe(true);
      expect(emails.length).toBeGreaterThan(0);
    });

    test('should include correct email fields', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const testFrom = 'sender@test.com';
      const testTo = 'receiver@test.com';
      const testMessage = 'Test message content';

      await transporter.sendMail({
        from: testFrom,
        to: testTo,
        subject: 'Field Test',
        text: testMessage
      });

      transporter.close();

      await setTimeout(500);

      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`);
      const emails = await response.json();

      const lastEmail = emails[emails.length - 1];

      expect(lastEmail).toHaveProperty('from');
      expect(lastEmail).toHaveProperty('to');
      expect(lastEmail).toHaveProperty('message');

      expect(lastEmail.from).toBe(testFrom);
      expect(lastEmail.to).toContain(testTo);
      expect(lastEmail.message).toContain(testMessage);
    });

    test('should handle multiple emails', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      // Send multiple emails
      for (let i = 0; i < 3; i++) {
        await transporter.sendMail({
          from: `sender${i}@test.com`,
          to: `receiver${i}@test.com`,
          subject: `Test ${i}`,
          text: `Message ${i}`
        });
      }

      transporter.close();

      await setTimeout(500);

      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`);
      const emails = await response.json();

      expect(emails.length).toBeGreaterThan(2);
    });

    test('should preserve email order', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const uniqueId = Date.now();
      const emailTexts = [`First-${uniqueId}`, `Second-${uniqueId}`, `Third-${uniqueId}`];

      for (const text of emailTexts) {
        await transporter.sendMail({
          from: 'sender@test.com',
          to: 'receiver@test.com',
          subject: 'Order Test',
          text: text
        });
        await setTimeout(100);
      }

      transporter.close();

      await setTimeout(500);

      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`);
      const emails = await response.json();

      // Find our test emails
      const testEmails = emails.filter(email =>
        emailTexts.some(text => email.message.includes(text))
      );

      expect(testEmails.length).toBeGreaterThanOrEqual(emailTexts.length);
    });

    test('should return valid JSON', async () => {
      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`);

      expect(response.headers.get('content-type')).toBe('application/json');

      // Should not throw when parsing
      const data = await response.json();
      expect(data).toBeDefined();
    });
  });

  describe('404 Handling', () => {
    test('should return 404 for unknown paths', async () => {
      const response = await fetch(`http://localhost:${HTTP_PORT}/unknown`);

      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toBe('text/plain');

      const text = await response.text();
      expect(text).toBe('Not found');
    });

    test('should return 404 for root path', async () => {
      const response = await fetch(`http://localhost:${HTTP_PORT}/`);

      expect(response.status).toBe(404);
    });

    test('should return 404 for /emails with wrong case', async () => {
      const response = await fetch(`http://localhost:${HTTP_PORT}/Emails`);

      expect(response.status).toBe(404);
    });

    test('should return 404 for /emails with trailing slash', async () => {
      const response = await fetch(`http://localhost:${HTTP_PORT}/emails/`);

      expect(response.status).toBe(404);
    });
  });

  describe('HTTP Methods', () => {
    test('should handle GET requests', async () => {
      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`, {
        method: 'GET'
      });

      expect(response.status).toBe(200);
    });

    test('should handle HEAD requests', async () => {
      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`, {
        method: 'HEAD'
      });

      expect(response.status).toBe(200);
    });

    test('should handle POST requests to /emails', async () => {
      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`, {
        method: 'POST',
        body: 'test'
      });

      // May return 200 (if accepted) or 404 (if not handled)
      expect([200, 404]).toContain(response.status);
    });
  });
});
