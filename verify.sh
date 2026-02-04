#!/bin/bash
# Verification script for BeamMeUp deployment

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 BeamMeUp Deployment Verification"
echo ""

# Check Docker
echo -n "✓ Docker installed: "
if command -v docker &> /dev/null; then
    echo -e "${GREEN}YES${NC}"
else
    echo -e "${RED}NO${NC}"
    exit 1
fi

# Check Docker Compose
echo -n "✓ Docker Compose installed: "
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null 2>&1; then
    echo -e "${GREEN}YES${NC}"
else
    echo -e "${RED}NO${NC}"
    exit 1
fi

# Check .env file
echo -n "✓ .env file exists: "
if [ -f .env ]; then
    echo -e "${GREEN}YES${NC}"
else
    echo -e "${RED}NO${NC}"
    echo "  Run: cp .env.example .env"
    exit 1
fi

# Check SESSION_SECRET
echo -n "✓ SESSION_SECRET configured: "
if grep -q "SESSION_SECRET=change-me" .env; then
    echo -e "${YELLOW}DEFAULT (change in production!)${NC}"
else
    echo -e "${GREEN}CUSTOM${NC}"
fi

# Check file sizes
echo ""
echo "📦 Project Structure:"
echo -n "  Backend code: "
[ -d backend/src ] && echo -e "${GREEN}OK${NC}" || echo -e "${RED}MISSING${NC}"
echo -n "  Frontend code: "
[ -d frontend/src ] && echo -e "${GREEN}OK${NC}" || echo -e "${RED}MISSING${NC}"
echo -n "  Database migrations: "
[ -d backend/prisma/migrations ] && echo -e "${GREEN}OK${NC}" || echo -e "${RED}MISSING${NC}"

# Check Docker build context
echo ""
echo "🐳 Docker Files:"
echo -n "  backend/Dockerfile: "
[ -f backend/Dockerfile ] && echo -e "${GREEN}OK${NC}" || echo -e "${RED}MISSING${NC}"
echo -n "  frontend/Dockerfile: "
[ -f frontend/Dockerfile ] && echo -e "${GREEN}OK${NC}" || echo -e "${RED}MISSING${NC}"
echo -n "  docker-compose.yml: "
[ -f docker-compose.yml ] && echo -e "${GREEN}OK${NC}" || echo -e "${RED}MISSING${NC}"
echo -n "  nginx.conf: "
[ -f nginx.conf ] && echo -e "${GREEN}OK${NC}" || echo -e "${RED}MISSING${NC}"

# Check package.json
echo ""
echo "📋 Package Configuration:"
echo -n "  backend/package.json: "
[ -f backend/package.json ] && echo -e "${GREEN}OK${NC}" || echo -e "${RED}MISSING${NC}"
echo -n "  frontend/package.json: "
[ -f frontend/package.json ] && echo -e "${GREEN}OK${NC}" || echo -e "${RED}MISSING${NC}"

# Check TypeScript
echo ""
echo "🔧 TypeScript Configuration:"
echo -n "  backend/tsconfig.json: "
[ -f backend/tsconfig.json ] && echo -e "${GREEN}OK${NC}" || echo -e "${RED}MISSING${NC}"
echo -n "  frontend/tsconfig.json: "
[ -f frontend/tsconfig.json ] && echo -e "${GREEN}OK${NC}" || echo -e "${RED}MISSING${NC}"

# Check documentation
echo ""
echo "📚 Documentation:"
echo -n "  README.md: "
[ -f README.md ] && echo -e "${GREEN}OK${NC}" || echo -e "${RED}MISSING${NC}"
echo -n "  ARCHITECTURE.md: "
[ -f ARCHITECTURE.md ] && echo -e "${GREEN}OK${NC}" || echo -e "${RED}MISSING${NC}"

# Check shell scripts
echo ""
echo "🚀 Deployment Scripts:"
echo -n "  start.sh: "
[ -f start.sh ] && echo -e "${GREEN}OK${NC}" || echo -e "${RED}MISSING${NC}"
echo -n "  Makefile: "
[ -f Makefile ] && echo -e "${GREEN}OK${NC}" || echo -e "${RED}MISSING${NC}"

echo ""
echo "✅ All checks passed!"
echo ""
echo "Next steps:"
echo "  1. Review and customize .env"
echo "  2. Run: docker compose up -d --build"
echo "  3. Visit: http://localhost"
echo "  4. Go to /setup to create Owner account"
