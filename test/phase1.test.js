import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import nodemailer from 'nodemailer';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

describe('Phase 1 Enhancements', () => {
  let serverProcess;
  const SMTP_PORT = 7025;
  const HTTP_PORT = 7080;

  beforeAll(async () => {
    // Start the server
    serverProcess = spawn('node', ['index.js', '--smtpPort', SMTP_PORT.toString(), '--httpPort', HTTP_PORT.toString()], {
      cwd: process.cwd(),
      stdio: 'pipe'
    });

    // Wait for server to start
    await setTimeout(1500);
  });

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill();
      await setTimeout(500);
    }
  });

  describe('Health Check Endpoint', () => {
    test('should return health status', async () => {
      const response = await fetch(`http://localhost:${HTTP_PORT}/health`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');

      const health = await response.json();

      expect(health).toHaveProperty('status', 'ok');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('emailCount');
      expect(health).toHaveProperty('maxEmails', 10);
      expect(health).toHaveProperty('smtp');
      expect(health).toHaveProperty('http');
      expect(health.smtp.port).toBe(SMTP_PORT);
      expect(health.http.port).toBe(HTTP_PORT);
    });

    test('should include CORS headers', async () => {
      const response = await fetch(`http://localhost:${HTTP_PORT}/health`);

      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toContain('GET');
    });
  });

  describe('Enhanced Email Parsing', () => {
    test('should parse email with subject and extract fields', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const uniqueId = `parsed-${Date.now()}`;

      await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: `Test Subject ${uniqueId}`,
        text: 'Plain text content',
        html: '<p>HTML content</p>'
      });

      transporter.close();
      await setTimeout(500);

      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`);
      const data = await response.json();

      expect(data).toHaveProperty('emails');
      const email = data.emails.find(e => e.subject.includes(uniqueId));

      expect(email).toBeDefined();
      expect(email).toHaveProperty('id');
      expect(email).toHaveProperty('from');
      expect(email).toHaveProperty('to');
      expect(email).toHaveProperty('subject');
      expect(email).toHaveProperty('text');
      expect(email).toHaveProperty('html');
      expect(email).toHaveProperty('date');
      expect(email).toHaveProperty('headers');
      expect(email).toHaveProperty('attachments');
      expect(email.text).toContain('Plain text content');
      expect(email.html).toContain('HTML content');
    });

    test('should parse email with CC and BCC', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const uniqueId = `cc-bcc-${Date.now()}`;

      await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        cc: 'cc@example.com',
        bcc: 'bcc@example.com',
        subject: uniqueId,
        text: 'Test CC/BCC'
      });

      transporter.close();
      await setTimeout(500);

      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`);
      const data = await response.json();
      const email = data.emails.find(e => e.subject.includes(uniqueId));

      expect(email).toBeDefined();
      expect(email.cc).toBeTruthy();
      expect(email.cc).toContain('cc@example.com');
    });
  });

  describe('Enhanced HTTP API - Pagination', () => {
    test('should return paginated results with metadata', async () => {
      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`);
      const data = await response.json();

      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('limit');
      expect(data).toHaveProperty('offset');
      expect(data).toHaveProperty('emails');
      expect(Array.isArray(data.emails)).toBe(true);
    });

    test('should support limit parameter', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const uniqueId = `pagination-${Date.now()}`;

      // Send 5 emails
      for (let i = 0; i < 5; i++) {
        await transporter.sendMail({
          from: 'sender@example.com',
          to: 'recipient@example.com',
          subject: `${uniqueId}-${i}`,
          text: 'Test'
        });
      }

      transporter.close();
      await setTimeout(500);

      const response = await fetch(`http://localhost:${HTTP_PORT}/emails?limit=2`);
      const data = await response.json();

      expect(data.limit).toBe(2);
      expect(data.emails.length).toBeLessThanOrEqual(2);
    });

    test('should support offset parameter', async () => {
      const response = await fetch(`http://localhost:${HTTP_PORT}/emails?offset=1&limit=1`);
      const data = await response.json();

      expect(data.offset).toBe(1);
      expect(data.limit).toBe(1);
    });
  });

  describe('Enhanced HTTP API - Filtering', () => {
    test('should filter emails by from address', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const uniqueEmail = `filter-test-${Date.now()}@example.com`;

      await transporter.sendMail({
        from: uniqueEmail,
        to: 'recipient@example.com',
        subject: 'Filter Test',
        text: 'Test filtering'
      });

      transporter.close();
      await setTimeout(500);

      const response = await fetch(`http://localhost:${HTTP_PORT}/emails?from=${encodeURIComponent(uniqueEmail)}`);
      const data = await response.json();

      expect(data.total).toBeGreaterThan(0);
      data.emails.forEach(email => {
        expect(email.from.toLowerCase()).toContain(uniqueEmail.toLowerCase());
      });
    });

    test('should filter emails by to address', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const uniqueTo = `to-filter-${Date.now()}@example.com`;

      await transporter.sendMail({
        from: 'sender@example.com',
        to: uniqueTo,
        subject: 'To Filter Test',
        text: 'Test'
      });

      transporter.close();
      await setTimeout(500);

      const response = await fetch(`http://localhost:${HTTP_PORT}/emails?to=${encodeURIComponent(uniqueTo)}`);
      const data = await response.json();

      expect(data.total).toBeGreaterThan(0);
      data.emails.forEach(email => {
        expect(email.to.toLowerCase()).toContain(uniqueTo.toLowerCase());
      });
    });

    test('should filter emails by subject', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const uniqueSubject = `subject-filter-${Date.now()}`;

      await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: uniqueSubject,
        text: 'Test'
      });

      transporter.close();
      await setTimeout(500);

      const response = await fetch(`http://localhost:${HTTP_PORT}/emails?subject=${encodeURIComponent(uniqueSubject)}`);
      const data = await response.json();

      expect(data.total).toBeGreaterThan(0);
      data.emails.forEach(email => {
        expect(email.subject.toLowerCase()).toContain(uniqueSubject.toLowerCase());
      });
    });

    test('should support multiple filters', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const uniqueId = `multi-filter-${Date.now()}`;

      await transporter.sendMail({
        from: `${uniqueId}@example.com`,
        to: 'recipient@example.com',
        subject: uniqueId,
        text: 'Test'
      });

      transporter.close();
      await setTimeout(500);

      const response = await fetch(`http://localhost:${HTTP_PORT}/emails?from=${encodeURIComponent(uniqueId)}&subject=${encodeURIComponent(uniqueId)}`);
      const data = await response.json();

      expect(data.total).toBeGreaterThan(0);
      data.emails.forEach(email => {
        expect(email.from.toLowerCase()).toContain(uniqueId.toLowerCase());
        expect(email.subject.toLowerCase()).toContain(uniqueId.toLowerCase());
      });
    });
  });

  describe('Enhanced HTTP API - Get Email by ID', () => {
    test('should get specific email by ID', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const uniqueId = `get-by-id-${Date.now()}`;

      await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: uniqueId,
        text: 'Test get by ID'
      });

      transporter.close();
      await setTimeout(500);

      // Get all emails first
      const listResponse = await fetch(`http://localhost:${HTTP_PORT}/emails`);
      const listData = await listResponse.json();
      const email = listData.emails.find(e => e.subject.includes(uniqueId));

      expect(email).toBeDefined();

      // Get specific email by ID
      const getResponse = await fetch(`http://localhost:${HTTP_PORT}/emails/${email.id}`);
      expect(getResponse.status).toBe(200);

      const specificEmail = await getResponse.json();
      expect(specificEmail.id).toBe(email.id);
      expect(specificEmail.subject).toContain(uniqueId);
    });

    test('should return 404 for non-existent email ID', async () => {
      const response = await fetch(`http://localhost:${HTTP_PORT}/emails/999999`);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });

  describe('Enhanced HTTP API - Delete Operations', () => {
    test('should delete specific email by ID', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      const uniqueId = `delete-test-${Date.now()}`;

      await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: uniqueId,
        text: 'Test delete'
      });

      transporter.close();
      await setTimeout(500);

      // Get the email ID
      const listResponse = await fetch(`http://localhost:${HTTP_PORT}/emails?subject=${encodeURIComponent(uniqueId)}`);
      const listData = await listResponse.json();
      const email = listData.emails[0];

      expect(email).toBeDefined();

      // Delete the email
      const deleteResponse = await fetch(`http://localhost:${HTTP_PORT}/emails/${email.id}`, {
        method: 'DELETE'
      });

      expect(deleteResponse.status).toBe(200);

      const deleteData = await deleteResponse.json();
      expect(deleteData).toHaveProperty('message');
      expect(deleteData.email.id).toBe(email.id);

      // Verify it's deleted
      const verifyResponse = await fetch(`http://localhost:${HTTP_PORT}/emails/${email.id}`);
      expect(verifyResponse.status).toBe(404);
    });

    test('should return 404 when deleting non-existent email', async () => {
      const response = await fetch(`http://localhost:${HTTP_PORT}/emails/999999`, {
        method: 'DELETE'
      });

      expect(response.status).toBe(404);
    });

    test('should clear all emails', async () => {
      const transporter = nodemailer.createTransport({
        host: 'localhost',
        port: SMTP_PORT,
        secure: false,
        ignoreTLS: true
      });

      // Send a test email
      await transporter.sendMail({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test for clear all',
        text: 'Test'
      });

      transporter.close();
      await setTimeout(500);

      // Clear all emails
      const deleteResponse = await fetch(`http://localhost:${HTTP_PORT}/emails`, {
        method: 'DELETE'
      });

      expect(deleteResponse.status).toBe(200);

      const deleteData = await deleteResponse.json();
      expect(deleteData).toHaveProperty('message');
      expect(deleteData).toHaveProperty('count');

      // Verify all emails are cleared
      const listResponse = await fetch(`http://localhost:${HTTP_PORT}/emails`);
      const listData = await listResponse.json();
      expect(listData.total).toBe(0);
    });
  });

  describe('CORS Support', () => {
    test('should handle OPTIONS preflight request', async () => {
      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`, {
        method: 'OPTIONS'
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toContain('GET');
      expect(response.headers.get('access-control-allow-methods')).toContain('DELETE');
    });

    test('should include CORS headers in all responses', async () => {
      const response = await fetch(`http://localhost:${HTTP_PORT}/emails`);

      expect(response.headers.get('access-control-allow-origin')).toBe('*');
    });
  });
});
