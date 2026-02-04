.PHONY: help install build start stop logs restart clean test dev build-backend build-frontend

help:
	@echo "BeamMeUp - BeamMP Admin Panel"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  install          Install dependencies for both backend and frontend"
	@echo "  build            Build Docker images"
	@echo "  start            Start all services (docker compose up)"
	@echo "  stop             Stop all services (docker compose down)"
	@echo "  restart          Restart all services"
	@echo "  logs             View logs from all services"
	@echo "  logs-backend     View backend logs"
	@echo "  logs-frontend    View frontend logs"
	@echo "  test             Run backend tests"
	@echo "  dev              Start development environment (not Docker)"
	@echo "  dev-backend      Start backend in dev mode"
	@echo "  dev-frontend     Start frontend in dev mode"
	@echo "  lint             Lint all code"
	@echo "  clean            Remove all Docker containers and volumes"
	@echo "  db-reset         Reset database to initial state"
	@echo "  db-migrate       Run database migrations"

install:
	cd backend && npm install && cd ..
	cd frontend && npm install && cd ..

build:
	docker compose build

build-backend:
	docker compose build backend

build-frontend:
	docker compose build frontend

start:
	docker compose up -d

stop:
	docker compose down

restart: stop start

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-frontend:
	docker compose logs -f frontend

logs-proxy:
	docker compose logs -f proxy

test:
	cd backend && npm test

test-watch:
	cd backend && npm run test:watch

dev-backend:
	cd backend && npm run dev

dev-frontend:
	cd frontend && npm run dev

dev: install
	@echo "Starting development environment..."
	@echo "Backend will run on http://localhost:3000"
	@echo "Frontend will run on http://localhost:5173"
	@echo ""
	@echo "In separate terminals, run:"
	@echo "  make dev-backend"
	@echo "  make dev-frontend"

lint:
	cd backend && npm run lint && cd ..
	cd frontend && npm run lint && cd ..

lint-fix:
	cd backend && npm run lint -- --fix && cd ..
	cd frontend && npm run lint -- --fix && cd ..

db-reset:
	docker exec beammeup-backend npm run db:reset

db-migrate:
	docker exec beammeup-backend npx prisma migrate deploy

db-seed:
	docker exec beammeup-backend npx prisma db seed

db-studio:
	cd backend && npx prisma studio

clean:
	docker compose down -v
	rm -rf data/
	rm -rf backend/dist/
	rm -rf frontend/dist/

health:
	curl -s http://localhost/health | python3 -m json.tool || curl -s http://localhost/health

shell-backend:
	docker exec -it beammeup-backend sh

shell-frontend:
	docker exec -it beammeup-frontend sh

shell-proxy:
	docker exec -it beammeup-proxy sh

setup:
	./start.sh

version:
	@grep '"version"' backend/package.json | head -1
