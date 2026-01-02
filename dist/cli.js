#!/usr/bin/env node

// src/cli.ts
import { Command } from "commander";

// src/index.ts
import http from "http";
import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { generate as generateSelfSigned } from "selfsigned";
import { WebSocketServer, WebSocket } from "ws";
function createRingBuffer(max, onChange) {
  let arr = [];
  return {
    push(item) {
      arr.push(item);
      while (arr.length > max) arr.splice(0, 1);
      onChange?.();
    },
    toArray() {
      return [...arr];
    },
    clear() {
      arr = [];
      onChange?.();
    },
    remove(id) {
      const idx = arr.findIndex((item) => item.id === id);
      if (idx !== -1) {
        arr.splice(idx, 1);
        onChange?.();
        return true;
      }
      return false;
    }
  };
}
async function startSink(opts = {}) {
  const smtpPort = opts.smtpPort ?? 1025;
  const httpPort = opts.httpPort ?? 1080;
  const whitelist = (opts.whitelist ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean);
  const max = opts.max ?? 10;
  const wsClients = /* @__PURE__ */ new Set();
  function broadcast(event, data) {
    const msg = JSON.stringify({ event, data });
    for (const client of wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }
  const store = createRingBuffer(max, () => {
    broadcast("emails", store.toArray());
  });
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  let indexHtml = null;
  try {
    const p = path.join(__dirname, "../public/index.html");
    indexHtml = await fs.readFile(p, "utf8");
  } catch {
  }
  let secure = false;
  let key;
  let cert;
  if (opts.tls) {
    secure = true;
    if (opts.tlsKeyPath && opts.tlsCertPath) {
      key = await fs.readFile(opts.tlsKeyPath);
      cert = await fs.readFile(opts.tlsCertPath);
    } else if (opts.tlsSelfSigned) {
      const pems = generateSelfSigned(void 0, { days: 365 });
      key = Buffer.from(pems.private);
      cert = Buffer.from(pems.cert);
    } else {
      const pems = generateSelfSigned(void 0, { days: 365 });
      key = Buffer.from(pems.private);
      cert = Buffer.from(pems.cert);
    }
  }
  const smtpServer = new SMTPServer({
    disabledCommands: ["AUTH"],
    logger: false,
    secure,
    key,
    cert,
    onMailFrom(address, session, callback) {
      if (whitelist.length === 0) return callback();
      const from = (address.address || "").toLowerCase();
      if (from && whitelist.includes(from)) return callback();
      const err = new Error("Sender not allowed");
      err.responseCode = 550;
      return callback(err);
    },
    async onData(stream, session, callback) {
      try {
        const parsed = await simpleParser(stream);
        const toList = (() => {
          const p = parsed;
          if (p.to && Array.isArray(p.to.value)) {
            return p.to.value.map((v) => v?.address ?? "").filter(Boolean);
          }
          const rcpts = session.envelope.rcptTo || [];
          return rcpts.map((r) => r && r.address || "").filter(Boolean);
        })();
        const fromAddr = (() => {
          const p = parsed;
          if (p.from && typeof p.from.text === "string") return p.from.text;
          const mf = session.envelope.mailFrom;
          return mf && mf.address || "unknown";
        })();
        const headers = Object.fromEntries(
          Array.from(parsed.headers || /* @__PURE__ */ new Map()).map(([k, v]) => [k, String(v)])
        );
        const rec = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          to: toList,
          from: fromAddr,
          subject: parsed.subject || void 0,
          text: parsed.text || void 0,
          html: typeof parsed.html === "string" ? parsed.html : void 0,
          date: (parsed.date || /* @__PURE__ */ new Date()).toISOString(),
          headers
        };
        store.push(rec);
        callback();
      } catch (err) {
        callback(err);
      }
    }
  });
  await new Promise((resolve, reject) => {
    smtpServer.once("error", reject);
    smtpServer.listen(smtpPort, () => resolve());
  });
  const httpServer = http.createServer((req, res) => {
    if (!req.url) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Bad Request");
      return;
    }
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      if (indexHtml) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(indexHtml);
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("UI not found");
      }
      return;
    }
    if (req.method === "GET" && req.url === "/emails") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(store.toArray()));
      return;
    }
    if (req.method === "DELETE" && req.url === "/emails") {
      store.clear();
      res.writeHead(204);
      res.end();
      return;
    }
    const deleteMatch = req.method === "DELETE" && req.url?.match(/^\/emails\/([^/]+)$/);
    if (deleteMatch) {
      const id = decodeURIComponent(deleteMatch[1]);
      const removed = store.remove(id);
      if (removed) {
        res.writeHead(204);
        res.end();
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Email not found");
      }
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  });
  await new Promise((resolve) => {
    httpServer.listen(httpPort, () => resolve());
  });
  const wss = new WebSocketServer({ server: httpServer });
  wss.on("connection", (ws) => {
    wsClients.add(ws);
    ws.send(JSON.stringify({ event: "emails", data: store.toArray() }));
    ws.on("close", () => wsClients.delete(ws));
    ws.on("error", () => wsClients.delete(ws));
  });
  const resolved = {
    smtp: smtpServer,
    http: httpServer,
    wss,
    ports: {
      smtp: smtpServer.server.address()?.port ?? smtpPort,
      http: httpServer.address()?.port ?? httpPort
    },
    async stop() {
      wss.close();
      for (const client of wsClients) client.terminate();
      await Promise.all([
        new Promise((resolve) => httpServer.close(() => resolve())),
        new Promise((resolve) => smtpServer.close(() => resolve()))
      ]);
    }
  };
  console.info(`SMTP server listening on port ${resolved.ports.smtp}`);
  console.info(`HTTP server listening on port ${resolved.ports.http}, emails at /emails`);
  return resolved;
}

// src/cli.ts
var program = new Command().name("smtp-sink").description("Receive emails via SMTP and expose them via HTTP for testing").option("-s, --smtpPort <number>", "SMTP port to listen on", (v) => parseInt(v, 10), 1025).option("-h, --httpPort <number>", "HTTP port to listen on", (v) => parseInt(v, 10), 1080).option("-w, --whitelist <list>", "Comma-separated list of allowed sender addresses").option("-m, --max <number>", "Max number of emails to keep in memory", (v) => parseInt(v, 10), 10).option("--tls", "Enable TLS for SMTP (STARTTLS is not used; SMTPS only)", false).option("--tlsKey <path>", "Path to PEM private key for SMTPS").option("--tlsCert <path>", "Path to PEM certificate for SMTPS").option("--tlsSelfSigned", "Generate a self-signed cert when TLS is enabled and no key/cert provided", false).showHelpAfterError(true);
program.action(async (opts) => {
  const whitelist = (opts.whitelist ? String(opts.whitelist).split(",") : []).map((s) => s.trim());
  await startSink({
    smtpPort: opts.smtpPort,
    httpPort: opts.httpPort,
    whitelist,
    max: opts.max,
    tls: !!opts.tls,
    tlsKeyPath: opts.tlsKey,
    tlsCertPath: opts.tlsCert,
    tlsSelfSigned: !!opts.tlsSelfSigned
  });
});
program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
//# sourceMappingURL=cli.js.map