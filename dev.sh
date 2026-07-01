#!/bin/sh

# Tuer le conteneur existant si lancé
docker compose -f compose-dev.yml down 2>/dev/null

if [ "$1" = "--build" ]; then
  docker compose -f compose-dev.yml up -d --build
else
  docker compose -f compose-dev.yml up -d
fi
