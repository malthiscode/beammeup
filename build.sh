#!/bin/bash

# Exit on error
set -e

echo "Building BeamMeUp..."

# Build backend
echo "Building backend..."
cd backend
npm ci
npm run build
cd ..

# Build frontend
echo "Building frontend..."
cd frontend
npm ci
npm run build
cd ..

echo "Build complete!"
echo "Run: docker compose up -d --build"
