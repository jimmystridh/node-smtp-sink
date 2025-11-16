import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import nodemailer from 'nodemailer';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

describe('Integration Tests', () => {
  let serverProcess;
  const SMTP_PORT = 4025;
  const HTTP_PORT = 4080;

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

  describe('End-to-End Email Flow', () => {
    test('should send email via SMTP and retrieve via HTTP', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const testEmail = {
        from: 'integration@test.com',
        to: 'recipient@test.com',
        subject: 'Integration Test',
        text: 'This is an integration test email'
      };

      // Send email
      const info = await transporter.sendMail(testEmail);
      expect(info.accepted).toContain(testEmail.to);

      transporter.close();

      // Wait for processing
      await setTimeout(500);

      // Retrieve via HTTP
      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.emails.length).toBeGreaterThan(0);

      // Find our email
      const foundEmail = data.emails.find(e =>
        e.from.includes(testEmail.from) &&
        e.to.includes(testEmail.to) &&
        e.text && e.text.includes(testEmail.text)
      );

      expect(foundEmail).toBeDefined();
      expect(foundEmail.from).toContain(testEmail.from);
      expect(foundEmail.to).toContain(testEmail.to);
      expect(foundEmail.text).toContain(testEmail.text);
    });

    test('should handle multiple emails in sequence', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const emailCount = 5;
      const uniqueMarker = `seq-${Date.now()}`;

      // Send multiple emails
      for (let i = 0; i < emailCount; i++) {
        await transporter.sendMail({
          from: `sender${i}@test.com`,
          to: `recipient${i}@test.com`,
          subject: `Sequential ${i}`,
          text: `${uniqueMarker}-${i}`
        });
      }

      transporter.close();

      await setTimeout(1000);

      // Retrieve all emails
      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`);
      const data = await response.json();

      // Count our emails
      const ourEmails = data.emails.filter(e => e.text && e.text.includes(uniqueMarker));
      expect(ourEmails.length).toBe(emailCount);
    });

    test('should handle concurrent email sending', async () => {
      const uniqueMarker = `concurrent-${Date.now()}`;
      const concurrentCount = 10;

      const sendEmail = async (id) => {
        const transporter = nodemailer.createTransport({
          host: 'localhost',
          port: SMTP_PORT,
          secure: false,
          ignoreTLS: true
        });

        const result = await transporter.sendMail({
          from: `sender${id}@test.com`,
          to: `recipient${id}@test.com`,
          subject: `Concurrent ${id}`,
          text: `${uniqueMarker}-${id}`
        });

        transporter.close();
        return result;
      };

      // Send emails concurrently
      const promises = Array.from({ length: concurrentCount }, (_, i) => sendEmail(i));
      const results = await Promise.all(promises);

      expect(results.length).toBe(concurrentCount);

      await setTimeout(1000);

      // Verify all emails were stored
      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`);
      const data = await response.json();

      const ourEmails = data.emails.filter(e => e.text && e.text.includes(uniqueMarker));
      expect(ourEmails.length).toBe(concurrentCount);
    });
  });

  describe('Max Emails Limit', () => {
    test('should respect max email limit', async () => {
      // Start a new server with max=5
      if (serverProcess) {
        serverProcess.kill();
        await setTimeout(500);
      }

      const MAX_EMAILS = 5;
      serverProcess = spawn('node', [
        'index.js',
        '--smtpPort', SMTP_PORT.toString(),
        '--httpPort', HTTP_PORT.toString(),
        '--max', MAX_EMAILS.toString()
      ], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      await setTimeout(1000);

      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const uniqueMarker = `max-limit-${Date.now()}`;

      // Send more emails than the limit
      for (let i = 0; i < MAX_EMAILS + 3; i++) {
        await transporter.sendMail({
          from: `sender${i}@test.com`,
          to: `recipient${i}@test.com`,
          subject: `Limit Test ${i}`,
          text: `${uniqueMarker}-${i}`
        });
      }

      transporter.close();

      await setTimeout(1000);

      // Check that only MAX_EMAILS are stored
      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`);
      const data = await response.json();

      const ourEmails = data.emails.filter(e => e.text && e.text.includes(uniqueMarker));
      expect(ourEmails.length).toBeLessThanOrEqual(MAX_EMAILS);
    });
  });

  describe('Whitelist Functionality', () => {
    test('should accept emails from whitelisted senders', async () => {
      // Start a new server with whitelist
      if (serverProcess) {
        serverProcess.kill();
        await setTimeout(500);
      }

      const whitelistedEmail = 'allowed@test.com';
      serverProcess = spawn('node', [
        'index.js',
        '--smtpPort', SMTP_PORT.toString(),
        '--httpPort', HTTP_PORT.toString(),
        '--whitelist', whitelistedEmail
      ], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      await setTimeout(1000);

      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const uniqueMarker = `whitelist-allowed-${Date.now()}`;

      // Send from whitelisted address
      await transporter.sendMail({
        from: whitelistedEmail,
        to: 'recipient@test.com',
        subject: 'Whitelist Test',
        text: uniqueMarker
      });

      transporter.close();

      await setTimeout(500);

      // Verify email was accepted
      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`);
      const data = await response.json();

      const foundEmail = data.emails.find(e => e.text && e.text.includes(uniqueMarker));
      expect(foundEmail).toBeDefined();
    });

    test('should reject emails from non-whitelisted senders', async () => {
      // Server should still be running with whitelist from previous test
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const uniqueMarker = `whitelist-rejected-${Date.now()}`;

      // Try to send from non-whitelisted address
      try {
        await transporter.sendMail({
          from: 'notallowed@test.com',
          to: 'recipient@test.com',
          subject: 'Should Be Rejected',
          text: uniqueMarker
        });

        // If we get here, the email was accepted (which is wrong for a strict whitelist)
        // But the current implementation accepts the message and rejects the sender
        // So we just verify it's not in the stored emails
      } catch (error) {
        // Expected behavior - email was rejected
        expect(error).toBeDefined();
      }

      transporter.close();

      await setTimeout(500);

      // Verify email was NOT stored
      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`);
      const data = await response.json();

      const rejectedEmail = data.emails.find(e => e.text && e.text.includes(uniqueMarker));
      expect(rejectedEmail).toBeUndefined();
    });

    test('should handle multiple whitelisted addresses', async () => {
      // Start server with multiple whitelisted addresses
      if (serverProcess) {
        serverProcess.kill();
        await setTimeout(500);
      }

      const whitelistedEmails = ['user1@test.com', 'user2@test.com', 'user3@test.com'];
      serverProcess = spawn('node', [
        'index.js',
        '--smtpPort', SMTP_PORT.toString(),
        '--httpPort', HTTP_PORT.toString(),
        '--whitelist', whitelistedEmails.join(',')
      ], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      await setTimeout(1000);

      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const uniqueMarker = `multi-whitelist-${Date.now()}`;

      // Send from each whitelisted address
      for (const email of whitelistedEmails) {
        await transporter.sendMail({
          from: email,
          to: 'recipient@test.com',
          subject: 'Multi Whitelist Test',
          text: `${uniqueMarker}-${email}`
        });
      }

      transporter.close();

      await setTimeout(1000);

      // Verify all emails were accepted
      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`);
      const data = await response.json();

      const ourEmails = data.emails.filter(e => e.text && e.text.includes(uniqueMarker));
      expect(ourEmails.length).toBe(whitelistedEmails.length);
    });
  });

  describe('Server Stability', () => {
    test('should remain stable after many requests', async () => {
      // Restart with default settings
      if (serverProcess) {
        serverProcess.kill();
        await setTimeout(500);
      }

      serverProcess = spawn('node', [
        'index.js',
        '--smtpPort', SMTP_PORT.toString(),
        '--httpPort', HTTP_PORT.toString()
      ], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      await setTimeout(1000);

      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      // Send many emails
      for (let i = 0; i < 20; i++) {
        await transporter.sendMail({
          from: `stress${i}@test.com`,
          to: 'recipient@test.com',
          subject: `Stress Test ${i}`,
          text: `Stability test ${i}`
        });
      }

      transporter.close();

      // Make many HTTP requests
      for (let i = 0; i < 20; i++) {
        const response = await fetch(`http://localhost:${HTTP_PORT}/emails`);
        expect(response.status).toBe(200);
      }

      // Server should still be responsive
      const finalResponse = await fetch(`http://localhost:${HTTP_PORT}/emails`);
      expect(finalResponse.status).toBe(200);

      const data = await finalResponse.json();
      expect(Array.isArray(data.emails)).toBe(true);
    });
  });
});
