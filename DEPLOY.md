# ========== Deployment Guide for Engineering Team ==========

# MoleculeOS Pioneer Partner Form - Deployment Guide
# This document is for the engineering team at 分子之心 (MoleculeMind)
# Prepared by Cynthia (市场及生态副总监) on 2026-06-29

## 1. What This Project Is

A mobile-first registration form for the AIBC conference campaign "MoleculeOS先锋伙伴共创计划":
- **Frontend**: Single-page HTML form (already built, mobile-optimized)
- **Backend**: Node.js Express server handling form submissions
- **Integration**: Auto-writes data to Feishu Bitable + sends Feishu IM/webhook notifications

## 2. What You Need to Deploy

### Server Requirements
- Any Linux server (Ubuntu 20.04+ recommended) with Docker installed
- Minimum: 1GB RAM, 1 CPU core, 10GB disk
- A domain/subdomain (e.g., `form.moleculemind.com`) if you want HTTPS
- Port 3000 accessible (or use Nginx reverse proxy for port 80/443)

### Feishu Credentials (Ask Cynthia for these)
These are stored in `.env` and must be configured before deployment:
| Variable | Description | Example |
|----------|-------------|---------|
| `FEISHU_APP_ID` | Feishu Open Platform App ID | `cli_xxxxxx` |
| `FEISHU_APP_SECRET` | Feishu Open Platform App Secret | (secret string) |
| `FEISHU_WEBHOOK_URL` | Group bot webhook URL | `https://open.feishu.cn/open-apis/hook/xxx` |
| `FEISHU_NOTIFY_OPEN_ID` | Your open_id for IM notification | `ou_xxxxxx` |
| `BITABLE_APP_TOKEN` | Feishu Bitable app token | `Ex7js7bjhh5elAtrlm1cPsd4nTd` |
| `BITABLE_TABLE_ID` | Feishu Bitable table ID | `tblxxxxxx` |
| `SPREADSHEET_APP_TOKEN` | (Fallback) Spreadsheet token | `Ex7js7bjhh5elAtrlm1cPsd4nTd` |
| `SPREADSHEET_SHEET_ID` | (Fallback) Sheet ID | (auto-detected if empty) |

## 3. Quick Deployment (Docker - Recommended)

### Step 1: Copy files to server
```bash
# On the server, create project directory
mkdir -p /opt/mos-form && cd /opt/mos-form

# Upload the project files (scp, git clone, or any method)
# Required files: Dockerfile, docker-compose.yml, server.js, feishu-api.js,
#                 package.json, package-lock.json, public/, .env.example
```

### Step 2: Create `.env` file
```bash
cp .env.example .env
# Edit .env with real Feishu credentials
vim .env
```

### Step 3: Build and run
```bash
docker compose up -d --build
```

### Step 4: Verify
```bash
# Check health
curl http://localhost:3000/api/health

# Check Feishu connection
curl http://localhost:3000/api/test-feishu

# Visit the form in browser
# http://localhost:3000
```

## 4. Production Setup (with Nginx + HTTPS)

If you want to serve on a domain like `form.moleculemind.com`:

### Step A: Nginx config
```nginx
server {
    listen 80;
    server_name form.moleculemind.com;

    # Redirect to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name form.moleculemind.com;

    ssl_certificate     /etc/ssl/certs/form.moleculemind.com.crt;
    ssl_certificate_key /etc/ssl/private/form.moleculemind.com.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Step B: Update docker-compose.yml
Change the ports section to only expose internally:
```yaml
ports:
  - "127.0.0.1:3000:3000"
```

### Step C: SSL certificates
Use certbot/Let's Encrypt for free SSL:
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d form.moleculemind.com
```

## 5. Alternative: Deploy Without Docker

If the server doesn't have Docker:
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Copy project files and install dependencies
cd /opt/mos-form
npm install --production

# Create .env
cp .env.example .env
vim .env  # fill in credentials

# Run with PM2 for process management
npm install -g pm2
pm2 start server.js --name mos-form
pm2 save
pm2 startup  # auto-start on reboot
```

## 6. Monitoring & Maintenance

- **Logs**: `docker compose logs -f` or `pm2 logs mos-form`
- **Restart**: `docker compose restart` or `pm2 restart mos-form`
- **Update**: Replace files and `docker compose up -d --build`
- **Health check endpoint**: `GET /api/health`
- **Feishu test endpoint**: `GET /api/test-feishu`

## 7. File Structure

```
mos-form-server/
├── Dockerfile              # Docker image config
├── docker-compose.yml      # Docker Compose deployment config
├── server.js               # Express backend server
├── feishu-api.js           # Feishu API integration module
├── package.json            # Node.js dependencies
├── package-lock.json       # Locked dependency versions
├── .env.example            # Environment variable template
├── DEPLOY.md               # This deployment guide
└── public/
    ├── index.html           # The form (mobile-optimized, self-contained)
    └── qrcode-form.png      # QR code image (optional, embedded in HTML)
```

## 8. Security Notes

- `.env` contains secrets — never commit it to git or share publicly
- The form frontend is self-contained (images/logos embedded as base64 in HTML)
- CORS is enabled for development; in production, restrict to the form domain
- Feishu App needs permissions: bitable:app:read/write, im:message:send_as_bot
