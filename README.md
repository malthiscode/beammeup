# BeamMeUp - BeamMP Server Admin Panel

A production-ready, fully Dockerized web admin panel for managing a BeamMP game server. Provides secure configuration management, mod uploading, user management, and comprehensive audit logging.

## Features

✅ **Secure Authentication**
- Argon2id password hashing (salted, per-password)
- JWT-based session management  
- HttpOnly, Secure, SameSite cookies
- CSRF protection on all mutations
- Rate limiting (login, authkey, mod uploads)
- Automatic session expiration (24 hours)

✅ **Configuration Management**
- Edit ServerConfig.toml through web UI
- Real-time validation (port ranges, time formats)
- "Save" and "Save + Restart Server" options
- Automatic timestamped backups
- Atomic file writes with temp file pattern
- Never expose AuthKey in responses (status-only display)
- Password-required AuthKey replacement

✅ **Mod Management**  
- Upload ZIP files with validation
- Zip-slip attack prevention
- SHA256 integrity verification
- Configurable file size limits (default 100MB)
- Upload history with user attribution
- File size display in human-readable format

✅ **User & Role Management**
- 4 role levels: Owner, Admin, Operator, Viewer
- Create, update, deactivate users
- Owner must exist (cannot delete last Owner)
- Inline user editing (role/status changes)
- Email tracking (optional)

✅ **Audit Logging**
- Full action tracking: who, what, when, IP address
- Config change diffs tracked
- Server restart logs
- Mod upload/delete history with user info
- User management actions
- Export as CSV for compliance

✅ **System Monitoring**
- Real-time server status (running/stopped)
- Uptime calculation and display
- Live log viewer (last N lines)
- System health checks (memory, database, processes)
- Diagnostics export (JSON/CSV) - Owner only

✅ **Ergonomic UI**
- Dark theme optimized for server admins
- Responsive design (mobile-friendly)
- Intuitive navigation with role-based menu
- Real-time status updates (10-second refresh)
- Unsaved changes warning (dirty state detection)
- Progress bars for long operations

✅ **Docker & Portability**
- Complete docker-compose setup
- Single port entry (8088 on localhost)
- Works out-of-the-box with `docker compose up -d --build`
- Windows Docker Desktop support (WSL2 / npipe)
- macOS/Linux native support
- Health checks included
- Persistent data volumes

## Tech Stack

**Backend:**
- Node.js 24 + TypeScript (strict mode)
- Fastify 5.2 (HTTP framework)
- Fastify-Helmet (security headers)
- Prisma 5 + SQLite (database)
- Argon2id (password hashing)
- TOML parser (config files)

**Frontend:**
- React 18.3 + TypeScript
- Vite 5.4 (build tool)
- Tailwind CSS 3.4 (styling)
- React Router (SPA routing)
- Axios (HTTP client)

**Infrastructure:**
- Docker & Docker Compose v2.20+
- Nginx (reverse proxy, security headers)
- SQLite 3 (persistent database)

## Quick Start

### Prerequisites

- **Docker Desktop** (v4.20+)
  - Windows: WSL2 backend required
  - macOS: Intel or Apple Silicon
  - Linux: Docker & Docker Compose installed
- **2GB RAM minimum** available
- **100MB disk space** (plus space for mods)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd beammeup
```

### 2. Configuration

#### Environment Variables

Copy the example file and customize:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Generate secure secrets with:
# openssl rand -base64 32

NODE_ENV=production
SESSION_SECRET=<your-secure-32-byte-secret>
FASTIFY_PORT=3000
DATABASE_URL=file:/app/data/beammeup.sqlite
REDIS_URL=  # Optional, leave empty for in-memory rate limiting
```

#### Docker Compose Port

The stack runs on **localhost:8088** by default. To change:

**File: `docker-compose.yml`**
```yaml
  proxy:
    ports:
      - "127.0.0.1:8088:80"  # Change 8088 to your desired port
```

### 3. Start the Stack

```bash
# Build and start all containers
docker compose up -d --build

# Wait for startup (20-30 seconds)
sleep 5

# View logs
docker compose logs -f
```

### 4. First-Run Setup

Navigate to **http://localhost:8088**

You'll be redirected to the setup page:

1. Create Owner account (username, password, optional email)
2. Set password confirmation
3. Click "Create Owner"
4. Log in with your new Owner credentials
5. Dashboard appears - ready to use!

### 5. Configure BeamMP

1. Go to **Config** tab
2. Edit ServerConfig.toml fields
3. Click "Save" to persist changes, or
4. Click "Save + Restart" to apply immediately

## Windows Docker Desktop Setup

### WSL2 Backend (Recommended)

1. **Enable WSL2:**
   - Install Windows Subsystem for Linux v2
   - Set as default: `wsl --set-default-version 2`

2. **Configure Docker Desktop:**
   - Settings > Resources > WSL Integration
   - Enable "Docker Desktop"
   - Select your Linux distro

3. **Run the Stack:**
   ```bash
   cd beammeup
   docker compose up -d --build
   # Access at http://localhost:8088
   ```

### Npipe Backend (Legacy)

For older Windows/Docker setups:

```bash
# Set Docker host to Windows pipe
set DOCKER_HOST=npipe:////./pipe/docker_engine

# Then run normally
docker compose up -d --build
```

## Self-Hosted / Caddy Configuration

For production deployment on your own server with Caddy reverse proxy:

### 1. Install BeamMeUp on Host

```bash
# On your Linux server
cd /opt/beammeup
docker compose up -d --build

# Verify it's running on port 3000 (backend) and 3001 (frontend)
docker compose ps
```

### 2. Caddy Config

**File: `/etc/caddy/Caddyfile`**

```caddyfile
admin.beammp.example.com {
    # Security headers
    header * {
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "no-referrer"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        Permissions-Policy "geolocation=(), microphone=(), camera=()"
    }

    # Reverse proxy to BeamMeUp
    reverse_proxy localhost:8088 {
        # WebSocket support (not needed currently, but safe to include)
        header_up Connection Upgrade
        header_up Upgrade websocket
        
        # Preserve client IP
        header_up X-Real-IP {http.request.remote.host}
        header_up X-Forwarded-For {http.request.header.X-Forwarded-For}
        header_up X-Forwarded-Proto {http.request.proto}
        
        # Timeouts
        transport http {
            dial_timeout 30s
            response_header_timeout 30s
        }
    }
}
```

### 3. Reload Caddy

```bash
caddy reload -c /etc/caddy/Caddyfile
```

### 4. Access

Navigate to **https://admin.beammp.example.com** (SSL auto-configured)

## Backup & Restore

### Automatic Backups

Config backups are created automatically:
- Every time you save changes
- Located in: `/app/data/backups/` (inside container)
- Format: `config_backup_YYYY-MM-DD_HH-MM-SS.toml`

### Manual Backup

```bash
# Backup all data
docker compose cp proxy:/app/data ./beammeup-backup

# Zip it
tar -czf beammeup-backup-$(date +%Y-%m-%d).tar.gz ./beammeup-backup
```

### Restore from Backup

```bash
# Stop containers
docker compose down

# Restore data
rm -rf ./data
tar -xzf beammeup-backup-*.tar.gz
mv ./beammeup-backup/data ./data

# Start again
docker compose up -d --build
```

### Database Restore

```bash
# If SQLite database is corrupted

# Stop containers
docker compose down

# Remove database
rm ./data/beammeup.sqlite

# Remove migrations (will regenerate)
rm ./backend/prisma/migrations -rf

# Restart
docker compose up -d --build
# Migrations run automatically on startup

# Create new Owner account at http://localhost:8088
```

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 8088
lsof -i :8088  # macOS/Linux
netstat -anbo | findstr :8088  # Windows

# Change port in docker-compose.yml:
# ports:
#   - "127.0.0.1:9999:80"  # Use 9999 instead
```

### Can't Connect After Restart

```bash
# View container logs
docker compose logs -f

# Check if containers are running
docker compose ps

# Restart everything
docker compose restart

# Or full rebuild
docker compose down
docker compose up -d --build
```

### Authentication Loop / Session Expired

```bash
# Clear browser cookies
# Settings > Privacy > Cookies > Clear All for localhost:8088

# Or clear localStorage
# Open DevTools (F12) > Console > type:
# localStorage.clear()
```

### Database Locked Error

```bash
# SQLite lock timeout - try restarting
docker compose restart backend

# If persistent, check disk space
df -h ./data
```

### Can't Upload Mods

```bash
# Check file size limit (default 100MB)
ls -lh mod-file.zip

# Check disk space
df -h ./data

# Check logs
docker compose logs backend | grep -i upload
```

## Security Hardening

### Environment

- ✅ Secrets in `.env` (never commit)
- ✅ `SESSION_SECRET` must be 32+ bytes, random
- ✅ Passwords: 8-256 chars, Argon2id hashing
- ✅ HTTPS enforced in production (via Caddy/load balancer)

### Network

- ✅ Only port 8088 exposed to localhost
- ✅ Reverse proxy handles CORS
- ✅ X-Frame-Options: DENY (no iframes)
- ✅ CSP headers enabled (Fastify Helmet)
- ✅ HSTS preload ready

### Database

- ✅ No plaintext passwords (Argon2id salted)
- ✅ Session tokens JWT-signed
- ✅ Audit trail immutable (append-only)
- ✅ Automatic cleanup: expired sessions

### API

- ✅ CSRF tokens on all POST/PUT/DELETE
- ✅ Rate limiting: login (5/15min), authkey (3/1h)
- ✅ Input validation on all endpoints
- ✅ No secrets in error messages
- ✅ No secrets in logs (redacted)
- ✅ Request timeout: 30 seconds

## System Monitoring

### Health Check

```bash
# API endpoint (Operator+ access)
curl http://localhost:8088/api/diagnostics/health

# Returns:
{
  "timestamp": "2026-02-03T...",
  "uptime": 3600,
  "memory": {...},
  "database": {"connected": true},
  "version": "1.0.0"
}
```

### Export Diagnostics

Available to Owner role only:

- Via UI: Admin > Diagnostics > Export JSON / Export CSV
- Via API: `GET /api/diagnostics/export?format=json|csv`

Includes:
- System info (uptime, memory, node version)
- Database statistics (user count, audit logs)
- Recent audit actions breakdown
- Health checks (database, owner exists, etc.)

## Testing

```bash
# Run backend tests
docker compose exec backend npm test

# Run frontend tests
docker compose exec frontend npm test

# Run e2e tests (if configured)
npm run test:e2e
```

## API Endpoints

### Authentication
- `GET /api/auth/csrf` - Get CSRF token
- `POST /api/auth/login` - Login (rate limited 5/15min)
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Configuration
- `GET /api/config/current` - Read config (no AuthKey)
- `PUT /api/config/update` - Update config + validate
- `POST /api/config/authkey-replace` - Replace key (re-auth required)
- `GET /api/config/authkey-status` - Check if key is set

### Server Control
- `GET /api/server/status` - Get container status
- `POST /api/server/restart` - Restart BeamMP
- `GET /api/server/logs` - Tail container logs

### Mods
- `GET /api/mods/list` - List uploaded mods
- `POST /api/mods/upload` - Upload ZIP (Owner/Admin only, rate limited 10/1h)
- `DELETE /api/mods/:id` - Delete mod (Owner/Admin only)

### Users
- `GET /api/users/list` - List users (Owner/Admin only)
- `POST /api/users/create` - Create user (Owner/Admin only)
- `PUT /api/users/:id` - Update user (Owner/Admin only)
- `DELETE /api/users/:id` - Delete user (Owner/Admin only, can't delete last Owner)

### Audit
- `GET /api/audit/logs` - Get audit trail
- `GET /api/audit/export` - Export as CSV

### Diagnostics
- `GET /api/diagnostics/health` - System health (Operator+)
- `GET /api/diagnostics/export` - Full diagnostics (Owner only)

## Development

### Project Structure

```
beammeup/
├── backend/
│   ├── src/
│   │   ├── auth/          # JWT + Argon2 password
│   │   ├── middleware/    # CSRF, session, auth, logging
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic
│   │   ├── lib/           # Validation, sanitization
│   │   └── index.ts       # Fastify setup
│   ├── prisma/            # Database schema + migrations
│   ├── tests/             # Unit tests
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/         # React pages (Login, Dashboard, etc.)
│   │   ├── components/    # Reusable components
│   │   ├── lib/           # API client, auth context
│   │   ├── App.tsx        # Router setup
│   │   └── main.tsx       # Entry point
│   ├── index.css          # Tailwind styles
│   └── package.json
│
├── docker-compose.yml     # Container orchestration
├── nginx.conf             # Reverse proxy config
└── README.md              # This file
```

### Running in Development

```bash
# Terminal 1: Backend
cd backend
npm install
npm run dev

# Terminal 2: Frontend
cd frontend
npm install
npm run dev

# Terminal 3: Database migrations
cd backend
npx prisma migrate dev

# Access at http://localhost:5173 (Vite dev server)
```

## Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set `SESSION_SECRET` to strong 32-byte random value
- [ ] Update database backups location if using NFS
- [ ] Configure reverse proxy (Caddy/Nginx) with HTTPS
- [ ] Test email notifications (if configured)
- [ ] Set resource limits in docker-compose.yml
- [ ] Enable log rotation for Docker volumes
- [ ] Document admin procedures for your team
- [ ] Test backup/restore procedure
- [ ] Monitor system resources first week
- [ ] Schedule periodic backups (cron job)

## License

ISC - See LICENSE file

## Support

- **Issues**: Create GitHub issue
- **Questions**: Check README > Troubleshooting
- **Security**: Report privately to maintainers

---

**Last Updated**: February 2026 | **Version**: 1.0.0

- Supports Windows Docker Desktop with npipe
- Persistent data volumes
- BeamMP in separate container with shared volume

## Tech Stack

**Backend:**
- Node.js 24 + TypeScript
- Fastify (HTTP framework)
- Prisma + SQLite (database)
- Argon2 (password hashing)
- TOML parser

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- React Router (SPA routing)
- Axios (HTTP client)

**Infrastructure:**
- Docker & Docker Compose
- Nginx (reverse proxy)

## Quick Start

### Prerequisites

- Docker & Docker Compose
- For Windows: Docker Desktop with WSL2 backend

### Installation

1. **Clone/setup the repository**

```bash
cd beammeup
```

2. **Create environment file**

```bash
cp .env.example .env
```

Edit `.env` and set a secure `SESSION_SECRET`:

```bash
# Generate one with:
openssl rand -base64 32

# For Windows Docker Desktop, update DOCKER_HOST:
# DOCKER_HOST=npipe:////./pipe/docker_engine
```

3. **Start all services**

```bash
docker compose up -d --build
```

This will:
- Build and start the backend (Port 3000)
- Build and start the frontend
- Start nginx proxy (Port 80)
- Start BeamMP container (if image exists)

4. **Initialize database**

```bash
docker exec beammeup-backend npx prisma migrate deploy
```

5. **Access the app**

Open http://localhost in your browser

6. **First-run setup**

When no users exist, you'll be directed to `/setup` to create the first Owner account.

## API Endpoints

### Authentication

```
POST   /api/auth/login            - Login with credentials
POST   /api/auth/logout           - Logout
GET    /api/auth/me               - Get current user
```

### Setup

```
GET    /api/setup/status          - Check if setup is needed
POST   /api/setup/create-owner    - Create first user (Owner)
```

### Configuration

```
GET    /api/config/current        - Get current ServerConfig (no AuthKey)
PUT    /api/config/update         - Update config (OWNER/ADMIN/OPERATOR)
GET    /api/config/authkey-status - Check if AuthKey is set
POST   /api/config/authkey-replace - Replace AuthKey (OWNER/ADMIN only)
```

### Server Control

```
GET    /api/server/status         - Get server status
POST   /api/server/restart        - Restart BeamMP container (OWNER/ADMIN only)
```

### Mods

```
GET    /api/mods/list             - List uploaded mods
POST   /api/mods/upload           - Upload mod ZIP (OWNER/ADMIN/OPERATOR)
DELETE /api/mods/:id              - Delete mod (OWNER/ADMIN/OPERATOR)
```

### Users

```
GET    /api/users/list            - List users (OWNER/ADMIN only)
POST   /api/users/create          - Create user (OWNER/ADMIN only)
PUT    /api/users/:id             - Update user (OWNER/ADMIN only)
DELETE /api/users/:id             - Delete user (OWNER/ADMIN only)
```

### Audit

```
GET    /api/audit/logs            - Get audit logs (OWNER/ADMIN only)
GET    /api/audit/export          - Export logs as CSV (OWNER/ADMIN only)
```

### Health

```
GET    /health                    - Health check endpoint
```

## Security Features

### Password Hashing

All passwords are hashed with Argon2id using:
- Time Cost: 3 iterations
- Memory Cost: 65536 KB
- Parallelism: 4

### Session Management

- JWT tokens signed with configurable secret
- 24-hour expiration
- Stored in localStorage (frontend)
- Validated on every request

### Rate Limiting

- 100 requests per 15 minutes (configurable)
- Whitelisted: 127.0.0.1
- Applied to all endpoints except `/health`

### CSRF Protection

- All state-changing requests require JWT authentication
- Helmet security headers enabled
- Content Security Policy configured

### Authorization

Strict role-based access control:

| Role | Permissions |
|------|-------------|
| Owner | All actions, user management, system config |
| Admin | All except user deletion, system config |
| Operator | Config changes, mod uploads, server restart |
| Viewer | Read-only access to config and logs |

### Audit Logging

Every privileged action is logged with:
- User ID
- Action type
- Resource and resource ID
- IP address and user agent
- Config change diffs
- Timestamp (precise to millisecond)

Logged actions:
- `CONFIG_VIEW` - Viewing configuration
- `CONFIG_UPDATE` - Updating configuration with diff
- `SERVER_RESTART` - Server restart command
- `MOD_UPLOAD` - Mod file upload
- `MOD_DELETE` - Mod file deletion
- `USER_CREATE` - User account creation
- `USER_UPDATE` - User modification
- `USER_DELETE` - User deletion
- `USER_LOGIN` - User authentication
- `USER_LOGOUT` - User logout
- `AUTHKEY_REPLACE` - AuthKey replacement

### File Safety

**Configuration:**
- Atomic writes using temp file + rename pattern
- Automatic timestamped backups before each write
- TOML validation before write

**Mod Uploads:**
- ZIP file validation
- Zip-slip attack prevention (path traversal)
- SHA256 integrity verification
- File size limits (100MB default)
- Secure filename generation

**AuthKey Handling:**
- NEVER returned in API responses
- ONLY settable via dedicated replace endpoint
- Requires owner/admin role
- Logged to audit trail

## Database Schema

SQLite database with tables:

- `users` - User accounts with role and status
- `sessions` - JWT session tokens
- `config_backups` - Config file history
- `mod_files` - Uploaded mod metadata
- `audit_logs` - Complete action audit trail

## Configuration

### Environment Variables

```env
# Server
NODE_ENV=production
FASTIFY_PORT=3000

# Security
SESSION_SECRET=<32+ character random string>

# BeamMP
BEAMMP_CONTAINER_NAME=beammp
BEAMMP_CONFIG_PATH=/beammp/ServerConfig.toml
BEAMMP_RESOURCES_PATH=/beammp/Resources

# Database
DATABASE_URL=file:/app/data/beammeup.db

# Docker
DOCKER_HOST=unix:///var/run/docker.sock
# (Windows: npipe:////./pipe/docker_engine)

# Password Hashing
ARGON2_TIME_COST=3
ARGON2_MEMORY_COST=65536
ARGON2_PARALLELISM=4
```

### ServerConfig.toml Fields

The following BeamMP config fields are managed by the UI:

**[General]**
- Port (int) - Server port
- AllowGuests (bool) - Allow guest players
- LogChat (bool) - Enable chat logging
- Debug (bool) - Debug mode
- IP (string) - Server IP to bind to
- Private (bool) - Private server flag
- InformationPacket (int) - Info packet type
- Name (string) - Server display name
- Tags (array) - Server tags/categories
- MaxCars (int) - Max cars per player
- MaxPlayers (int) - Max connected players
- Map (string) - Default map
- Description (string) - Server description
- ResourceFolder (string) - Mod resource path
- AuthKey (string) - Server auth token (managed separately)

**[Misc]**
- ImScaredOfUpdates (bool) - Disable auto-updates
- UpdateReminderTime (int) - Update check interval

## Volumes & Paths

```
beammeup/
├── data/                    # Persistent data (SQLite, backups)
│   ├── beammeup.db
│   └── config-backups/      # Timestamped config backups
└── /beammp/                 # Shared with BeamMP container
    ├── ServerConfig.toml    # Main config file
    └── Resources/
        └── Client/          # Uploaded mods
```

## Development

### Local Development

**Backend:**

```bash
cd backend
npm install
npm run dev                 # Start with tsx watch
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev                # Start Vite dev server with hot reload
```

Both will be available at http://localhost:5173 (frontend with proxy to backend).

### Testing

**Backend Tests:**

```bash
cd backend
npm test                   # Run vitest
npm run test:watch        # Watch mode
```

**Test Coverage:**
- Password hashing (argon2 verification)
- Authentication (login/logout/JWT)
- First-run setup flow
- Config CRUD operations
- Audit logging

### Linting

```bash
npm run lint              # Check code style (eslint + prettier)
```

## Docker Commands

### Build from scratch

```bash
docker compose up -d --build
```

### View logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f proxy
```

### Access backend shell

```bash
docker exec -it beammeup-backend sh
```

### Reset database

```bash
docker exec beammeup-backend npm run db:reset
```

### Stop all services

```bash
docker compose down
```

### Rebuild after code changes

```bash
docker compose up -d --build
```

## Windows Docker Desktop Setup

1. **Enable WSL2 backend**
   - Settings → Resources → WSL Integration

2. **Update `.env` for npipe:**

```env
DOCKER_HOST=npipe:////./pipe/docker_engine
```

3. **Ensure BeamMP volume is accessible**
   - BeamMP container should use WSL distro mount path
   - Example: `\\wsl$\docker-desktop\mnt\wsl\path\to\beammp`

4. **Run docker compose:**

```bash
docker compose up -d --build
```

## Monitoring

### Health Check

```bash
curl http://localhost/health
# { "status": "ok" }
```

### Log Files

Inside containers:
- Backend: stdout via Docker logs
- Frontend: Access logs via nginx
- Database: SQLite file at `/app/data/beammeup.db`

### Audit Trail

Export audit logs as CSV from UI:
- Login → Users/Audit → Export as CSV
- Or via API: `GET /api/audit/export`

## Troubleshooting

### Can't connect to BeamMP container

Check Docker socket mount:
```bash
docker exec beammeup-backend ls -la /var/run/docker.sock
```

For Windows, verify npipe path in `.env`.

### Database locked error

SQLite file is in use. Ensure no other instances are running:

```bash
docker compose down
docker compose up -d --build
```

### Config changes not applied

1. Verify config file permissions: `chmod 664 /beammp/ServerConfig.toml`
2. Check audit log for errors
3. Restart server via UI: "Save & Restart Server"

### AuthKey not being saved

Use the dedicated endpoint POST `/api/config/authkey-replace` with Owner/Admin role.
Standard config update endpoint filters out AuthKey.

### Login not working

1. Verify users exist: `docker exec beammeup-backend npm run db:reset` (resets all)
2. Check audit logs for failed attempts
3. Verify SESSION_SECRET is set in `.env`

## Performance

- SQLite optimized with indexes on audit logs
- JWT tokens cached in browser
- Nginx gzip compression enabled
- Reverse proxy caching for static assets
- Database connection pooling via Prisma

## Backup & Recovery

### Automatic Config Backups

Every config update creates timestamped backup:
```
/app/data/config-backups/backup-2024-02-03T15-30-45-123.toml
```

### Manual Backup

```bash
docker exec beammeup-backend sh -c 'cp -r data /backup-$(date +%Y%m%d)'
```

### Restore Database

```bash
docker compose down
# Copy backup to /app/data/beammeup.db
docker compose up -d
```

## Production Deployment

### Hardening Checklist

- [ ] Change SESSION_SECRET to secure random value
- [ ] Use HTTPS/TLS (add to nginx.conf)
- [ ] Set NODE_ENV=production
- [ ] Run health checks: `curl http://localhost/health`
- [ ] Configure log rotation
- [ ] Set up monitoring/alerts
- [ ] Regular backup schedule
- [ ] Test disaster recovery
- [ ] Review audit logs regularly

### SSL/TLS Setup

Add to `docker-compose.yml` volumes:
```yaml
volumes:
  - ./certs/cert.pem:/etc/nginx/certs/cert.pem
  - ./certs/key.pem:/etc/nginx/certs/key.pem
```

Update `nginx.conf`:
```nginx
listen 443 ssl http2;
ssl_certificate /etc/nginx/certs/cert.pem;
ssl_certificate_key /etc/nginx/certs/key.pem;
```

## License

MIT

## Support

For issues or questions:
1. Check audit logs for error details
2. Review Docker logs: `docker compose logs`
3. Verify file permissions on shared volumes
4. Test API endpoints with curl or Postman

---

**BeamMeUp v1.0.0** - Production-Ready BeamMP Server Admin Panel
