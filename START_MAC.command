#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is needed to run the multiplayer server."
  echo "Install Node.js from https://nodejs.org/ then run this file again."
  read -p "Press Return to close..." _
  exit 1
fi
echo "Starting VEXELBOUND Online at http://localhost:3000"
(sleep 1; open "http://localhost:3000") &
node server.js
