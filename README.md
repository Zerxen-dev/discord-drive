<div align="center">

# 📦 DiscordDrive
### *Unlimited Encrypted Cloud Storage & Web Streamer Powered by Discord Attachments*

[![Node.js Version](https://img.shields.io/badge/node.js-%3E%3D18.0.0-30d158?style=flat-square&logo=node.js)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0%20(Pure%20Native%20Node)-0a84ff?style=flat-square)](https://github.com/Zerxen-dev/discord-drive)
[![Security Isolation](https://img.shields.io/badge/isolation-Strict%20Per--User-ff375f?style=flat-square)](https://github.com/Zerxen-dev/discord-drive)
[![License](https://img.shields.io/badge/license-MIT-ffd60a?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Android%20Termux%20%7C%20Linux%20%7C%20Windows%20%7C%20macOS%20%7C%20Docker-00f2fe?style=flat-square)](https://github.com/Zerxen-dev/discord-drive)

**DiscordDrive** turns your Discord bot and server channels into an **unlimited, encrypted personal cloud storage drive and streaming hub**.  
Upload files of **ANY size (100MB, 1GB, 5GB+)** via a private authenticated web portal, bypass Discord's 25MB attachment limits with automatic 24MB binary chunking, stream videos/music directly in the browser, and manage your private vault with **strict per-user isolation**.

</div>

---

## 🌟 Key Features

- ♾️ **Unlimited Free Cloud Storage**: Leverage Discord's global CDN attachments for infinite storage with zero monthly fees or caps.
- 🚀 **Bypass Discord 25MB Limits**: Upload 500MB+, 1GB+, or 5GB+ files! The engine automatically slices files into 24MB binary chunks and streams them directly into your private Discord storage channel.
- 🔒 **Strict Per-User Security & Isolation**: Each file belongs solely to the user who uploaded it. No other user can view, search, stream, or delete your private files.
- 🔑 **One-Time Expiring Login Tokens**: Type `/upload` in Discord to receive a private, 15-minute expiring authenticated web link to access your dashboard.
- 🎬 **In-Browser Video & Audio Streaming**: Watch 4K/1080p MP4s or listen to MP3s directly in the web dashboard without downloading the full file first (streams chunks from Discord CDN on the fly).
- 🔗 **Optional 1-Click Public Share Links**: Generate secure public download links (`/d/:token`) to share specific files with friends.
- 💬 **Discord Slash Commands**: `/upload`, `/files`, `/storage`, `/search`.
- ⚡ **100% Zero Dependencies**: Built purely with native Node.js built-ins (`http`, `https`, `crypto`, `fs`, `os`). Boots in <10ms on Termux.

---

## 📸 Discord Commands

| Command | Type | Description |
| :--- | :---: | :--- |
| `/upload` | Ephemeral | Get a secure, 15-minute expiring link to open your private upload dashboard |
| `/files` | Ephemeral | View your private stored files with direct download links and chunk info |
| `/storage` | Ephemeral | View your total cloud storage usage (files count & gigabytes stored) |
| `/search query:<name>` | Ephemeral | Search your private files by filename |

---

## 🚀 Quick Start

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
# 1. Clone repository
git clone https://github.com/Zerxen-dev/discord-drive.git
cd discord-drive

# 2. Copy and edit .env
copy .env.example .env
notepad .env

# 3. Run Server
node server.js
```

---

### 🍎 3. macOS (Terminal)

```bash
# 1. Install Node.js via Homebrew
brew install node git

# 2. Clone and configure
git clone https://github.com/Zerxen-dev/discord-drive.git
cd discord-drive
cp .env.example .env
nano .env

# 3. Start server
node server.js
```

---

### 🐧 4. Linux (Ubuntu, Debian, Arch, Fedora)

```bash
# 1. Install Node.js & Git
sudo apt update && sudo apt install nodejs git -y

# 2. Clone and configure
git clone https://github.com/Zerxen-dev/discord-drive.git
cd discord-drive
cp .env.example .env
nano .env

# 3. Start server
node server.js
```

---

### 🐳 5. Docker & Docker Compose

```bash
git clone https://github.com/Zerxen-dev/discord-drive.git
cd discord-drive
cp .env.example .env
nano .env
docker build -t discord-drive .
docker run -d -p 5000:5000 --env-file .env --name discord-drive discord-drive
```

---

## ⚙️ How It Works Behind the Scenes

```text
[User uploads 1GB file in Web Dashboard]
               │
               ▼
[Slices into 42 × 24MB Binary Chunks]
               │
               ▼
[Bot streams chunks to private Discord Channel via REST API]
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
