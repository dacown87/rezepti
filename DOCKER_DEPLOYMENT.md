# Docker Deployment Guide — Rezepti

This document provides comprehensive instructions for deploying Rezepti using Docker. Rezepti is a recipe extraction service that supports YouTube, Instagram, TikTok, and web pages, translating them to German and storing them in SQLite databases.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Deployment Profiles](#deployment-profiles)
4. [Configuration](#configuration)
5. [Network & DNS](#network--dns)
6. [Data Persistence](#data-persistence)
7. [Common Operations](#common-operations)
8. [Troubleshooting](#troubleshooting)
9. [Health Checks & Monitoring](#health-checks--monitoring)
10. [Backup & Restore](#backup--restore)
11. [Performance Tuning](#performance-tuning)
12. [Security Considerations](#security-considerations)

---

## Overview

Rezepti offers multiple Docker deployment profiles:

| Profile | Description | Use Case |
|---------|-------------|----------|
| `react` | React dev mode with hot reload | Local development |
| `react-prod` | React production build | Production deployment |
| `prod` | Legacy production (no React) | Backward compatibility |

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Container                      │
│  ┌─────────────┐    ┌─────────────┐    ┌────────────┐ │
│  │   Express    │───▶│  Pipeline   │───▶│  SQLite    │ │
│  │   Server     │    │  (Groq AI)  │    │  Database  │ │
│  └─────────────┘    └─────────────┘    └────────────┘ │
│         │                                        │       │
│         ▼                                        ▼       │
│  ┌─────────────┐                          ┌────────────┐ │
│  │   React     │                          │   yt-dlp   │ │
│  │   Frontend  │                          │  (Videos)  │ │
│  └─────────────┘                          └────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- Docker Engine 20.10+ and Docker Compose v2+
- A Groq API key (free at [console.groq.com](https://console.groq.com))
- At least 2GB RAM recommended
- 5GB disk space

### Verify Docker Installation

```bash
docker --version           # Docker version
docker compose version     # Docker Compose version
docker info | grep "Total" # Check resources
```

---

## Deployment Profiles

### 1. React Development (`react`)

**Use for:** Local development with hot reload for both frontend and backend.

```bash
# Start React development environment
docker compose --profile react up

# With rebuild (if Dockerfile changed)
docker compose --profile react up --build

# Run in background
docker compose --profile react up -d
```

**Features:**
- Hot reload for React frontend (Vite)
- Hot reload for Node.js backend (tsx watch)
- Source code mounted as volumes
- Vite dev server on port 5173
- Backend API on port 3000

**URLs:**
- Frontend: http://localhost:3000
- Vite Dev Server: http://localhost:5173
- API: http://localhost:3000/api

### 2. React Production (`react-prod`)

**Use for:** Production deployment with optimized React build.

```bash
# Build and start production containers
docker compose --profile react-prod up --build

# Run in background
docker compose --profile react-prod up -d --build
```

**Features:**
- Optimized React build (minified, tree-shaken)
- Backend compiled with TypeScript
- Production Node.js runtime
- No source code mounted (immutable image)

**URLs:**
- Frontend: http://localhost:3000
- API: http://localhost:3000/api

### 3. Legacy Production (`prod`)

**Use for:** Backward compatibility with old UI.

```bash
# Pull latest image from Docker Hub
docker compose --profile prod up -d

# With explicit pull
docker compose --profile prod pull && docker compose --profile prod up -d
```

**Features:**
- Pre-built image from Docker Hub (`dacown/rezepti:latest`)
- No local build required
- Simple HTML interface
- Minimal resource usage

---

## Configuration

### Environment File Setup

Create `.env` in the project root (next to `docker-compose.yml`):

```bash
cp .env.example .env
# Edit .env with your settings
```

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | Yes | — | Groq API key from console.groq.com |
| `GROQ_TEXT_MODEL` | No | `llama-3.3-70b-versatile` | Model for text extraction |
| `GROQ_VISION_MODEL` | No | `meta-llama/llama-4-scout-17b-16e-instruct` | Model for image analysis |
| `GROQ_WHISPER_MODEL` | No | `whisper-large-v3-turbo` | Model for audio transcription |
| `REACT_SQLITE_PATH` | No | `./data/rezepti-react.db` | React frontend database path |
| `SQLITE_PATH` | No | `./data/rezepti.db` | Legacy database path |
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | Node environment |
| `COOKIDOO_EMAIL` | No | — | Cookidoo email (optional) |
| `COOKIDOO_PASSWORD` | No | — | Cookidoo password (optional) |

### Important Configuration Notes

1. **GROQ_API_KEY** is mandatory for recipe extraction
2. Environment variables in `.env` override defaults
3. Docker Compose passes `.env` via `env_file` directive
4. Changes to `.env` require container restart

---

## Network & DNS

### DNS Configuration Issue

Docker containers may experience DNS resolution issues, particularly when:
- Using VPN or corporate networks
- DNS server in container differs from host
- Container networks are isolated

**Solution:** Rezepti's Docker Compose files include explicit DNS configuration:

```yaml
environment:
  - NODE_ENV=production
dns:
  - 8.8.8.8
  - 1.1.1.1
```

This ensures:
- Google DNS (8.8.8.8) as primary
- Cloudflare DNS (1.1.1.1) as fallback
- Reliable yt-dlp downloads
- Consistent API calls to Groq

### Port Configuration

| Service | Internal Port | External Port | Profile |
|---------|---------------|---------------|---------|
| Backend API | 3000 | 3000 | all |
| Vite Dev Server | 5173 | 5173 | react (dev only) |

### Network Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     Host Machine                             │
│  ┌────────────────┐              ┌────────────────────────┐  │
│  │   Browser      │─────────────▶│   Docker Container     │  │
│  │   localhost    │   :3000      │   ┌──────────────────┐ │  │
│  │   :3000       │              │   │  Express Server  │ │  │
│  └────────────────┘              │   │  ├─ API Routes   │ │  │
│                                 │   │  └─ Static Files │ │  │
│  ┌────────────────┐              │   └──────────────────┘ │  │
│  │   IDE          │─────────────▶│   ┌──────────────────┐ │  │
│  │   (Source)     │   Volumes    │   │  Source Code     │ │  │
│  └────────────────┘              │   │  (Hot Reload)    │ │  │
│                                 │   └──────────────────┘ │  │
└──────────────────────────────────────────────────────────────┘
```

---

## Data Persistence

### Volume Mounts

| Path | Container | Host | Description |
|------|-----------|------|-------------|
| `./data` | `/app/data` | `data/` | SQLite databases |
| `./src` | `/app/src` | `src/` | Backend source (dev) |
| `./frontend` | `/app/frontend` | `frontend/` | Frontend source (dev) |
| `./public` | `/app/public` | `public/` | Static files (dev) |

### Database Files

- **React DB:** `data/rezepti-react.db` — Primary database for new React frontend
- **Legacy DB:** `data/rezepti.db` — Compatibility database for old UI

### Important Volume Notes

> **WARNING:** Never mount `./node_modules` as a volume. The `better-sqlite3` native addon is compiled for the host system and will not work in the Linux container if overridden.

Docker Compose handles this correctly:
```yaml
volumes:
  - ./frontend:/app/frontend
  - /app/frontend/node_modules  # Named volume for node_modules
```

### Verify Data Persistence

```bash
# Check database files exist
ls -la data/

# After container restart, verify data intact
docker compose --profile react-prod restart
sqlite3 data/rezepti-react.db "SELECT COUNT(*) FROM recipes;"
```

---

## Common Operations

### Starting Containers

```bash
# Development with React
docker compose --profile react up

# Production with React
docker compose --profile react-prod up -d

# Legacy production
docker compose --profile prod up -d

# With rebuild
docker compose --profile react up --build
```

### Stopping Containers

```bash
# Stop and remove containers
docker compose --profile react down

# Stop but keep data volumes
docker compose --profile react down -v  # WARNING: Removes databases!

# Graceful stop (sends SIGTERM)
docker compose --profile react stop
```

### Viewing Logs

```bash
# All logs
docker compose --profile react logs

# Follow logs in real-time
docker compose --profile react logs -f

# Last 100 lines
docker compose --profile react logs --tail 100

# Logs from specific service
docker compose --profile react logs rezepti-react

# Logs with timestamps
docker compose --profile react logs -t

# Combine options
docker compose --profile react logs -f --tail 50 -t
```

### Debugging Issues

```bash
# Interactive shell in container
docker compose --profile react run --rm rezepti-react /bin/sh

# Check running processes
docker compose --profile react exec rezepti-react ps aux

# Check network connectivity
docker compose --profile react exec rezepti-react curl -v https://api.groq.cloud

# Inspect DNS resolution
docker compose --profile react exec rezepti-react nslookup google.com

# Check environment variables
docker compose --profile react exec rezepti-react env | grep -E "(GROQ|NODE|PORT)"

# Check database connectivity
docker compose --profile react exec rezepti-react node -e "console.log('Node works')"

# Test yt-dlp
docker compose --profile react exec rezepti-react yt-dlp --version
docker compose --profile react exec rezepti-react yt-dlp --simulate "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

### Updating the Application

```bash
# For Docker Hub image (prod profile)
docker compose --profile prod pull
docker compose --profile prod up -d

# For local build (react-prod)
git pull
docker compose --profile react-prod up --build -d

# Verify update
docker compose --profile react-prod exec rezepti-react-prod node --version
docker compose --profile react-prod logs --tail 10
```

### Rebuilding Images

```bash
# Full rebuild (no cache)
docker compose --profile react build --no-cache
docker compose --profile react up

# Rebuild specific service
docker compose --profile react build rezepti-react
```

---

## Troubleshooting

### DNS Resolution Problems

**Symptoms:**
- `curl: (6) Could not resolve host`
- yt-dlp fails with network errors
- Groq API calls fail intermittently

**Solutions:**

1. **Verify DNS configuration:**
   ```bash
   docker compose --profile react exec rezepti-react cat /etc/resolv.conf
   ```

2. **Test DNS resolution:**
   ```bash
   docker compose --profile react exec rezepti-react nslookup api.groq.cloud
   docker compose --profile react exec rezepti-react nslookup youtube.com
   ```

3. **Manual DNS test:**
   ```bash
   docker compose --profile react exec rezepti-react ping -c 2 8.8.8.8
   docker compose --profile react exec rezepti-react ping -c 2 google.com
   ```

4. **Restart with explicit DNS** (add to `docker-compose.yml`):
   ```yaml
   rezepti-react:
     dns:
       - 8.8.8.8
       - 1.1.1.1
   ```

5. **Corporate/VPN DNS issues:**
   ```bash
   # Flush Docker's DNS cache
   docker system prune -f
   ```

### yt-dlp Not Working

**Symptoms:**
- Video downloads fail
- `yt-dlp: command not found`
- YouTube/Instagram extraction returns no content

**Diagnosis:**
```bash
# Check yt-dlp installation
docker compose --profile react exec rezepti-react yt-dlp --version

# Test basic download
docker compose --profile react exec rezepti-react yt-dlp --simulate "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Check for dependency errors
docker compose --profile react logs | grep -i "yt-dlp"
```

**Solutions:**

1. **Verify yt-dlp in Dockerfile:**
   ```dockerfile
   # In Dockerfile.react
   RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
       -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp
   ```

2. **Install manually in container:**
   ```bash
   docker compose --profile react exec rezepti-react /bin/sh -c "pip3 install yt-dlp"
   ```

3. **Check ffmpeg installation:**
   ```bash
   docker compose --profile react exec rezepti-react ffmpeg -version
   ```

4. **Network test for yt-dlp servers:**
   ```bash
   docker compose --profile react exec rezepti-react curl -v "https://update.yt-dlp.org"
   ```

### Database Connection Issues

**Symptoms:**
- `SQLITE_CANTOPEN` errors
- Empty recipe list
- Server crashes on database write

**Diagnosis:**
```bash
# Check database files exist
docker compose --profile react exec rezepti-react ls -la /app/data/

# Test database permissions
docker compose --profile react exec rezepti-react touch /app/data/test.txt
docker compose --profile react exec rezepti-react rm /app/data/test.txt

# Check database integrity
docker compose --profile react exec rezepti-react sqlite3 /app/data/rezepti-react.db "PRAGMA integrity_check;"
```

**Solutions:**

1. **Fix volume mount:**
   ```bash
   # Ensure data directory exists on host
   mkdir -p data
   chmod 777 data
   ```

2. **Recreate database (WARNING: Data loss):**
   ```bash
   docker compose --profile react down
   rm data/rezepti-react.db
   docker compose --profile react up
   ```

3. **Check for locked database:**
   ```bash
   # Find process holding database
   lsof data/rezepti-react.db
   # Kill if necessary
   ```

### React App Not Loading

**Symptoms:**
- Blank page at localhost:3000
- Static file 404 errors
- React app shows errors

**Diagnosis:**
```bash
# Check if React files exist in container
docker compose --profile react exec rezepti-react ls -la /app/public/

# Check build output
docker compose --profile react exec rezepti-react ls -la /app/dist/public/ 2>/dev/null || echo "No dist/public"

# Test static file serving
docker compose --profile react exec rezepti-react curl -I http://localhost:3000/
```

**Solutions:**

1. **For react-prod, rebuild:**
   ```bash
   docker compose --profile react-prod down
   docker compose --profile react-prod up --build
   ```

2. **For react dev, check Vite:**
   ```bash
   # Check Vite dev server logs
   docker compose --profile react logs -f | grep -i vite
   
   # Verify frontend volume mount
   docker compose --profile react exec rezepti-react ls -la /app/frontend/
   ```

3. **Clear build cache:**
   ```bash
   rm -rf frontend/dist
   rm -rf frontend/node_modules/.vite
   docker compose --profile react up --build
   ```

### Container Exiting Immediately

**Symptoms:**
- Container status shows `Exited (1)`
- No logs available

**Diagnosis:**
```bash
# Check exit code
docker compose --profile react ps

# View logs before exit
docker compose --profile react logs --tail 100

# Run container in foreground to see errors
docker compose --profile react run --rm rezepti-react
```

**Common Causes:**
1. Missing `.env` file with `GROQ_API_KEY`
2. Port 3000 already in use
3. Volume mount permissions
4. Missing `better-sqlite3` native module

### Slow Performance

**Symptoms:**
- Extraction takes very long
- High CPU usage
- Memory errors

**Solutions:**
```bash
# Increase Docker resources
# Docker Desktop → Settings → Resources → Increase Memory to 4GB+

# Limit container resources
docker compose --profile react up -d
docker update --memory=2g rezepti_rezepti-react-1

# Check resource usage
docker stats --no-stream
```

---

## Health Checks & Monitoring

### Health Endpoint

All profiles include health check configuration:

```bash
# Check health status
curl http://localhost:3000/api/health

# Detailed health check
curl http://localhost:3000/api/v1/health
```

### Container Health

```bash
# View container health status
docker inspect --format='{{.State.Health.Status}}' rezepti_rezepti-react-1

# View last health check result
docker inspect --format='{{json .State.Health}}' rezepti_rezepti-react-1 | jq
```

### Resource Monitoring

```bash
# Real-time resource usage
docker stats

# Specific container stats
docker stats rezepti_rezepti-react-1 --no-stream

# Container processes
docker top rezepti_rezepti-react-1
```

### Log Aggregation

```bash
# Error-only logs
docker compose --profile react logs | grep -i error

# Warning and error logs
docker compose --profile react logs | grep -iE "(warn|error|fail)"

# API request logs
docker compose --profile react logs | grep -iE "(GET|POST|api)"

# Export logs to file
docker compose --profile react logs > rezepti-logs-$(date +%Y%m%d).txt
```

---

## Backup & Restore

### Backup Database

```bash
# Create backup directory
mkdir -p backups

# Backup React database
cp data/rezepti-react.db backups/rezepti-react-$(date +%Y%m%d).db

# Backup legacy database
cp data/rezepti.db backups/rezepti-$(date +%Y%m%d).db

# Create compressed backup
tar -czf backups/rezepti-backup-$(date +%Y%m%d).tar.gz data/

# Automated backup script
#!/bin/bash
BACKUP_DIR="backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/rezepti-$DATE.tar.gz data/
# Keep only last 7 backups
ls -t $BACKUP_DIR/*.tar.gz | tail -n +8 | xargs -r rm
```

### Restore Database

```bash
# Stop containers
docker compose --profile react down

# Restore React database
cp backups/rezepti-react-20260322.db data/rezepti-react.db

# Restore from compressed backup
tar -xzf backups/rezepti-backup-20260322.tar.gz

# Restart containers
docker compose --profile react up -d

# Verify restoration
curl http://localhost:3000/api/v1/recipes | jq '. | length'
```

### Full System Backup

```bash
#!/bin/bash
BACKUP_NAME="rezepti-full-backup-$(date +%Y%m%d)"
tar -czf "$BACKUP_NAME.tar.gz" \
    data/ \
    .env \
    docker-compose.yml \
    Dockerfile.react
```

---

## Performance Tuning

### Docker Resource Allocation

**Docker Desktop (Mac/Windows):**
- Settings → Resources → Memory: 4GB minimum
- Settings → Resources → CPUs: 2 minimum
- Settings → Resources → Disk: 20GB minimum

**Linux (dockerd settings):**
```json
// /etc/docker/daemon.json
{
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  }
}
```

### Container Resource Limits

Add to `docker-compose.yml`:

```yaml
services:
  rezepti-react:
    # ... existing config ...
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### Database Performance

```bash
# Enable WAL mode for better concurrency
sqlite3 data/rezepti-react.db "PRAGMA journal_mode=WAL;"

# Check database size
du -h data/rezepti-react.db

# Analyze database
sqlite3 data/rezepti-react.db "ANALYZE;"
```

### Network Performance

```bash
# Use host networking (Linux only)
# Add to service in docker-compose.yml:
# network_mode: "host"

# For improved DNS:
# Already configured in compose file with 8.8.8.8 and 1.1.1.1
```

### Application Tuning

```bash
# Increase Node.js memory for large extractions
# Add to environment in docker-compose.yml:
environment:
  - NODE_OPTIONS=--max-old-space-size=1536

# Enable connection pooling
# Already implemented in Express
```

---

## Security Considerations

### API Key Security

```bash
# Never commit .env to git
echo ".env" >> .gitignore

# Use Docker secrets for production (docker-compose v2+)
# Note: Not supported in standalone docker-compose, requires Swarm mode

# Rotate API keys regularly
# Generate new key at console.groq.com
# Update .env
# Restart containers
docker compose --profile react-prod restart
```

### Container Security

1. **Run as non-root user** (already configured via Node.js):
   ```dockerfile
   # In Dockerfile.react
   RUN useradd -m rezepti
   USER rezepti
   ```

2. **Read-only root filesystem** (advanced):
   ```yaml
   # Add to service in docker-compose.yml
   read_only: true
   tmpfs:
     - /tmp
   ```

3. **Limit capabilities:**
   ```yaml
   cap_drop:
     - ALL
   ```

### Network Security

```bash
# Don't expose ports unnecessarily
# Already configured with minimal exposure (3000, 5173)

# Use firewall rules
sudo ufw allow 3000/tcp  # Only if external access needed

# Consider reverse proxy with HTTPS
# See "Reverse Proxy Setup" below
```

### Reverse Proxy Setup (Optional)

For production with HTTPS:

```nginx
# /etc/nginx/sites-available/rezepti
server {
    listen 80;
    server_name rezepti.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name rezepti.example.com;

    ssl_certificate /etc/letsencrypt/live/rezepti.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rezepti.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Image Security

```bash
# Scan image for vulnerabilities
docker scout cve dacown/rezepti:latest

# Use specific version tags instead of 'latest'
docker compose --profile prod pull dacown/rezepti:1.0.0

# Keep images updated
docker compose --profile prod pull
```

---

## Quick Reference

### Essential Commands

```bash
# Start development
docker compose --profile react up

# Start production
docker compose --profile react-prod up -d

# View logs
docker compose --profile react logs -f

# Stop
docker compose --profile react down

# Rebuild
docker compose --profile react up --build

# Shell access
docker compose --profile react exec rezepti-react /bin/sh

# Check health
curl http://localhost:3000/api/health

# Check resources
docker stats --no-stream
```

### File Locations

| Purpose | Path |
|---------|------|
| Docker Compose | `docker-compose.yml` |
| Dockerfile (React) | `Dockerfile.react` |
| Dockerfile (Legacy) | `Dockerfile` |
| Environment | `.env` |
| Databases | `data/` |
| Source Code | `src/` |
| React App | `frontend/` |

### Troubleshooting Quick Fixes

```bash
# Container won't start → Check .env exists with GROQ_API_KEY
# yt-dlp fails → Verify DNS settings in compose file
# Database error → Check ./data directory permissions
# React not loading → Rebuild with --build flag
# Port conflict → Check port 3000 not in use
# Memory issues → Increase Docker resource allocation
```

---

## Support

- **GitHub Issues:** https://github.com/dacown87/rezepti/issues
- **Docker Hub:** https://hub.docker.com/r/dacown/rezepti
- **Documentation:** https://github.com/dacown87/rezepti#readme

For debugging help, include:
1. Docker version (`docker --version`)
2. Docker Compose version (`docker compose version`)
3. Output of `docker compose --profile react config`
4. Relevant logs (`docker compose --profile react logs`)
5. Environment (non-sensitive parts of `.env`)
