# Security Hardening Guide

## Session Secret Management

**SESSION_SECRET** is now **automatically generated** on first run if not provided. The secret is:
- Generated using cryptographically secure random bytes
- Stored in `/app/data/.session_secret` with 0600 permissions
- Persisted across container restarts
- Reused on subsequent startups

**Optional Manual Configuration:**
If you prefer to set your own session secret, add to `.env`:
```bash
SESSION_SECRET=$(openssl rand -base64 32)
```

The backend will use your provided secret if it's at least 32 characters long.

## Security Configurations Applied

### Backend Security

1. **Authentication & Sessions**
   - HttpOnly secure cookies for session management
   - Argon2id password hashing with secure defaults
   - CSRF protection on all state-changing endpoints
   - Session validation against database on every request
   - Automatic session expiration (24 hours)

2. **HTTP Security Headers** (via Helmet)
   - Content Security Policy (CSP) - blocks XSS attacks
   - HSTS - forces HTTPS connections  
   - X-Frame-Options - prevents clickjacking
   - X-Content-Type-Options - prevents MIME sniffing
   - Referrer-Policy - limits information leakage

3. **Rate Limiting**
   - Global: 1000 requests per 15 minutes
   - Login endpoint: 5 attempts per 15 minutes
   - Mod upload: 10 uploads per hour
   - Localhost automatically whitelisted

4. **CORS**
   - Development: All origins allowed
   - Production: Restricted to ALLOWED_ORIGINS env var (comma-separated)
   - Credentials enabled for cookie-based auth

5. **Input Validation**
   - All inputs validated via validation schemas
   - Strict regex patterns for usernames, emails, ports
   - Length limits enforced on all string inputs
   - File upload size limits (1GB default, configurable)

6. **Error Handling**
   - Production error messages are generic to prevent info leaks
   - Detailed errors only in development mode
   - Stack traces never exposed to clients
   - All errors logged internally for debugging

### Frontend Security

1. **XSS Protection**
   - React's built-in XSS protection (automatic escaping)
   - No dangerouslySetInnerHTML usage
   - CSP headers from backend enforce script restrictions

2. **CSRF Protection**
   - CSRF token fetched before all mutations
   - Token sent in X-CSRF-Token header
   - Token validated on backend for POST/PUT/DELETE

3. **Cookie Security**
   - HttpOnly cookies (not accessible via JavaScript)
   - Secure flag (HTTPS only in production)
   - SameSite=lax (CSRF protection)
   - Automatic expiration

4. **Dependencies**
   - Regular npm audit checks recommended
   - All packages pinned to specific versions
   - No eval() or Function() constructors used

## Deployment Checklist

- [ ] (Optional) Set custom SESSION_SECRET environment variable
- [ ] (Optional) Set ALLOWED_ORIGINS for CORS in production
- [ ] Enable HTTPS via reverse proxy (Caddy recommended)
- [ ] Set NODE_ENV=production in .env file
- [ ] Enable Docker socket access (for server control)
- [ ] Regular npm audit and dependency updates
- [ ] Monitor audit logs for suspicious activity
- [ ] Backup ./data directory regularly (includes database and session secret)
- [ ] Limit Docker socket access to backend container only
- [ ] Use strong passwords for all admin accounts

## Known Security Considerations

1. **Docker Socket Access**
   - Backend has access to Docker socket for BeamMP control
   - This is required functionality but grants significant privileges
   - Ensure backend container is properly secured
   - Do not expose backend directly to internet (use reverse proxy)

2. **SQLite Database**
   - Database is file-based in ./data directory
   - Ensure proper filesystem permissions
   - Regular backups recommended
   - Consider migrating to PostgreSQL for high-traffic deployments

3. **Mod Uploads**
   - Files stored on filesystem (not in database)
   - SHA256 hashing for integrity verification
   - File size limits enforced
   - Only OWNER and ADMIN can upload
   - Consider virus scanning for uploaded mods

4. **Session Storage**
   - Sessions stored in SQLite database
   - No Redis/external session store by default
   - For high availability, migrate to Redis-backed sessions

## Additional Recommendations

1. Use Caddy or nginx as reverse proxy with HTTPS
2. Enable firewall rules (only expose necessary ports)
3. Regular security updates for host OS and Docker
4. Monitor logs for authentication failures
5. Implement IP-based blocking for repeated auth failures
6. Consider adding 2FA for OWNER accounts
7. Regular audit log reviews
8. Automated backups of data directory
