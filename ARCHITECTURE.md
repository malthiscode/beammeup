# BeamMeUp Architecture & Security Documentation

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Browser (HTTPS)                     │
└────────────────────────────┬────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Nginx Reverse  │
                    │     Proxy       │
                    │  (Port 80/443)  │
                    └────┬────────┬───┘
                         │        │
         ┌───────────────┘        └──────────────┐
         │                                       │
    ┌────▼──────────┐                    ┌─────▼──────────┐
    │  Frontend     │                    │  Backend API   │
    │  React + SPA  │                    │  Fastify       │
    │  (Port 3000)  │                    │  (Port 3000)   │
    └───────────────┘                    └─────┬──────────┘
                                               │
                        ┌──────────────────────┼──────────────────────┐
                        │                      │                      │
                   ┌────▼──────┐       ┌──────▼──────┐        ┌──────▼────┐
                   │  SQLite   │       │ BeamMP Vol  │        │ Docker API│
                   │  Database │       │ (Shared)    │        │ Socket    │
                   └───────────┘       └─────────────┘        └───────────┘
                        │
                   /app/data/
                   └── beammeup.db
                   └── config-backups/
```

## Data Flow

### Authentication Flow

```
1. User submits credentials (LoginPage)
   ↓
2. POST /api/auth/login
   ↓
3. Backend validates password (Argon2id)
   ↓
4. JWT token generated (signed with SESSION_SECRET)
   ↓
5. Token returned to frontend
   ↓
6. Frontend stores token in localStorage
   ↓
7. All subsequent requests include: Authorization: Bearer <token>
   ↓
8. Backend verifies JWT signature on each request
```

### Config Update Flow

```
1. User modifies config in UI (ConfigPage)
   ↓
2. Click "Save Configuration" or "Save & Restart"
   ↓
3. PUT /api/config/update with new config
   ↓
4. Backend validates auth + role (OWNER/ADMIN/OPERATOR)
   ↓
5. Backup created: config-backups/backup-<timestamp>.toml
   ↓
6. New config written atomically (temp file + rename)
   ↓
7. Audit log created with diff
   ↓
8. If "Save & Restart": POST /api/server/restart (OWNER/ADMIN only)
   ↓
9. Docker API: docker restart beammp container
   ↓
10. Response sent to UI (success/error)
```

### Mod Upload Flow

```
1. User selects ZIP file in ModsPage
   ↓
2. FormData with file sent to POST /api/mods/upload
   ↓
3. Backend validates auth + role (OWNER/ADMIN/OPERATOR)
   ↓
4. ZIP extracted and validated for zip-slip attacks
   ↓
5. File size validated (max 100MB)
   ↓
6. SHA256 hash computed
   ↓
7. File saved to BEAMMP_RESOURCES_PATH with generated name
   ↓
8. Metadata stored in database
   ↓
9. Audit log created (action: MOD_UPLOAD)
   ↓
10. Response with file ID and metadata sent to UI
```

## Security Implementation

### 1. Authentication & Authorization

**Password Security:**
- Argon2id hashing with:
  - Time Cost: 3 iterations
  - Memory Cost: 65536 KB (~65MB)
  - Parallelism: 4
  - Salt: Randomly generated per password

**Session Management:**
- JWT tokens signed with configurable secret
- 24-hour expiration
- Verified signature on each request
- Stored in HTTP localStorage (accessible to JavaScript)

**Role-Based Access Control:**
```
Owner:      All system actions, user management
Admin:      Everything except critical system config
Operator:   Config changes, mod management, server restart
Viewer:     Read-only access to config and audit logs
```

**Example:**
```typescript
// Middleware check
const user = await prisma.user.findUnique({ where: { id: userId } });
if (!['OWNER', 'ADMIN', 'OPERATOR'].includes(user.role)) {
  return 403; // Forbidden
}
```

### 2. Input Validation & Sanitization

**Config Validation:**
- TOML parser validates syntax
- Required fields checked before write
- Type validation for numeric fields (Port, MaxPlayers, etc.)
- Path traversal prevention via tight whitelist

**File Upload Validation:**
```typescript
// ZIP validation
const zip = new AdmZip(buffer);
for (const entry of zip.getEntries()) {
  // Prevent zip-slip
  if (entry.entryName.includes('..') || entry.entryName.startsWith('/')) {
    throw new Error('Invalid zip file structure');
  }
}

// File size check
if (buffer.length > MAX_ZIP_SIZE) {
  throw new Error('File too large');
}

// Integrity check
const sha256 = createHash('sha256').update(buffer).digest('hex');
```

**Form Input Validation:**
- Username: min 3 chars, alphanumeric + underscore
- Password: min 8 chars (enforced on signup)
- Email: standard email regex
- Numeric fields: parsed and range-checked

### 3. CSRF Protection

**Method:**
- All state-changing requests (POST, PUT, DELETE) require JWT
- JWT cannot be forged by cross-origin scripts
- SameSite cookie attribute (when using cookies)

**Example:**
```
// SAFE: Requires JWT header
PUT /api/config/update
Authorization: Bearer <jwt>

// UNSAFE (if this existed): Could be CSRF'd
POST /api/dangerous?action=restart
```

### 4. Rate Limiting

**Configuration:**
- 100 requests per 15 minutes (global)
- Whitelist: 127.0.0.1 (localhost)
- Applied to all endpoints except /health

**Implementation:**
```typescript
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '15 minutes',
  cache: 10000,
  allowList: ['127.0.0.1'],
});
```

**Recommended Customization:**
```env
# For login endpoint, create separate limiter
MAX_LOGIN_ATTEMPTS=5
LOGIN_WINDOW_MS=900000 # 15 minutes
```

### 5. Data Protection

**Config File:**
- Atomic writes using temp file + rename pattern
- Prevents partial writes if process crashes
- Timestamped backups before each update
- Never modify in-place

```typescript
// Atomic write
const tempPath = `${CONFIG_PATH}.${randomBytes(8).toString('hex')}`;
await writeFile(tempPath, content);
fs.renameSync(tempPath, CONFIG_PATH); // Atomic on most filesystems
```

**AuthKey:**
- NEVER returned in API responses
- ONLY settable via dedicated POST /api/config/authkey-replace
- Requires Owner/Admin role
- Logged to audit trail with masked value

**Database:**
- SQLite file encrypted (optional: full-disk encryption)
- Regular backups recommended
- Sensitive fields: passwordHash, tokens

**Backups:**
- Automatic timestamped backups before config write
- Stored in `/app/data/config-backups/`
- Include timestamp for quick recovery
- Compressed before archival (optional)

### 6. Network Security

**Headers:**
- X-Frame-Options: SAMEORIGIN (prevent clickjacking)
- X-Content-Type-Options: nosniff (prevent MIME sniffing)
- X-XSS-Protection: enabled
- Referrer-Policy: restrictive
- CSP: restrictive for scripts/styles

**HTTPS (Production):**
```nginx
listen 443 ssl http2;
ssl_certificate /path/to/cert.pem;
ssl_certificate_key /path/to/key.pem;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

**CORS:**
- Frontend origin must match backend origin
- Credentials: true (for cookies)
- Methods: GET, POST, PUT, DELETE, OPTIONS

### 7. Audit Logging

**Logged Actions:**
- CONFIG_VIEW - Viewing configuration (read-only)
- CONFIG_UPDATE - Updating configuration with full diff
- SERVER_RESTART - Server restart command
- MOD_UPLOAD - File upload with SHA256
- MOD_DELETE - File deletion
- USER_CREATE - User account creation
- USER_UPDATE - User role/status changes
- USER_DELETE - User deletion
- USER_LOGIN - Successful authentication
- USER_LOGOUT - User logout
- AUTHKEY_REPLACE - AuthKey replacement

**Data Collected:**
```
{
  userId: string,           // Who performed the action
  action: AuditAction,      // What action
  resource: string,         // What resource (config, server, mod, user)
  resourceId: string,       // Specific resource ID
  details: string,          // JSON-stringified details or diff
  ipAddress: string,        // Source IP
  userAgent: string,        // Browser/client info
  createdAt: DateTime       // Timestamp (millisecond precision)
}
```

**Example Audit Log Entry:**
```json
{
  "userId": "user_123",
  "action": "CONFIG_UPDATE",
  "resource": "config",
  "details": {
    "MaxPlayers": { "old": 32, "new": 64 },
    "Name": { "old": "Test Server", "new": "Production Server" }
  },
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "createdAt": "2024-02-03T15:30:45.123Z"
}
```

**Export & Analysis:**
```bash
# CSV export via API
GET /api/audit/export
# Returns file: audit-logs-<timestamp>.csv
```

## Error Handling

### Backend Error Responses

**Format:**
```json
{
  "error": "ERROR_CODE",
  "message": "User-friendly message",
  "statusCode": 400
}
```

**Common Errors:**
- 400 Bad Request - Invalid input
- 401 Unauthorized - Missing/invalid token
- 403 Forbidden - Insufficient permissions
- 404 Not Found - Resource not found
- 429 Too Many Requests - Rate limit exceeded
- 500 Internal Server Error - Server error

**Error Handling Middleware:**
```typescript
fastify.setErrorHandler(async (error, request, reply) => {
  const statusCode = error.statusCode || 500;
  
  // Log errors
  if (statusCode >= 500) {
    request.log.error(error);
  }
  
  // Hide sensitive details in production
  const isDev = process.env.NODE_ENV === 'development';
  const message = isDev ? error.message : 'An error occurred';
  
  reply.code(statusCode).send({
    error: error.code || 'INTERNAL_SERVER_ERROR',
    message,
    statusCode,
  });
});
```

## Testing

### Unit Tests

**Password Hashing:**
```typescript
describe('Password Hashing', () => {
  it('should hash and verify passwords', async () => {
    const password = 'test123';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });
});
```

**Auth Routes:**
```typescript
it('should login with correct credentials', async () => {
  const response = await fastify.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'admin', password: 'password123' }
  });
  expect(response.statusCode).toBe(200);
  expect(response.body).toHaveProperty('token');
});
```

### Integration Tests

Run all tests:
```bash
npm test
```

Watch mode:
```bash
npm run test:watch
```

## Performance Considerations

### Database Indexing

**audit_logs table:**
```sql
CREATE INDEX audit_logs_userId_idx ON audit_logs(userId);
CREATE INDEX audit_logs_action_idx ON audit_logs(action);
CREATE INDEX audit_logs_createdAt_idx ON audit_logs(createdAt);
CREATE INDEX audit_logs_resource_idx ON audit_logs(resource);
```

**Query optimization:**
- Most queries filter by userId or createdAt (indexed)
- Pagination: LIMIT + OFFSET with indexes
- CSV export: Full table scan (acceptable for infrequent operation)

### Caching

**Frontend:**
- Token cached in localStorage
- HTTP caching headers for static assets
- React component memoization (React.memo)

**Nginx:**
- Gzip compression enabled
- Cache busting via hash in filenames
- Reasonable TTLs for static assets

### Scalability

**Horizontal Scaling:**
- Stateless backend (JWT auth)
- SQLite file shared via network mount or S3
- Redis for rate limiting (optional)
- Multiple backend instances behind load balancer

**Vertical Scaling:**
- Increase Argon2 costs (trades password security for performance)
- Database query optimization
- Batch operations for bulk imports

## Disaster Recovery

### Backup Strategy

**What to backup:**
- `/app/data/beammeup.db` (database)
- `/app/data/config-backups/` (config history)
- `/beammp/ServerConfig.toml` (current config)
- `/beammp/Resources/Client/` (mod files)

**Recommended Schedule:**
```bash
# Daily
0 2 * * * docker exec beammeup-backend \
  tar czf /backup/beammeup-$(date +%Y%m%d).tar.gz /app/data

# Weekly to remote storage
0 3 * * 0 aws s3 sync /backup s3://my-backups/beammeup/
```

**Recovery:**
```bash
# Stop services
docker compose down

# Restore database
docker run -v beammeup_data:/data -v /backup:/backup \
  alpine tar xzf /backup/beammeup-20240203.tar.gz -C /data

# Restart
docker compose up -d
```

### Monitoring

**Health Check:**
```bash
curl http://localhost/health
# { "status": "ok" }
```

**Alerts:**
```bash
# Check for high error rate in logs
docker compose logs backend | grep -i error | wc -l

# Check disk space
docker exec beammeup-backend df -h /app/data

# Check database integrity
docker exec beammeup-backend sqlite3 /app/data/beammeup.db "PRAGMA integrity_check;"
```

## Compliance

### GDPR Considerations

**User Data:**
- User accounts include email (optional)
- IP addresses logged in audit trail
- Passwords hashed (irreversible)

**Data Deletion:**
```bash
# Delete a user (cascades to sessions and audit logs showing their actions)
DELETE FROM users WHERE id = 'user_id';

# Clear old audit logs
DELETE FROM audit_logs WHERE createdAt < date('now', '-90 days');
```

### Data Retention

**Recommended Policies:**
- Audit logs: 1 year (delete monthly)
- Config backups: 1 year (delete oldest if > 100 files)
- Session tokens: Auto-expire in 24 hours

## Development & Deployment Checklist

**Pre-Production:**
- [ ] Change SESSION_SECRET to random value
- [ ] Set NODE_ENV=production
- [ ] Enable HTTPS/TLS
- [ ] Configure database backups
- [ ] Set up monitoring/alerts
- [ ] Test disaster recovery
- [ ] Review audit log retention
- [ ] Document custom configurations
- [ ] Train administrators

**Post-Deployment:**
- [ ] Verify health check: GET /health
- [ ] Test authentication flow
- [ ] Verify audit logging
- [ ] Test config backup/restore
- [ ] Monitor logs for errors
- [ ] Verify backup job runs
- [ ] Test failover procedures
