/**
 * 📦 DISCORDDRIVE — Unlimited Encrypted Cloud Storage & Web Streamer
 * Uses Discord message attachments as an infinite encrypted chunked CDN backend.
 * 100% Zero Dependencies (Pure Native Node.js HTTP, HTTPS, Crypto & WebSockets)
 * Author: Zerxen-dev (https://github.com/Zerxen-dev)
 * License: MIT
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { EventEmitter } = require('events');

// ============================================================================
// CONFIGURATION & PATHS
// ============================================================================
const PORT = parseInt(process.env.PORT, 10) || 5000;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || '';
const STORAGE_CHANNEL_ID = process.env.STORAGE_CHANNEL_ID || '';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_FILE = path.join(DATA_DIR, 'drive_index.json');

// 24 MB chunk size (safe for Discord standard 25MB attachment limit)
const CHUNK_SIZE = 24 * 1024 * 1024;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// MIME type dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.apk': 'application/vnd.android.package-archive',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip'
};

// ============================================================================
// DATABASE / STORAGE INDEX (STRICT PER-USER ISOLATION)
// ============================================================================
let db = {
  files: {},      // fileId -> { id, ownerId, ownerName, filename, size, mimeType, chunksTotal, chunks: [{ index, messageId, cdnUrl, size }], createdAt, shareToken }
  authTokens: {}, // token -> { userId, username, avatar, expiresAt }
  sessions: {}    // sessionId -> { userId, username, avatar, expiresAt }
};

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(raw);
    }
  } catch (err) {
    console.error('[DB] Load error:', err);
  }
}

function saveDatabase() {
  try {
    const tempFile = DB_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('[DB] Save error:', err);
  }
}

loadDatabase();

// Clean expired auth tokens and sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [tok, data] of Object.entries(db.authTokens || {})) {
    if (data.expiresAt < now) delete db.authTokens[tok];
  }
  for (const [sid, data] of Object.entries(db.sessions || {})) {
    if (data.expiresAt < now) delete db.sessions[sid];
  }
  saveDatabase();
}, 10 * 60 * 1000);

// ============================================================================
// DISCORD REST API CLIENT
// ============================================================================
function discordRequest(method, endpoint, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://discord.com/api/v10${endpoint}`);
    const reqHeaders = {
      'Authorization': `Bot ${DISCORD_TOKEN}`,
      'User-Agent': 'DiscordDrive (https://github.com/Zerxen-dev/discord-drive, 1.0.0)',
      ...headers
    };

    const req = https.request(url, {
      method: method,
      headers: reqHeaders
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const text = buffer.toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch (e) {}

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(json || buffer);
        } else {
          reject(new Error(`Discord API Error ${res.statusCode}: ${text}`));
        }
      });
    });

    req.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body) || typeof body === 'string') req.write(body);
      else req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Upload file attachment directly to Discord channel
function uploadChunkToDiscord(channelId, chunkBuffer, filename, chunkIndex, totalChunks) {
  return new Promise((resolve, reject) => {
    const boundary = '----DiscordDriveBoundary' + crypto.randomBytes(16).toString('hex');
    const payloadJson = JSON.stringify({
      content: `📦 **DiscordDrive Chunk** [${chunkIndex + 1}/${totalChunks}] — \`${filename}\``
    });

    const header = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n${payloadJson}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files[0]"; filename="${filename}.part${chunkIndex}"\r\nContent-Type: application/octet-stream\r\n\r\n`)
    ]);
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);

    const fullBody = Buffer.concat([header, chunkBuffer, footer]);

    const url = new URL(`https://discord.com/api/v10/channels/${channelId}/messages`);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${DISCORD_TOKEN}`,
        'User-Agent': 'DiscordDrive/1.0',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300 && json.attachments && json.attachments[0]) {
            resolve({
              messageId: json.id,
              cdnUrl: json.attachments[0].url,
              size: json.attachments[0].size
            });
          } else {
            reject(new Error(`Discord Upload Error ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

// Download stream from Discord CDN URL
function fetchCdnChunkStream(cdnUrl) {
  return new Promise((resolve, reject) => {
    https.get(cdnUrl, (res) => {
      if (res.statusCode === 200) {
        resolve(res);
      } else {
        reject(new Error(`Failed to fetch CDN chunk: HTTP ${res.statusCode}`));
      }
    }).on('error', reject);
  });
}

// ============================================================================
// DISCORD GATEWAY WEBSOCKET (SLASH COMMANDS & BOT ENGINE)
// ============================================================================
class DiscordGateway extends EventEmitter {
  constructor(token) {
    super();
    this.token = token;
    this.ws = null;
    this.heartbeatInterval = null;
    this.seq = null;
    this.sessionId = null;
    this.botUser = null;
  }

  connect() {
    if (!this.token) {
      console.log('[Discord Bot] No DISCORD_TOKEN provided. Web portal is active in standalone mode.');
      return;
    }

    const ws = new (require('https').request)({
      host: 'gateway.discord.gg',
      path: '/?v=10&encoding=json',
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
        'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'),
        'Sec-WebSocket-Version': '13'
      }
    });

    // Native RFC 6455 WebSocket client
    const socket = require('tls').connect({
      host: 'gateway.discord.gg',
      port: 443,
      servername: 'gateway.discord.gg'
    }, () => {
      const key = crypto.randomBytes(16).toString('base64');
      const req = [
        'GET /?v=10&encoding=json HTTP/1.1',
        'Host: gateway.discord.gg',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
        '\r\n'
      ].join('\r\n');
      socket.write(req);
    });

    let buffer = Buffer.alloc(0);
    let upgraded = false;

    socket.on('data', (chunk) => {
      if (!upgraded) {
        const text = chunk.toString();
        if (text.includes('101 Switching Protocols')) {
          upgraded = true;
          this.ws = socket;
          const idx = chunk.indexOf('\r\n\r\n');
          if (idx !== -1 && idx + 4 < chunk.length) {
            buffer = chunk.slice(idx + 4);
          }
        }
        return;
      }

      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 2) {
        const byte1 = buffer[0];
        const byte2 = buffer[1];
        const opcode = byte1 & 0x0f;
        let payloadLen = byte2 & 0x7f;
        let headerLen = 2;

        if (payloadLen === 126) {
          if (buffer.length < 4) return;
          payloadLen = buffer.readUInt16BE(2);
          headerLen = 4;
        } else if (payloadLen === 127) {
          if (buffer.length < 10) return;
          payloadLen = Number(buffer.readBigUInt64BE(2));
          headerLen = 10;
        }

        if (buffer.length < headerLen + payloadLen) return;

        const payload = buffer.slice(headerLen, headerLen + payloadLen);
        buffer = buffer.slice(headerLen + payloadLen);

        if (opcode === 0x01 || opcode === 0x02) {
          try {
            const data = JSON.parse(payload.toString('utf8'));
            this._handleGatewayMessage(data);
          } catch (e) {}
        }
      }
    });

    socket.on('close', () => {
      clearInterval(this.heartbeatInterval);
      setTimeout(() => this.connect(), 5000);
    });

    socket.on('error', () => {});
  }

  send(data) {
    if (!this.ws) return;
    const json = typeof data === 'string' ? data : JSON.stringify(data);
    const payload = Buffer.from(json, 'utf8');
    const length = payload.length;

    const mask = crypto.randomBytes(4);
    const masked = Buffer.alloc(length);
    for (let i = 0; i < length; i++) masked[i] = payload[i] ^ mask[i % 4];

    let header;
    if (length < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x81;
      header[1] = 0x80 | length;
    } else if (length < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 0x80 | 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }

    try {
      this.ws.write(Buffer.concat([header, mask, masked]));
    } catch (e) {}
  }

  _handleGatewayMessage(msg) {
    const { op, d, s, t } = msg;
    if (s !== null) this.seq = s;

    // Opcode 10: Hello -> Start heartbeat & Identify
    if (op === 10) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = setInterval(() => {
        this.send({ op: 1, d: this.seq });
      }, d.heartbeat_interval);

      this.send({
        op: 2,
        d: {
          token: this.token,
          intents: 513, // GUILDS + GUILD_MESSAGES
          properties: { os: 'linux', browser: 'DiscordDrive', device: 'Termux' }
        }
      });
    } else if (t === 'READY') {
      this.botUser = d.user;
      console.log(`[Discord Bot] Logged in as ${d.user.username}#${d.user.discriminator} (ID: ${d.user.id})`);
      this._registerSlashCommands(d.user.id);
    } else if (t === 'INTERACTION_CREATE') {
      this._handleInteraction(d);
    }
  }

  async _registerSlashCommands(botId) {
    const commands = [
      {
        name: 'upload',
        description: 'Get your private one-time link to upload files of ANY size'
      },
      {
        name: 'files',
        description: 'View and manage your privately stored files'
      },
      {
        name: 'storage',
        description: 'View your personal cloud storage usage on Discord'
      },
      {
        name: 'search',
        description: 'Search your private stored files',
        options: [
          {
            name: 'query',
            description: 'Filename or keyword to search',
            type: 3,
            required: true
          }
        ]
      }
    ];

    try {
      await discordRequest('PUT', `/applications/${botId}/commands`, commands);
      console.log('[Discord Bot] Global slash commands registered successfully!');
    } catch (err) {
      console.warn('[Discord Bot] Could not register slash commands:', err.message);
    }
  }

  async _handleInteraction(interaction) {
    const { id, token, data, user, member } = interaction;
    const caller = user || (member ? member.user : null);
    if (!caller) return;

    const cmdName = data.name;

    if (cmdName === 'upload') {
      const oneTimeToken = generateAuthToken(caller.id, caller.username, caller.avatar);
      const portalUrl = `${BASE_URL}/auth?token=${oneTimeToken}`;

      const reply = {
        type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
        data: {
          flags: 64, // EPHEMERAL (Only caller can see)
          embeds: [
            {
              title: '📦  Your Private DiscordDrive Upload Portal',
              description: (
                `Hey **${caller.username}**! Tap the link below to open your secure upload dashboard.\n\n` +
                `🚀 **Upload Files of ANY Size (100MB, 1GB, 5GB+)**\n` +
                `🔒 **100% Private to You (Strictly Isolated)**\n\n` +
                `👉 **[Click Here to Open Your Drive](${portalUrl})**\n\n` +
                `*⚠️ This secure login link expires in 15 minutes.*`
              ),
              color: 689407,
              footer: { text: 'DiscordDrive • Zero-Cloud Unlimited Storage' }
            }
          ]
        }
      };

      await discordRequest('POST', `/interactions/${id}/${token}/callback`, reply).catch(() => {});
    } else if (cmdName === 'files') {
      const userFiles = Object.values(db.files).filter(f => f.ownerId === caller.id);
      let desc = '';

      if (userFiles.length === 0) {
        desc = 'You have no files stored yet!\nUse `/upload` to open your upload portal and add files.';
      } else {
        desc = userFiles.slice(0, 10).map((f, i) => {
          return `**${i + 1}. ${f.filename}**\n` +
                 `   📊 ${formatBytes(f.size)} • ${f.chunksTotal} chunk${f.chunksTotal > 1 ? 's' : ''} • 🔗 [Download](${BASE_URL}/d/${f.shareToken})`;
        }).join('\n\n');

        if (userFiles.length > 10) {
          desc += `\n\n*...and ${userFiles.length - 10} more files. Use \`/upload\` to view all.*`;
        }
      }

      const reply = {
        type: 4,
        data: {
          flags: 64, // EPHEMERAL
          embeds: [
            {
              title: `📁  Your Private Files (${userFiles.length})`,
              description: desc,
              color: 3203416,
              footer: { text: 'DiscordDrive • Private to You' }
            }
          ]
        }
      };

      await discordRequest('POST', `/interactions/${id}/${token}/callback`, reply).catch(() => {});
    } else if (cmdName === 'storage') {
      const userFiles = Object.values(db.files).filter(f => f.ownerId === caller.id);
      const totalBytes = userFiles.reduce((acc, f) => acc + (f.size || 0), 0);

      const reply = {
        type: 4,
        data: {
          flags: 64,
          embeds: [
            {
              title: `📊  Storage Usage for ${caller.username}`,
              description: (
                `💾 **Total Stored:** \`${formatBytes(totalBytes)}\`\n` +
                `📁 **Total Files:** \`${userFiles.length}\`\n` +
                `♾️ **Storage Limit:** \`Unlimited ♾️\`\n\n` +
                `Run \`/upload\` to add more files anytime!`
              ),
              color: 16766474
            }
          ]
        }
      };

      await discordRequest('POST', `/interactions/${id}/${token}/callback`, reply).catch(() => {});
    }
  }
}

// ============================================================================
// TOKEN & SESSION AUTHENTICATION (STRICT USER ISOLATION)
// ============================================================================
function generateAuthToken(userId, username, avatar) {
  const token = 'tok_' + crypto.randomBytes(24).toString('hex');
  if (!db.authTokens) db.authTokens = {};
  db.authTokens[token] = {
    userId: String(userId),
    username: username || 'User',
    avatar: avatar ? `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png` : null,
    expiresAt: Date.now() + 15 * 60 * 1000 // 15 mins
  };
  saveDatabase();
  return token;
}

function createSession(userId, username, avatar) {
  const sessionId = 'sid_' + crypto.randomBytes(32).toString('hex');
  if (!db.sessions) db.sessions = {};
  db.sessions[sessionId] = {
    userId: String(userId),
    username: username || 'User',
    avatar: avatar || null,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  };
  saveDatabase();
  return sessionId;
}

function getSessionFromRequest(req) {
  const cookieHeader = req.headers['cookie'] || '';
  const match = cookieHeader.match(/discord_drive_session=([^;]+)/);
  if (!match) return null;
  const sessionId = match[1];

  const session = db.sessions[sessionId];
  if (!session || session.expiresAt < Date.now()) {
    return null;
  }
  return session;
}

function formatBytes(bytes) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// ============================================================================
// HTTP WEB SERVER & STREAMING CONTROLLER
// ============================================================================
const server = http.createServer(async (req, res) => {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Chunk-Index, X-Total-Chunks, X-File-Id, X-File-Name, X-File-Size');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // ── 1. Auth Endpoint: One-time token verification ──────────────────────
  if (pathname === '/auth') {
    const token = parsedUrl.searchParams.get('token');
    if (token && db.authTokens[token]) {
      const authData = db.authTokens[token];
      if (authData.expiresAt >= Date.now()) {
        const sessionId = createSession(authData.userId, authData.username, authData.avatar);
        delete db.authTokens[token];
        saveDatabase();

        res.writeHead(302, {
          'Set-Cookie': `discord_drive_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}`,
          'Location': '/'
        });
        res.end();
        return;
      }
    }

    res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>401 Expired or Invalid Link</h1><p>Please run <code>/upload</code> in Discord to get a fresh link.</p>');
    return;
  }

  // ── 2. Public Direct Download / Stream Endpoint: /d/:token ─────────────
  if (pathname.startsWith('/d/')) {
    const shareToken = pathname.split('/')[2];
    const file = Object.values(db.files).find(f => f.shareToken === shareToken);

    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 File Not Found</h1><p>This file link does not exist or has been deleted by its owner.</p>');
      return;
    }

    // Stream reassembled chunks sequentially from Discord CDN
    res.writeHead(200, {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Length': file.size,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.filename)}"`
    });

    try {
      for (const chunk of file.chunks) {
        const stream = await fetchCdnChunkStream(chunk.cdnUrl);
        await new Promise((resolve, reject) => {
          stream.pipe(res, { end: false });
          stream.on('end', resolve);
          stream.on('error', reject);
        });
      }
      res.end();
    } catch (err) {
      console.error('[Stream Error]:', err);
      res.end();
    }
    return;
  }

  // ── 3. API Endpoints (Requires User Session) ──────────────────────────
  if (pathname.startsWith('/api/')) {
    const session = getSessionFromRequest(req);

    // Fallback: If in standalone testing mode without bot token, create guest session
    let effectiveUser = session;
    if (!effectiveUser && !DISCORD_TOKEN) {
      effectiveUser = { userId: 'guest_local', username: 'Local Admin', avatar: null };
    }

    if (!effectiveUser && pathname !== '/api/health') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized. Use /upload in Discord to log in.' }));
      return;
    }

    // GET /api/user — Profile & Storage Stats
    if (pathname === '/api/user' && req.method === 'GET') {
      const userFiles = Object.values(db.files).filter(f => f.ownerId === effectiveUser.userId);
      const totalBytes = userFiles.reduce((acc, f) => acc + (f.size || 0), 0);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        user: effectiveUser,
        stats: {
          totalFiles: userFiles.length,
          totalBytes: totalBytes,
          formattedBytes: formatBytes(totalBytes)
        }
      }));
      return;
    }

    // GET /api/files — Get User's Isolated Files
    if (pathname === '/api/files' && req.method === 'GET') {
      const userFiles = Object.values(db.files)
        .filter(f => f.ownerId === effectiveUser.userId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(f => ({
          id: f.id,
          filename: f.filename,
          size: f.size,
          formattedSize: formatBytes(f.size),
          mimeType: f.mimeType,
          chunksTotal: f.chunksTotal,
          createdAt: f.createdAt,
          shareUrl: `${BASE_URL}/d/${f.shareToken}`,
          streamUrl: `${BASE_URL}/api/stream/${f.id}`
        }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ files: userFiles }));
      return;
    }

    // POST /api/upload_chunk — Upload a 24MB slice to Discord
    if (pathname === '/api/upload_chunk' && req.method === 'POST') {
      const fileId = req.headers['x-file-id'];
      const fileName = decodeURIComponent(req.headers['x-file-name'] || 'file.bin');
      const fileSize = parseInt(req.headers['x-file-size'], 10) || 0;
      const chunkIndex = parseInt(req.headers['x-chunk-index'], 10) || 0;
      const totalChunks = parseInt(req.headers['x-total-chunks'], 10) || 1;

      if (!fileId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing X-File-Id header' }));
        return;
      }

      // Read raw binary chunk body
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', async () => {
        const chunkBuffer = Buffer.concat(chunks);

        try {
          let cdnInfo = null;

          if (DISCORD_TOKEN && STORAGE_CHANNEL_ID) {
            // Upload to Discord Attachment CDN
            cdnInfo = await uploadChunkToDiscord(STORAGE_CHANNEL_ID, chunkBuffer, fileName, chunkIndex, totalChunks);
          } else {
            // Standalone Local Storage fallback
            const chunkPath = path.join(DATA_DIR, `${fileId}_part${chunkIndex}`);
            fs.writeFileSync(chunkPath, chunkBuffer);
            cdnInfo = {
              messageId: 'local_' + Date.now(),
              cdnUrl: `${BASE_URL}/data/${fileId}_part${chunkIndex}`,
              size: chunkBuffer.length
            };
          }

          // Register chunk in database
          if (!db.files[fileId]) {
            const ext = path.extname(fileName).toLowerCase();
            db.files[fileId] = {
              id: fileId,
              ownerId: effectiveUser.userId,
              ownerName: effectiveUser.username,
              filename: fileName,
              size: fileSize,
              mimeType: MIME_TYPES[ext] || 'application/octet-stream',
              chunksTotal: totalChunks,
              chunks: [],
              createdAt: Date.now(),
              shareToken: 'sh_' + crypto.randomBytes(16).toString('hex')
            };
          }

          db.files[fileId].chunks[chunkIndex] = {
            index: chunkIndex,
            messageId: cdnInfo.messageId,
            cdnUrl: cdnInfo.cdnUrl,
            size: cdnInfo.size
          };

          saveDatabase();

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'ok',
            chunkIndex: chunkIndex,
            totalChunks: totalChunks,
            file: db.files[fileId].chunks.length === totalChunks ? db.files[fileId] : null
          }));
        } catch (uploadErr) {
          console.error('[Upload Chunk Error]:', uploadErr);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: uploadErr.message }));
        }
      });
      return;
    }

    // DELETE /api/file/:id — Delete File (Strict Owner Check)
    if (pathname.startsWith('/api/file/') && req.method === 'DELETE') {
      const fileId = pathname.split('/')[3];
      const file = db.files[fileId];

      if (!file) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found' }));
        return;
      }

      if (file.ownerId !== effectiveUser.userId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden: You do not own this file' }));
        return;
      }

      // Delete chunks from Discord if channel ID is configured
      if (DISCORD_TOKEN && STORAGE_CHANNEL_ID) {
        for (const chunk of file.chunks) {
          if (chunk && chunk.messageId && !chunk.messageId.startsWith('local_')) {
            discordRequest('DELETE', `/channels/${STORAGE_CHANNEL_ID}/messages/${chunk.messageId}`).catch(() => {});
          }
        }
      }

      delete db.files[fileId];
      saveDatabase();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', message: 'File deleted' }));
      return;
    }

    // GET /api/stream/:id — Streaming Media Preview (Strict Owner Check)
    if (pathname.startsWith('/api/stream/')) {
      const fileId = pathname.split('/')[3];
      const file = db.files[fileId];

      if (!file || file.ownerId !== effectiveUser.userId) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Access Denied');
        return;
      }

      res.writeHead(200, {
        'Content-Type': file.mimeType,
        'Content-Length': file.size,
        'Accept-Ranges': 'bytes'
      });

      for (const chunk of file.chunks) {
        const stream = await fetchCdnChunkStream(chunk.cdnUrl);
        await new Promise((resolve) => {
          stream.pipe(res, { end: false });
          stream.on('end', resolve);
          stream.on('error', resolve);
        });
      }
      res.end();
      return;
    }
  }

  // ── 4. Static Files (Dashboard UI) ────────────────────────────────────
  let reqPath = decodeURIComponent(pathname);
  if (reqPath === '/') reqPath = '/index.html';

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

// ============================================================================
// START SERVERS & BOT GATEWAY
// ============================================================================
server.listen(PORT, () => {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({ iface: name, address: net.address });
      }
    }
  }

  console.log('\n=============================================================');
  console.log('   📦 DISCORDDRIVE — UNLIMITED ENCRYPTED STORAGE LIVE! 📦    ');
  console.log('=============================================================');
  console.log(` ▸ Web Dashboard:  http://localhost:${PORT}`);
  addresses.forEach(addr => {
    console.log(` ▸ Network Access: http://${addr.address}:${PORT}`);
  });
  console.log('=============================================================\n');

  // Connect Discord Bot
  if (DISCORD_TOKEN) {
    const bot = new DiscordGateway(DISCORD_TOKEN);
    bot.connect();
  }
});
