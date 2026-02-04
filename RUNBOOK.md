# BeamMeUp Operator Runbook

Quick reference guide for common operational tasks.

## Daily Checks

```bash
# ✓ Check health
curl http://localhost:8088/api/diagnostics/health

# ✓ Verify containers running
docker compose ps

# ✓ Check disk space
df -h ./data

# ✓ Check for errors
docker compose logs --tail=50 | grep -i error
```

## Starting & Stopping

### Start Stack

```bash
cd /app/beammeup
docker compose up -d --build

# Wait for services to be ready
sleep 20

# Verify
docker compose ps
```

### Stop Stack

```bash
# Graceful shutdown
docker compose down

# Stop but keep data
docker compose stop

# Restart all services
docker compose restart
```

### Restart Single Service

```bash
# Restart backend only
docker compose restart backend

# Restart BeamMP server only
docker compose restart beammp

# Restart nginx proxy only
docker compose restart proxy
```

## Backup & Restore

### Quick Backup

```bash
# Create dated backup
tar -czf /backups/beammeup-$(date +%Y-%m-%d-%H%M%S).tar.gz \
  /app/beammeup/data

# Verify backup
ls -lh /backups/beammeup-*.tar.gz
```

### Restore Backup

```bash
# Stop services
docker compose down

# Restore from file
tar -xzf /backups/beammeup-2026-02-03-120000.tar.gz -C /app/beammeup

# Start again
docker compose up -d

# Verify
curl http://localhost:8088/api/diagnostics/health
```

## Logs & Debugging

### View Logs

```bash
# All services, last 50 lines
docker compose logs --tail=50

# Single service
docker compose logs backend
docker compose logs beammp

# Follow real-time
docker compose logs -f

# Last 1 hour
docker compose logs --since 1h
```

### Export Logs

```bash
# Full diagnostic export (Owner only)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8088/api/diagnostics/export \
  -o diagnostics-$(date +%Y%m%d).json

# Or CSV format
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  'http://localhost:8088/api/diagnostics/export?format=csv' \
  -o diagnostics-$(date +%Y%m%d).csv
```

### Search Logs

```bash
# Find all login failures
docker compose logs | grep "401\|Invalid credentials"

# Find configuration changes
docker compose logs | grep "CONFIG_UPDATE"

# Find errors
docker compose logs | grep -i "error\|failed\|exception"

# Find specific user action
docker compose logs | grep "username"
```

## Configuration Management

### Edit Configuration

Via Web UI:
1. Log in as Owner/Admin
2. Navigate to **Config** tab
3. Edit ServerConfig.toml fields
4. Click **Save** or **Save + Restart**

### Backup Configuration

```bash
# Configuration is auto-backed up when saved
# View backups in database (Owner only):

# Or manually export
docker compose exec backend sqlite3 /app/data/beammeup.sqlite \
  "SELECT filename, createdAt FROM config_backups ORDER BY createdAt DESC LIMIT 10;"
```

## Server Control

### Restart BeamMP Server

Via Web UI:
1. Log in
2. Navigate to **Dashboard**
3. Click **Restart Server** button
4. Confirm in dialog

Via API (requires Bearer token):
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  http://localhost:8088/api/server/restart
```

### View Server Logs

Via Web UI:
1. Navigate to **Dashboard**
2. See "Recent Logs" section
3. Click **Refresh** for latest

Via CLI:
```bash
# Last 100 lines
docker compose logs --tail=100 beammp

# Follow in real-time
docker compose logs -f beammp
```

## User Management

### Create User

Via Web UI:
1. Log in as Owner/Admin
2. Navigate to **Users** tab
3. Click **Create User**
4. Fill form (username, password, role, email)
5. Click **Create**

### Edit User

Via Web UI:
1. Navigate to **Users** tab
2. Click **Edit** on user
3. Change role or status
4. Click **Save**

### Delete User

Via Web UI:
1. Navigate to **Users** tab
2. Click **Delete** on user
3. Confirm

⚠️ Cannot delete last Owner account.

### Reset User Password

```bash
# Change user password (Admin/Owner only)
# Via Web UI: Users > Edit user > set new password > Save

# Or CLI (requires direct database access)
docker compose exec backend sqlite3 /app/data/beammeup.sqlite << EOF
-- View users
SELECT id, username, role FROM User;

-- To reset, must go through UI (password is hashed)
EOF
```

## Mod Management

### Upload Mods

Via Web UI:
1. Log in as Owner/Admin
2. Navigate to **Mods** tab
3. Click **Upload Mod**
4. Select ZIP file
5. Progress bar shows upload status

### View Mods

```bash
# Via Web UI: Navigate to Mods tab

# Via API
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8088/api/mods/list | jq
```

### Delete Mod

Via Web UI:
1. Navigate to **Mods** tab
2. Click **Delete** on mod
3. Confirm deletion

## Monitoring & Alerts

### System Health

```bash
# Get full health status
curl http://localhost:8088/api/diagnostics/health | jq

# Expected response
{
  "timestamp": "2026-02-03T21:00:00Z",
  "uptime": 86400,
  "memory": {...},
  "database": {"connected": true},
  "version": "1.0.0"
}
```

### Storage Usage

```bash
# Check data directory size
du -sh /app/beammeup/data

# Check individual directories
du -sh /app/beammeup/data/*

# Find largest files
find /app/beammeup/data -type f -exec ls -lh {} \; | sort -k5 -h | tail -10
```

### Database Status

```bash
# Database size
docker compose exec backend ls -lh /app/data/beammeup.sqlite

# Record count
docker compose exec backend sqlite3 /app/data/beammeup.sqlite << EOF
SELECT 'Users' as Table_Name, COUNT(*) as Row_Count FROM User
UNION ALL
SELECT 'Sessions', COUNT(*) FROM Session
UNION ALL
SELECT 'Audit Logs', COUNT(*) FROM AuditLog
UNION ALL
SELECT 'Mods', COUNT(*) FROM ModFile;
EOF
```

## Troubleshooting Quick Fixes

### Services Won't Start

```bash
# Check errors
docker compose logs

# Rebuild images
docker compose build --no-cache

# Start again
docker compose up -d
```

### Can't Access Web UI

```bash
# Check if proxy is running
docker compose ps proxy

# Check logs
docker compose logs proxy

# Verify port mapping
docker compose port proxy 80

# Restart proxy
docker compose restart proxy
```

### Database Locked

```bash
# Stop and restart
docker compose down
sleep 5
docker compose up -d
```

### High CPU/Memory

```bash
# Check resource usage
docker stats

# Find process using resources
docker compose exec backend ps aux | sort -k3,3nr | head -10

# Restart if necessary
docker compose restart backend
```

### Authentication Loop

```bash
# Clear browser cookies/cache
# Or from CLI:

# Create new session
curl -X POST http://localhost:8088/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

## Performance Tuning

### Database Optimization

```bash
# Enable WAL mode
docker compose exec backend sqlite3 /app/data/beammeup.sqlite \
  "PRAGMA journal_mode=WAL;"

# Analyze indexes
docker compose exec backend sqlite3 /app/data/beammeup.sqlite \
  "ANALYZE;"

# Check integrity
docker compose exec backend sqlite3 /app/data/beammeup.sqlite \
  "PRAGMA integrity_check;"
```

### Increase Memory

Update docker-compose.yml:
```yaml
backend:
  environment:
    NODE_OPTIONS: "--max-old-space-size=2048"
  deploy:
    resources:
      limits:
        memory: 2G
```

## Security Operations

### Audit Log Review

```bash
# Export audit logs
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:8088/api/audit/export?format=csv' \
  -o audit-$(date +%Y%m%d).csv

# Search for suspicious actions
docker compose logs | grep -E "DELETE.*user|RESTART|CONFIG_UPDATE"

# Check failed logins
docker compose logs | grep "Invalid credentials"
```

### Change Admin Credentials

1. Log in as current Admin
2. Via account menu (if available) or:
3. Create new Owner account via `/setup`
4. Delete old admin account

### Revoke All Sessions

```bash
# Force all users to log in again
docker compose restart backend
```

## Maintenance Windows

### Check Available Space

```bash
# Before heavy operations
df -h /app/beammeup/data

# Should have at least 10GB free for mods
```

### Clean Old Backups

```bash
# Keep only recent backups
find /backups/beammeup -mtime +30 -delete

# Verify
ls -lah /backups/beammeup/ | head -10
```

### Rotate Logs

```bash
# Docker handles log rotation (see DEPLOYMENT.md)

# Manual cleanup if needed
docker compose logs --tail=0 -f &  # Prime the logs
sleep 1
pkill -f "docker compose logs"  # Stop follow
```

## Emergency Procedures

### Server Unresponsive

```bash
# 1. Stop gracefully
docker compose down

# 2. Wait
sleep 10

# 3. Start again
docker compose up -d

# 4. Monitor logs
docker compose logs -f
```

### Data Corruption Suspected

```bash
# 1. Create backup immediately
tar -czf /backups/corrupted-$(date +%s).tar.gz /app/beammeup/data

# 2. Check database
docker compose exec backend sqlite3 /app/data/beammeup.sqlite \
  "PRAGMA integrity_check;"

# 3. If corrupted, restore backup
# See "Restore Backup" section above
```

### Security Incident

```bash
# 1. Document everything
docker compose logs > /var/log/incident-$(date +%s).log

# 2. Export audit trail
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:8088/api/audit/export?format=csv' \
  > incident-audit-$(date +%s).csv

# 3. Backup for investigation
tar -czf /backups/incident-$(date +%s).tar.gz /app/beammeup/data

# 4. Reset credentials (create new Owner, delete compromised)
# Via Web UI: Users tab

# 5. Review logs for unauthorized actions
grep "DELETE\|UPDATE\|USER_" incident-audit-*.csv
```

## Automation Scripts

### Automated Health Check

```bash
#!/bin/bash
# /usr/local/bin/beammeup-monitor.sh

HEALTH=$(curl -s http://localhost:8088/api/diagnostics/health)
STATUS=$?

if [ $STATUS -ne 0 ] || [ -z "$HEALTH" ]; then
  echo "ERROR: Cannot reach BeamMeUp" | mail -s "Alert: BeamMeUp Down" admin@example.com
  docker compose -f /app/beammeup/docker-compose.yml restart
  exit 1
fi

echo "✓ BeamMeUp healthy"
exit 0
```

Add to crontab:
```
*/5 * * * * /usr/local/bin/beammeup-monitor.sh
```

### Automated Backup

```bash
#!/bin/bash
# /usr/local/bin/beammeup-backup.sh

BACKUP_DIR=/backups/beammeup
mkdir -p $BACKUP_DIR

tar -czf $BACKUP_DIR/beammeup-$(date +%Y-%m-%d-%H%M%S).tar.gz \
  /app/beammeup/data

# Keep last 30 days
find $BACKUP_DIR -mtime +30 -delete

echo "✓ Backup complete"
```

Add to crontab:
```
0 2 * * * /usr/local/bin/beammeup-backup.sh
```

## Contacts & Escalation

**Support Channels:**
1. Check README.md first
2. Review DEPLOYMENT.md for specific issues
3. Export diagnostics and create GitHub issue
4. Contact maintainers directly for security issues

**Key Files:**
- Configuration: `/app/beammeup/.env`
- Data: `/app/beammeup/data/`
- Backups: `/backups/beammeup/`
- Logs: `docker compose logs`

---

**Version**: 1.0.0 | **Last Updated**: February 2026
