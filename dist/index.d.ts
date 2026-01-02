import http from 'http';
import { SMTPServer } from 'smtp-server';
import { WebSocketServer } from 'ws';

type MailRecord = {
    id: string;
    to: string | string[];
    from: string;
    subject?: string;
    text?: string;
    html?: string;
    date: string;
    headers: Record<string, string>;
};
type SinkOptions = {
    smtpPort?: number;
    httpPort?: number;
    whitelist?: string[];
    max?: number;
    tls?: boolean;
    tlsKeyPath?: string;
    tlsCertPath?: string;
    tlsSelfSigned?: boolean;
};
type RunningServers = {
    smtp: SMTPServer;
    http: http.Server;
    wss: WebSocketServer;
    ports: {
        smtp: number;
        http: number;
    };
    stop: () => Promise<void>;
};
declare function startSink(opts?: SinkOptions): Promise<RunningServers>;

export { type MailRecord, type RunningServers, type SinkOptions, startSink };
