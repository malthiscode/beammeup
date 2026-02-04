# BeamMeUp Deployment & Hardening Guide

## Pre-Deployment Checklist

### Security Configuration

- [ ] **Secrets Management**
  ```bash
  # Generate a strong SESSION_SECRET (32+ bytes)
  openssl rand -base64 32
  
  # Never commit .env to git
  echo ".env" >> .gitignore
  git rm --cached .env  # Remove if already tracked
  ```

- [ ] **Environment Variables**
  ```bash
  # .env (never commit to git)
  NODE_ENV=production
  SESSION_SECRET=<your-32-byte-random-secret>
  FASTIFY_PORT=3000
  ```

- [ ] **HTTPS Configuration**
  - Set up Caddy with SSL
  - Use Let's Encrypt (automatic renewal)
  - Enforce HTTPS redirect

- [ ] **Database Backup**
  - Test backup & restore procedure
  - Schedule automated daily backups
  - Store backups offsite (S3, etc.)

### Infrastructure

- [ ] **Resource Limits**
  ```yaml
  # docker-compose.yml
  services:
    backend:
      deploy:
        resources:
          limits:
            cpus: '2'
            memory: 2G
  ```

- [ ] **Log Rotation**
  ```json
  // /etc/docker/daemon.json
  {
    "log-driver": "json-file",
    "log-opts": {
      "max-size": "100m",
      "max-file": "5"
    }
  }
  ```

- [ ] **Network Isolation**
  - Only expose port 80/443 to public (Caddy)
  - Restrict SSH to admin IPs
  - Use firewall rules

- [ ] **Health Monitoring**
  ```bash
  # Monitor endpoint (Operator+ access)
  curl http://localhost:8200/api/diagnostics/health
  ```

---

## Quick Deployment (5 minutes)

### 1. Prerequisites

```bash
- Docker & Docker Compose v2.20+
- 2GB RAM available
- 100MB+ disk space
- Ports 8200/8201 available (backend/frontend)
- Ports 8200/8201 available (backend/frontend)
```

### 2. Environment Setup

```bash
cd beammeup

# Copy example and customize
cp .env.example .env

# Edit .env with secure values
nano .env

# Should contain:
# NODE_ENV=production
# SESSION_SECRET=<32-byte-random>
# FASTIFY_PORT=3000
```

### 3. Deploy

```bash
# Build and start all services
docker compose up -d --build

# Wait for initialization
sleep 10

# Verify services
docker compose ps

# Check logs
docker compose logs -f backend

# Access at http://localhost:8201 (or your Caddy domain)
```

### 4. First-Run Setup

- Navigate to http://localhost:8201 (or your Caddy domain)
- Create Owner account
- Log in with your credentials
- Configure BeamMP via Config tab

---

## Production Deployment

### Linux Server Setup

```bash
# Ubuntu 22.04 LTS recommended
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Caddy (for HTTPS)
sudo apt install -y caddy

# Create app directory
sudo mkdir -p /app/beammeup
sudo chown $USER:$USER /app/beammeup

cd /app/beammeup
git clone <repo> .
```

### Environment Configuration

```bash
# Generate secrets
SESSION_SECRET=$(openssl rand -base64 32)

# Create .env
cat > .env << EOF
NODE_ENV=production
SESSION_SECRET=$SESSION_SECRET
FASTIFY_PORT=3000
BEAMMP_TOKEN=

# Secure permissions
chmod 600 .env
```

### Caddy Configuration

**File: `/etc/caddy/Caddyfile`**

```caddyfile
admin.beammp.example.com {
    # HTTPS auto-configured by Caddy (Let's Encrypt)
    
    # Security headers
    header * {
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "no-referrer"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        Permissions-Policy "geolocation=(), microphone=(), camera=()"
        Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
    }

    # API routes to backend
    handle /api/* {
        reverse_proxy localhost:8200 {
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            
            transport http {
                dial_timeout 30s
                response_header_timeout 30s
            }
        }
    }

    # All other routes to frontend (SPA)
    handle {
        reverse_proxy localhost:8201 {
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }
}
```

```bash
# Validate and reload
sudo caddy fmt
sudo systemctl reload caddy
sudo systemctl status caddy
```

### Start Application

```bash
cd /app/beammeup

# Start services
docker compose up -d --build

# Verify health
sleep 10
curl http://localhost:8200/health  # Backend
curl http://localhost:8201  # Frontend

# Monitor logs
docker compose logs -f
```

---

## Hardening Guide

### Network Security

**Firewall (UFW)**

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (change port if needed)
sudo ufw allow 22/tcp

# Allow HTTPS (Caddy)
sudo ufw allow 80/tcp   # HTTP redirect
sudo ufw allow 443/tcp  # HTTPS

# Enable firewall
sudo ufw enable
sudo ufw status
```

**Close Direct Ports**

```bash
# Block direct access to containers
sudo ufw deny 3000/tcp  # Backend
sudo ufw deny 3001/tcp  # Frontend
```

### System Security

**SSH Hardening**

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Disable password auth (use key-based instead)
PasswordAuthentication no
PubkeyAuthentication yes

# Disable root login
PermitRootLogin no

# Change port (optional)
Port 2222

# Restart SSH
sudo systemctl restart sshd
```

**File Permissions**

```bash
# Restrict .env to owner only
chmod 600 /app/beammeup/.env

# Make data directory restrictive
chmod 750 /app/beammeup/data
find /app/beammeup/data -type f -exec chmod 640 {} \;
```

**Automatic Updates**

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Check status
sudo unattended-upgrade -d
```

### Application Security

**Verify No Secrets in Logs**

```bash
# Check for password/token leaks
docker compose logs | grep -i password
docker compose logs | grep -i token
docker compose logs | grep -i secret

# Should return: (no results)
```

**Database Backup Strategy**

```bash
#!/bin/bash
# /app/beammeup/backup.sh

BACKUP_DIR=/backups/beammeup
mkdir -p $BACKUP_DIR

# Backup database
docker compose exec -T backend tar czf \
  /app/data/backup-$(date +%Y%m%d-%H%M%S).tar.gz \
  /app/data

# Keep only 30 days
find $BACKUP_DIR -mtime +30 -delete

# Upload to S3 (optional)
aws s3 sync $BACKUP_DIR s3://my-backups/beammeup/ --delete
```

```bash
chmod +x /app/beammeup/backup.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# 0 2 * * * /app/beammeup/backup.sh
```

**Certificate Management**

```bash
# Caddy auto-renews certificates
# Monitor expiration:
sudo caddy list-certs

# Manual renewal if needed:
sudo caddy renew --force

# Alert on renewal failure:
# Add to monitoring script
```

### Monitoring & Alerting

**Health Check Script**

```bash
#!/bin/bash
# /app/beammeup/monitor.sh

HEALTH=$(curl -s http://localhost:8200/api/diagnostics/health)
DATABASE=$(echo $HEALTH | jq -r '.database.connected // false')

if [ "$DATABASE" != "true" ]; then
  echo "⚠️  Database unhealthy" | mail -s "BeamMeUp Alert" admin@example.com
  docker compose restart backend
  exit 1
fi

echo "✓ Health check passed"
```

```bash
# Add to crontab (every 5 minutes)
sudo crontab -e
# */5 * * * * /app/beammeup/monitor.sh
```

**Log Monitoring**

```bash
# Check for errors
docker compose logs --tail=100 backend | grep -i error

# Check for auth failures
docker compose logs backend | grep "401\|403"

# Export for analysis
docker compose logs backend > /var/log/beammeup-backend.log
```

### Database Hardening

**SQLite Optimization**

```bash
# Enable WAL mode (better concurrency)
docker compose exec backend sqlite3 /app/data/beammeup.sqlite << EOF
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
EOF
```

**PostgreSQL Alternative** (for high-traffic)

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: beammeup
      POSTGRES_USER: beammeup
      POSTGRES_PASSWORD: <secure-password>
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - beammeup

volumes:
  postgres-data:
```

```bash
# Update .env
DATABASE_URL=postgresql://beammeup:<password>@postgres:5432/beammeup
```

### Rate Limiting Configuration

Default limits (configured in backend routes):

```
- Login: 5 attempts / 15 minutes
- AuthKey replacement: 3 attempts / 1 hour  
- Mod uploads: 10 uploads / 1 hour
```

To adjust:
- Backend: `backend/src/routes/{auth,config,mods}.ts`
- Restart: `docker compose restart backend`

---

## Backup & Restore

### Automated Backup

```bash
#!/bin/bash
# /app/beammeup/backup.sh

BACKUP_DIR=/backups/beammeup
mkdir -p $BACKUP_DIR

# Full data backup
tar -czf $BACKUP_DIR/beammeup-$(date +%Y-%m-%d-%H%M%S).tar.gz \
  /app/beammeup/data \
  /app/beammeup/.env

# Keep last 30 days only
find $BACKUP_DIR -mtime +30 -delete

echo "✓ Backup complete"
```

### Manual Backup

```bash
# Backup all data
docker compose cp backend:/app/data ./backup-$(date +%Y%m%d)

# Or tar it
cd /app/beammeup
tar -czf /backups/beammeup-$(date +%Y%m%d-%H%M%S).tar.gz data/
```

### Restore from Backup

```bash
# Stop containers
docker compose down

# Restore data
rm -rf data/
tar -xzf /backups/beammeup-*.tar.gz

# Restart
docker compose up -d --build

# Verify
curl http://localhost:8200/api/diagnostics/health
```

### Database Corruption Recovery

```bash
# If SQLite corrupted

# 1. Stop services
docker compose down

# 2. Delete corrupted database
rm data/beammeup.sqlite

# 3. Reset migrations
rm -rf backend/prisma/migrations

# 4. Start (will regenerate schema)
docker compose up -d --build

# 5. Create new Owner at http://localhost:8201 (or your Caddy domain)
```

---

## Scaling & Performance

### Resource Limits

```yaml
# docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
  
  frontend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
```

### Database Performance

```bash
# Check query performance
docker compose exec backend sqlite3 /app/data/beammeup.sqlite << EOF
.timer on
SELECT * FROM audit_logs LIMIT 100;
EOF
```

### Memory Optimization

```bash
# Node.js heap size
# docker-compose.yml
backend:
  environment:
    NODE_OPTIONS: "--max-old-space-size=2048"
```

---

## Incident Response

### If Database Fails

```bash
# 1. Check status
docker compose ps

# 2. Check disk space
df -h

# 3. Restart backend
docker compose restart backend

# 4. If persists, restore backup
./restore-backup.sh latest
```

### If Security Breach Suspected

```bash
# 1. Export audit logs immediately
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8200/api/audit/export > audit-$(date +%s).csv

# 2. Change all user passwords (via UI)
# Admin > Users > Edit each user

# 3. Revoke sessions
docker compose restart backend

# 4. Review audit logs for suspicious actions
```

### If Server Compromised

```bash
# 1. Isolate from network
sudo ufw deny from any to any

# 2. Create forensic backup
sudo tar -czf /backups/forensics-$(date +%s).tar.gz /app/beammeup

# 3. Redeploy on clean server
# Follow fresh installation steps above

# 4. Analyze audit logs for attack timeline
```

---

## Compliance

### GDPR Compliance

- ✅ Data stored locally (no third-party cloud)
- ✅ Full audit trail (who/what/when)
- ✅ User data exportable (diagnostics endpoint)
- ✅ User deletion cascades to records
- ✅ Data retention configurable

### Audit Log Retention

```sql
-- Keep audit logs for 1 year (customize as needed)
DELETE FROM "AuditLog" 
WHERE "createdAt" < datetime('now', '-1 year');
```

### Data Protection

- Passwords: Argon2id with 3 iterations, 65536 KB memory, per-salt
- Sessions: JWT signed, 24-hour expiration
- CSRF: Random 32-byte tokens per session
- Encryption: SQLite at rest (or encrypted volume)

---

## Troubleshooting

### Port Already in Use

```bash
# Check what's using ports
lsof -i :8200  # Backend
lsof -i :8201  # Frontend

# Change port in docker-compose.yml:
ports:
  - "127.0.0.1:9999:80"
```

### Services Won't Start

```bash
# Check Docker daemon
docker ps

# View logs
docker compose logs

# Rebuild everything
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

### Database Locked

```bash
# SQLite lock timeout
docker compose down
sleep 5
docker compose up -d
```

### High Memory Usage

```bash
# Check stats
docker stats

# Reduce if needed
docker compose restart backend

# Check for memory leaks
docker compose logs backend | grep -i memory
```

### Can't Connect via HTTPS

```bash
# Caddy certificate issue
sudo caddy renew --force

# Check certificate
sudo caddy list-certs

# Restart Caddy
sudo systemctl restart caddy
```

---

## Support & Documentation

- **README.md** - Quick start, features, API reference
- **ARCHITECTURE.md** - Design decisions, tech stack
- **DEPLOYMENT.md** - This file
- **DOCUMENTATION_INDEX.md** - File structure guide

**Get Help:**
1. Check README > Troubleshooting section
2. Review container logs: `docker compose logs -f`
3. Export diagnostics: `curl http://localhost:8200/api/diagnostics/export`
4. Create issue with diagnostics output

---

**Version**: 1.0.0 | **Last Updated**: February 2026


---

## Windows Docker Desktop Setup

### Prerequisites
- Docker Desktop for Windows (WSL2 backend)
- 4GB+ RAM allocated to WSL2

### Configuration

1. **Update .env:**

```bash
# For Windows npipe
DOCKER_HOST=npipe:////./pipe/docker_engine
```

2. **Verify Docker socket:**

```powershell
docker ps  # Should work without error
```

3. **Deploy:**

```bash
docker compose up -d --build
```

---

## Production Hardening

### 1. Security

**Environment Variables:**

```env
NODE_ENV=production
SESSION_SECRET=<generate-with: openssl rand -base64 32>
FASTIFY_PORT=3000

# Argon2 settings (increase for better security)
ARGON2_TIME_COST=4
ARGON2_MEMORY_COST=131072  # 128MB
ARGON2_PARALLELISM=8
```

### 2. HTTPS/TLS (Caddy)

**Caddy handles TLS automatically (Let's Encrypt):**

```caddyfile
admin.beammp.example.com {
  # Security headers
  header * {
    X-Frame-Options "DENY"
    X-Content-Type-Options "nosniff"
    X-XSS-Protection "1; mode=block"
    Referrer-Policy "no-referrer"
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
  }

  # API routes
  handle /api/* {
    reverse_proxy localhost:8200
  }

  # Frontend (SPA)
  handle {
    reverse_proxy localhost:8201
  }
}
```

```bash
sudo caddy reload -c /etc/caddy/Caddyfile
```

### 3. Backups

**Automated daily backup:**

```bash
# Create backup directory
mkdir -p backups

# Add to crontab (Linux/Mac)
# 0 2 * * * cd /path/to/beammeup && ./backup.sh

# backup.sh
#!/bin/bash
docker exec beammeup-backend tar czf \
  /app/data/backups/beammeup-$(date +\%Y\%m\%d-\%H\%M\%S).tar.gz \
  /app/data
```

**Offsite backup (AWS S3):**

```bash
aws s3 sync data/backups/ \
  s3://my-backup-bucket/beammeup-prod/ \
  --delete --region us-east-1
```

### 4. Monitoring

**Health check:**

```bash
# Automated monitoring
watch -n 60 'curl -s http://localhost/health'
```

**Log monitoring:**

```bash
# Stream logs
docker compose logs -f --tail=50

# Check for errors
docker compose logs backend | grep -i error

# Export logs
docker compose logs > logs-$(date +%Y%m%d).txt
```

### 5. Resource Limits

**Update docker-compose.yml:**

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
  
  frontend:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
```

---

## Scaling

### Horizontal Scaling

**Multiple backend instances:**

```yaml
# docker-compose.yml
services:
  backend-1:
    build: ./backend
    environment:
      INSTANCE_ID: 1
    
  backend-2:
    build: ./backend
    environment:
      INSTANCE_ID: 2
  
  backend-3:
    build: ./backend
    environment:
      INSTANCE_ID: 3
  
  # Use an external reverse proxy (Caddy) for load balancing
```

**Shared database:**

```yaml
# Use network filesystem or cloud database
DATABASE_URL=postgresql://user:pass@cloud-db.example.com/beammeup
```

### Vertical Scaling

**Increase compute:**

```env
# Add more resources in docker-compose.yml
resources:
  limits:
    cpus: '4'
    memory: 2G
```

**Database optimization:**

```typescript
// Increase Argon2 costs (slower = safer)
ARGON2_TIME_COST=5
ARGON2_MEMORY_COST=262144  # 256MB
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check Docker daemon
docker ps

# Check logs
docker compose logs

# Rebuild images
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

### Database Locked

```bash
# SQLite file is in use
docker compose down
sleep 5
docker compose up -d
```

### Authentication Issues

```bash
# Reset database
docker exec beammeup-backend npm run db:reset

# Verify migrations
docker exec beammeup-backend npx prisma migrate status
```

### High Memory Usage

```bash
# Check container stats
docker stats

# Reduce Argon2 costs
ARGON2_TIME_COST=3
ARGON2_MEMORY_COST=65536

# Restart
docker compose down && docker compose up -d
```

### Configuration Not Applying

```bash
# Check config file permissions
docker exec beammeup-backend ls -la /beammp/ServerConfig.toml

# Restart server via UI
# Or: docker restart beammp

# Check audit log for errors
docker exec beammeup-backend sqlite3 /app/data/beammeup.db \
  "SELECT * FROM audit_logs ORDER BY createdAt DESC LIMIT 10;"
```

---

## Maintenance

### Regular Tasks

**Weekly:**
- [ ] Check available disk space: `df -h`
- [ ] Review audit logs for suspicious activity
- [ ] Verify backups are being created

**Monthly:**
- [ ] Update Docker images: `docker compose pull && docker compose up -d`
- [ ] Review and delete old backups
- [ ] Test restore procedure

**Quarterly:**
- [ ] Update dependencies: `npm update`
- [ ] Security audit: Review audit logs
- [ ] Disaster recovery drill

### Database Maintenance

**SQLite Optimization:**

```bash
docker exec beammeup-backend sqlite3 /app/data/beammeup.db << EOF
-- Analyze query performance
ANALYZE;

-- Vacuum to reclaim space
VACUUM;

-- Check integrity
PRAGMA integrity_check;
EOF
```

**Cleanup Old Data:**

```sql
-- Delete audit logs older than 1 year
DELETE FROM audit_logs 
WHERE createdAt < date('now', '-1 year');

-- Delete old config backups (keep last 100)
DELETE FROM config_backups 
WHERE id NOT IN (
  SELECT id FROM config_backups 
  ORDER BY createdAt DESC LIMIT 100
);
```

---

## Migration from Another Panel

### Data Transfer

```bash
# Export users from old system
# Format: username,email,role,passwordHash

# Import into new system
docker exec -i beammeup-backend node << 'EOF'
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();
const csv = fs.readFileSync(0, 'utf-8');

// Parse and import...
EOF
```

### Configuration

```bash
# Copy ServerConfig.toml
cp /old/ServerConfig.toml /beammp/ServerConfig.toml

# Copy mod files
cp -r /old/Resources/Client/* /beammp/Resources/Client/

# Restart
docker compose down && docker compose up -d
```

---

## Support & Troubleshooting

**Check Status:**
```bash
# All services
docker compose ps

# Detailed stats
docker compose stats

# Network connectivity
docker network ls
docker network inspect beammeup_beammeup
```

**Collect Diagnostics:**

```bash
#!/bin/bash
echo "=== BeamMeUp Diagnostic Report ==="
echo ""
echo "Docker Version:"
docker --version
docker compose version

echo ""
echo "Service Status:"
docker compose ps

echo ""
echo "Disk Usage:"
du -sh data/

echo ""
echo "Database Size:"
docker exec beammeup-backend ls -lh /app/data/beammeup.db

echo ""
echo "Recent Errors (backend):"
docker compose logs --tail=20 backend | grep -i error

echo ""
echo "Network:"
docker network inspect beammeup_beammeup | grep -A 5 "Containers"
```

---

## Uninstall

```bash
# Stop all services and remove volumes
docker compose down -v

# Remove data
rm -rf data/
rm -rf certs/  # if using custom certs

# Remove images (optional)
docker rmi beammeup-backend beammeup-frontend
```

---

**Version:** 1.0.0
**Last Updated:** February 2024
