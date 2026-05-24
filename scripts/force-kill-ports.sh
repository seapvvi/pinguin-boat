#!/bin/bash
# Force kill ports used by Pinguin BOAT
echo "Arrêt des processus sur le port 3000..."
fuser -k 3000/tcp 2>/dev/null || lsof -ti:3000 | xargs -r kill -9 2>/dev/null
echo "Arrêt des processus sur le port 3001..."
fuser -k 3001/tcp 2>/dev/null || lsof -ti:3001 | xargs -r kill -9 2>/dev/null
echo "Arrêt des processus sur le port 4000..."
fuser -k 4000/tcp 2>/dev/null || lsof -ti:4000 | xargs -r kill -9 2>/dev/null
echo "Arrêt PM2 si actif..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
echo "Ports libérés."
