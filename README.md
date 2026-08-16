<div align="center">

# 📦 DiscordDrive
### *Unlimited Encrypted Cloud Storage & Web Streamer Powered by Discord Attachments*

[![Node.js Version](https://img.shields.io/badge/node.js-%3E%3D18.0.0-30d158?style=flat-square&logo=node.js)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0%20(Pure%20Native%20Node)-0a84ff?style=flat-square)](https://github.com/Zerxen-dev/discord-drive)
[![Security Isolation](https://img.shields.io/badge/isolation-Strict%20Per--User-ff375f?style=flat-square)](https://github.com/Zerxen-dev/discord-drive)
[![Pterodactyl Ready](https://img.shields.io/badge/pterodactyl-100%25%20Compatible-00f2fe?style=flat-square)](https://github.com/Zerxen-dev/discord-drive)
[![License](https://img.shields.io/badge/license-MIT-ffd60a?style=flat-square)](LICENSE)

**DiscordDrive** turns your Discord bot and server channels into an **unlimited, encrypted personal cloud storage drive and media streaming hub**.  
Upload files of **ANY size (100MB, 1GB, 5GB+)** via a private authenticated web portal, bypass Discord's 25MB attachment limits with automatic 24MB binary chunking, stream videos/music directly in the browser, and manage your private vault with **strict per-user isolation**.

</div>

---

## 🌟 Key Features

- ♾️ **Unlimited Free Cloud Storage**: Leverage Discord's global CDN attachments for infinite storage with zero monthly fees or caps.
- 🚀 **Bypass Discord 25MB Limits**: Upload 500MB+, 1GB+, or 5GB+ files! The engine automatically slices files into 24MB binary chunks and streams them directly into your private Discord storage channel.
- 🔒 **Strict Per-User Security & Isolation**: Each file belongs solely to the user who uploaded it. No other user can view, search, stream, or delete your private files.
- 🛡️ **Locked Storage Vault**: The Discord storage channel is automatically locked with channel permissions so **only the Server Owner and the Bot** have access (`@everyone` is denied access).
- 🔑 **One-Time Expiring Login Tokens**: Type `/upload` in Discord to receive a private, 15-minute expiring authenticated web link to access your dashboard.
- 📁 **Custom Folders & Tag Organization**: Organize files into folders (Videos, Music, Documents, Games, Backups) and rename files on the fly.
- 🎬 **In-Browser Video & Audio Streaming**: Watch 4K/1080p MP4s or listen to MP3s directly in the web dashboard without downloading the full file first.
- 📄 **Code, Text & Image Preview**: In-browser preview for source code (`.js`, `.py`, `.json`, `.txt`, `.md`), images, and PDFs.
- 🔗 **Advanced Share Links**: Generate secure public download links with optional **expiration timers** (1 hour, 24 hours, 7 days, never).
- 🦖 **1-Click Pterodactyl Panel Ready**: Full support for Pterodactyl environment variables (`SERVER_PORT` / `PORT`), health check endpoint (`/api/health`), and graceful shutdown signals (`SIGTERM`).
- ⚡ **100% Zero Dependencies**: Built purely with native Node.js built-ins (`http`, `https`, `crypto`, `fs`, `os`, `zlib`). Boots in <10ms on Termux.

---

## 📸 Discord Commands

| Command | Type | Description |
| :--- | :---: | :--- |
| `/upload` | Ephemeral | Get a secure, 15-minute expiring link to open your private upload dashboard |
| `/files [filter]` | Ephemeral | View your private stored files with direct download links and chunk info |
| `/storage` | Ephemeral | View your personal cloud storage usage (files count & gigabytes stored) |
| `/search query:<name>` | Ephemeral | Search your private files by filename or keyword |
| `/stats` | Ephemeral | View global storage statistics across all users |

---

## 🦖 Hosting on Pterodactyl Panel

DiscordDrive is 100% optimized for **Pterodactyl Panel (Node.js Generic Egg)**:

1. **Create Server on Pterodactyl**:
   - Egg: **Node.js Generic** (Node 18 / 20)
   - Startup Command: `node server.js`
2. **Set Environment Variables in Panel**:
   - `DISCORD_TOKEN`: Your Discord Bot Token from Discord Developer Portal
   - `STORAGE_CHANNEL_ID`: Channel ID of your private Discord storage channel
   - `BASE_URL`: Public URL of your server (e.g., `http://your-server-ip:5000` or domain)
3. **Upload Files**: Upload the repository contents or clone via Git.
4. **Click Start**: The bot will connect to Discord, lock channel permissions, and start the web dashboard!

---

## 🚀 Quick Start (Termux / Linux / Windows / Docker)

### 📱 1. Android (Termux)

```bash
# 1. Update Termux and install Node.js + Git
pkg update && pkg install nodejs git -y

# 2. Clone repository
git clone https://github.com/Zerxen-dev/discord-drive.git
cd discord-drive

# 3. Configure credentials
cp .env.example .env
nano .env

# 4. Launch (Zero npm install needed!)
node server.js
```

---

### 🪟 2. Windows (PowerShell / Command Prompt)

```powershell
git clone https://github.com/Zerxen-dev/discord-drive.git
cd discord-drive
copy .env.example .env
notepad .env
node server.js
```

---

### 🐧 3. Linux (Ubuntu, Debian, Arch, Fedora)

```bash
sudo apt update && sudo apt install nodejs git -y
git clone https://github.com/Zerxen-dev/discord-drive.git
cd discord-drive
cp .env.example .env
nano .env
node server.js
```

---

### 🐳 4. Docker & Docker Compose

```bash
git clone https://github.com/Zerxen-dev/discord-drive.git
cd discord-drive
cp .env.example .env
docker build -t discord-drive .
docker run -d -p 5000:5000 --env-file .env --name discord-drive discord-drive
```

---

## ⚙️ How It Works

```text
[User uploads 1GB file in Web Dashboard]
               │
               ▼
[Slices into 42 × 24MB Binary Chunks]
               │
               ▼
[Bot streams chunks to locked Discord Channel via REST API]
               │
               ▼
[Saves metadata index tagged with User Snowflake ID in drive_index.json]
               │
               ▼
[When user clicks Download / Stream]
               │
               ▼
[Server streams reassembled chunks on-the-fly from Discord CDN to browser]
```

---

## 📜 License

MIT License © 2026 [Zerxen-dev](https://github.com/Zerxen-dev)
