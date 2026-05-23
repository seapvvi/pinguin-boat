#!/bin/bash
# Script de healthcheck Pinguin BOAT

API_URL="http://localhost:4000/api/health"
WEB_URL="http://localhost:3000"
BOT_PID=$(pm2 pid pinguin-bot 2>/dev/null || echo "0")

echo "🏥 Healthcheck Pinguin BOAT"

# API
if curl -sf "$API_URL" > /dev/null 2>&1; then
  echo "✅ API: OK"
else
  echo "❌ API: DOWN"
  exit 1
fi

# Web
if curl -sf "$WEB_URL" > /dev/null 2>&1; then
  echo "✅ Web: OK"
else
  echo "❌ Web: DOWN"
  exit 1
fi

# Bot
if [ "$BOT_PID" != "0" ] && [ "$BOT_PID" != "" ]; then
  echo "✅ Bot: OK (PID $BOT_PID)"
else
  echo "❌ Bot: DOWN"
  exit 1
fi

echo ""
echo "✅ Tous les services sont opérationnels."
