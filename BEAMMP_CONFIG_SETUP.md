# BeamMP Configuration Setup Guide

## Quick Start

Before starting the containers for the first time, you need to configure BeamMP:

### 1. Edit the ServerConfig.toml

The template config file is located at `beammp-config/ServerConfig.toml`. Edit it with your text editor:

```bash
# On macOS/Linux:
nano beammp-config/ServerConfig.toml

# Or use your preferred editor (VS Code, etc.)
```

### 2. Set Your AuthKey

The most important setting is the `AuthKey`:

```toml
[General]
# Replace with your actual BeamMP auth key from https://beammp.com/keymaster
AuthKey = "YOUR_AUTH_KEY_HERE"
```

To get an auth key:
1. Visit https://beammp.com/keymaster
2. Log in with your Discord account
3. Copy your auth key
4. Paste it into `ServerConfig.toml`

### 3. Optional: Configure Server Settings

You can optionally customize:

```toml
[General]
MaxPlayers = 32              # Max concurrent players
Debug = false               # Enable debug logging if needed

[Misc]
LogLevel = "Info"           # Debug, Info, Warning, Error
Description = "Your server description"
Tags = "your, server, tags"
```

### 4. Start the Containers

Once configured, start the stack:

```bash
docker compose up -d --build
```

## File Organization

```
beammeup/
├── beammp-config/
│   ├── ServerConfig.toml    # ← Edit this (mounted to /beammp)
│   └── Resources/           # ← Mods go here (auto-created)
├── data/
│   ├── beammeup.db         # Admin panel database
│   └── config-backups/      # Config version history
├── backend/
├── frontend/
└── docker-compose.yml
```

## Accessing Config Files While Containers Run

You can edit config files **while containers are running** - they're mounted as volumes:

- **ServerConfig.toml**: `beammp-config/ServerConfig.toml`
- **Admin Panel Database**: `data/beammeup.db`
- **Backups**: `data/config-backups/`

Changes to ServerConfig.toml require a restart:

```bash
docker compose restart beammp
```

## Viewing Logs

Check container logs to verify configuration:

```bash
# BeamMP server logs
docker compose logs -f beammp

# Backend API logs
docker compose logs -f backend

# Frontend logs
docker compose logs -f frontend
```

## Troubleshooting

### "AuthKey is required"
Make sure you've set a valid AuthKey in `beammp-config/ServerConfig.toml` and it's not blank.

### "Port 30814 already in use"
Change the port in docker-compose.yml:
```yaml
beammp:
  ports:
    - "30815:30814"  # Use 30815 instead
```

### "Cannot connect to server"
- Verify AuthKey is valid
- Check firewall rules allow port 30814
- Ensure config file is readable: `ls -la beammp-config/ServerConfig.toml`

### Access config files without running container

Even if containers aren't running, all config files are on your host machine:

```bash
# View BeamMP config
cat beammp-config/ServerConfig.toml

# View admin panel database (if sqlite3 installed)
sqlite3 data/beammeup.db ".tables"

# View config backups
ls -la data/config-backups/
```

You can edit these files anytime with any text editor, no container needed!
