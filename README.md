# BeamMeUp - BeamMP Server Admin Panel

A secure, web-based admin panel for managing your BeamMP game server. Fully Dockerized and production-ready.

## Features

- 🔐 **Secure Authentication** - Password-based login with role-based access control
- ⚙️ **Server Configuration** - Edit server settings through the web interface
- 📦 **Mod Management** - Upload and manage server mods
- 👥 **User Management** - Create and manage admin accounts with different permission levels
- 📊 **Server Monitoring** - Real-time server status, logs, and restart controls
- 📝 **Audit Logging** - Track all configuration changes and admin actions

## Quick Deployment

### Prerequisites

- **Docker Desktop** (v4.20 or newer)
  - Windows: Install with WSL2 backend
  - Mac: Install Docker Desktop for Mac
  - Linux: Install Docker and Docker Compose

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/beammeup.git
   cd beammeup
   ```

2. **Configure your BeamMP AuthKey:**
   
   Edit `beammp-config/ServerConfig.toml` and add your AuthKey:
   ```toml
   [General]
   AuthKey = "your-beammp-auth-key-here"
   ```
   
   Get your AuthKey from: https://beammp.com/keymaster

3. **Start the services:**
   ```bash
   docker compose up -d --build
   ```
   
   This will start:
   - BeamMP game server (port 30814)
   - Admin panel backend (port 8200)
   - Admin panel frontend (port 8201)

4. **Access the admin panel:**
   
   Open your browser to: http://localhost:8201
   
   On first run, you'll be prompted to create an admin account.

5. **Done!** Your BeamMP server is now running with a web admin panel.

## Configuration

### Optional: Environment Variables

Create a `.env` file to customize settings (copy from `.env.example`):

```bash
# Set production mode
NODE_ENV=production

# Restrict API access to specific domains (for security)
ALLOWED_ORIGINS=https://yourdomain.com

# Limit mod file upload size (in MB)
MAX_MOD_SIZE=1024
```

**Note:** SESSION_SECRET is auto-generated and stored securely if not provided.

### Ports

Default ports used:
- `30814` - BeamMP game server (UDP)
- `8200` - Backend API (internal)
- `8201` - Web interface

To change ports, edit `docker-compose.yml`.

## Production Deployment

### With Caddy Reverse Proxy (Recommended)

For HTTPS access with a domain name, use Caddy as a reverse proxy:

1. **Install Caddy** on your server

2. **Create Caddyfile:**
   ```
   yourdomain.com {
       reverse_proxy localhost:8201
   }
   ```

3. **Start Caddy:**
   ```bash
   caddy run
   ```

Now access your admin panel at: https://yourdomain.com

Caddy automatically handles SSL certificates via Let's Encrypt.

### Security Checklist

- ✅ Set `NODE_ENV=production` in your `.env`
- ✅ Use a reverse proxy (Caddy/nginx) with HTTPS
- ✅ Set `ALLOWED_ORIGINS` to your domain
- ✅ Use strong passwords for admin accounts
- ✅ Keep your server and Docker updated
- ✅ Regularly backup the `./data` directory

## User Roles

- **OWNER** - Full access, can manage all settings and users
- **ADMIN** - Can configure server and manage mods
- **OPERATOR** - Can restart server and view logs
- **VIEWER** - Read-only access to server status

## Updating

To update to the latest version:

```bash
cd beammeup
git pull
docker compose down
docker compose up -d --build
```

Your data (users, configs, mods) is preserved in the `./data` directory.

## Maintenance

### Backup Your Data

Your database and uploaded mods are in the `./data` directory:

```bash
# Create backup
tar -czf beammeup-backup-$(date +%Y%m%d).tar.gz data/

# Restore backup
tar -xzf beammeup-backup-20260211.tar.gz
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f beammp
docker compose logs -f backend
docker compose logs -f frontend
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart beammp
```

## Troubleshooting

### Admin panel won't load
- Check if containers are running: `docker compose ps`
- View logs: `docker compose logs -f backend frontend`
- Ensure ports 8200 and 8201 aren't in use

### BeamMP server won't start
- Verify your AuthKey in `beammp-config/ServerConfig.toml`
- Check BeamMP logs: `docker compose logs -f beammp`
- Ensure port 30814 is open (UDP)

### Can't upload mods
- Check file size (default limit: 1024MB)
- Ensure you have ADMIN or OWNER role
- View backend logs: `docker compose logs -f backend`

### Forgot admin password
You'll need to reset via the database. Stop the containers and delete `./data/beammeup.db`, then restart to create a new owner account.

## Support

For issues and questions:
- Open an issue on GitHub
- Check [SECURITY.md](SECURITY.md) for security information
- Review [DEPLOYMENT.md](DEPLOYMENT.md) for advanced deployment options

## License

MIT License - see LICENSE file for details
