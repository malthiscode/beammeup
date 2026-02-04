#!/bin/bash

# Wait for BeamMP config file to exist
# This is a Docker host script that runs before compose up

CONFIG_FILE="beammp-config/ServerConfig.toml"

# Check if config file exists, if not, create it from template
if [ ! -f "$CONFIG_FILE" ]; then
    echo "BeamMP config not found. Creating from template..."
    mkdir -p beammp-config
    # The file is already in the repo, just ensure it exists
    if [ ! -f "$CONFIG_FILE" ]; then
        echo "ERROR: Config template not found at $CONFIG_FILE"
        exit 1
    fi
fi

echo "Config file found at $CONFIG_FILE"
echo "Make sure you've set your AuthKey before BeamMP starts!"

# Run docker compose
docker compose up -d --build
