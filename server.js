// App Vault server — serves the React app and reads/writes apps.md (no database).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOST = '127.0.0.1'; // only reachable from this computer
let PORT = Number(process.env.PORT || 5050);
let DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'apps.md');
const DIST = path.join(__dirname, 'dist');

// Field order in the Markdown file: [key, label]
const APP_FIELDS = [
  ['id', 'ID'],
  ['description', 'Description'],
  ['owner', 'Owner'],
  ['tags', 'Tags'],
];
const INST_FIELDS = [
  ['id', 'ID'],
  ['type', 'Type'],
  ['environment', 'Environment'],
  ['url', 'URL'],
  ['host', 'Host / IP'],
  ['port', 'Port'],
  ['username', 'Username'],
  ['password', 'Password'],
  ['apiKey', 'API Key'],
  ['notes', 'Notes'],
];

const newId = () => crypto.randomBytes(4).toString('hex');
const oneLine = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim();

// Keep each value on one line inside the .md file
function enc(v) {
  return String(v ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n');
}
function dec(v) {
  let out = '';
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '\\' && i + 1 < v.length) {
      const n = v[++i];
      out += n === 'n' ? '\n' : n;
    } else out += v[i];
  }
  return out;
}

function toMarkdown(apps) {
  const lines = [
    '# Application Details',
    '',
    '> Managed by App Vault. This file contains login credentials — keep it private.',
    '',
  ];
  for (const a of apps) {
    lines.push(`## ${oneLine(a.name) || 'Untitled'}`);
    for (const [k, label] of APP_FIELDS) lines.push(`- **${label}:** ${enc(a[k])}`);
    lines.push('');
    for (const i of a.instances || []) {
      lines.push(`### ${oneLine(i.name) || 'Instance'}`);
      for (const [k, label] of INST_FIELDS) lines.push(`- **${label}:** ${enc(i[k])}`);
      if (i.fields?.length) {
        lines.push('- **Fields:**');
        for (const f of i.fields) lines.push(`  - **${f.label}${f.secret ? SECRET_MARK : ''}:** ${enc(f.value)}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

const FIELD_RE = /^- \*\*(.+?):\*\* ?(.*)$/;
// Custom instance fields, nested under "- **Fields:**". Secret ones carry SECRET_MARK after the label.
const SECRET_MARK = ' (secret)';
const CUSTOM_RE = /^ {2}- \*\*(.+?):\*\* ?(.*)$/;
const fieldLabel = (s) => oneLine(s).replace(/\*\*/g, '');
const appMap = Object.fromEntries(APP_FIELDS.map(([k, l]) => [l, k]));
const instMap = Object.fromEntries(INST_FIELDS.map(([k, l]) => [l, k]));

function fromMarkdown(text) {
  const apps = [];
  let app = null;
  let inst = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('### ')) {
      if (!app) continue;
      inst = { name: line.slice(4).trim(), fields: [] };
      app.instances.push(inst);
    } else if (line.startsWith('## ')) {
      app = { name: line.slice(3).trim(), instances: [] };
      apps.push(app);
      inst = null;
    } else if (inst && CUSTOM_RE.test(line)) {
      const [, raw, value] = line.match(CUSTOM_RE);
      const secret = raw.endsWith(SECRET_MARK);
      inst.fields.push({ label: secret ? raw.slice(0, -SECRET_MARK.length) : raw, value: dec(value), secret });
    } else {
      const m = line.match(FIELD_RE);
      if (!m) continue;
      if (inst) {
        const k = instMap[m[1]];
        if (k) inst[k] = dec(m[2]);
      } else if (app) {
        const k = appMap[m[1]];
        if (k) app[k] = dec(m[2]);
      }
    }
  }
  for (const a of apps) {
    a.id ||= newId();
    for (const i of a.instances) i.id ||= newId();
  }
  return apps;
}

function readApps() {
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, toMarkdown([]));
  return fromMarkdown(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeApps(apps) {
  if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, DATA_FILE + '.bak'); // backup of previous version
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, toMarkdown(apps));
  fs.renameSync(tmp, DATA_FILE);
}

function clean(apps) {
  if (!Array.isArray(apps)) throw new Error('Expected a list');
  return apps.map((a) => {
    const app = { name: oneLine(a.name), instances: [] };
    for (const [k] of APP_FIELDS) app[k] = String(a[k] ?? '');
    app.id ||= newId();
    app.instances = (a.instances || []).map((i) => {
      const inst = { name: oneLine(i.name) };
      for (const [k] of INST_FIELDS) inst[k] = String(i[k] ?? '');
      inst.id ||= newId();
      inst.fields = (Array.isArray(i.fields) ? i.fields : [])
        .map((f) => ({ label: fieldLabel(f?.label), value: String(f?.value ?? ''), secret: !!f?.secret }))
        .filter((f) => f.label);
      return inst;
    });
    return app;
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/apps') {
    if (req.method === 'GET') {
      try {
        return send(res, 200, JSON.stringify({ apps: readApps(), file: DATA_FILE }));
      } catch (e) {
        return send(res, 500, JSON.stringify({ error: e.message }));
      }
    }
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > 10_000_000) req.destroy();
      });
      req.on('end', () => {
        try {
          const apps = clean(JSON.parse(body).apps);
          writeApps(apps);
          send(res, 200, JSON.stringify({ ok: true, apps }));
        } catch (e) {
          send(res, 400, JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
    return send(res, 405, JSON.stringify({ error: 'Method not allowed' }));
  }

  // Static files from the built React app
  let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) return send(res, 403, 'Forbidden', 'text/plain');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) {
    return send(res, 500, 'App not built yet. Run: npm start', 'text/plain');
  }
  send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
});

// Start the server (optionally with a different port or data file).
export function startServer({ port = PORT, dataFile = DATA_FILE } = {}) {
  PORT = port;
  DATA_FILE = dataFile;
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, HOST, () => resolve(server.address().port));
  });
}

// Run directly with `node server.js`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().then((port) => {
    console.log(`\n  App Vault running at  http://localhost:${port}`);
    console.log(`  Data file:            ${DATA_FILE}\n`);
  });
}
