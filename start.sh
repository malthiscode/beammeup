#!/bin/bash
# Quick start script for BeamMeUp

set -e

echo "🚀 BeamMeUp - BeamMP Admin Panel"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker Desktop."
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose not found."
    exit 1
fi

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    
    # Generate secure session secret
    SECRET=$(openssl rand -base64 32)
    sed -i.bak "s/SESSION_SECRET=.*/SESSION_SECRET=$SECRET/" .env
    rm .env.bak 2>/dev/null || true
    
    echo "✅ .env created with random SESSION_SECRET"
    echo ""
    echo "⚠️  Important: Review .env and update DOCKER_HOST if on Windows:"
    echo "    DOCKER_HOST=npipe:////./pipe/docker_engine"
fi

# Pull and build images
echo "🔨 Building Docker images..."
docker compose build

# Start services
echo "▶️  Starting services..."
docker compose up -d

# Wait for backend
echo "⏳ Waiting for backend to be ready..."
ATTEMPTS=0
while [ $ATTEMPTS -lt 30 ]; do
    if curl -f http://localhost:3000/health 2>/dev/null | grep -q "ok"; then
        echo "✅ Backend is ready"
        break
    fi
    ATTEMPTS=$((ATTEMPTS + 1))
    sleep 1
done

# Run migrations
echo "🗄️  Running database migrations..."
docker exec beammeup-backend npx prisma migrate deploy

# Health check
if curl -f http://localhost/health 2>/dev/null | grep -q "ok"; then
    echo ""
    echo "✅ BeamMeUp is running!"
    echo ""
    echo "📍 Access at: http://localhost"
    echo "   API: http://localhost/api"
    echo "   UI: http://localhost"
    echo ""
    echo "📋 First time? Go to /setup to create your Owner account"
    echo ""
else
    echo ""
    echo "⚠️  Could not verify startup. Check logs:"
    echo "   docker compose logs"
fi
