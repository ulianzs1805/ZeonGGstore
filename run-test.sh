#!/bin/bash

# Kill existing processes
killall -9 node 2>/dev/null || true
sleep 1

# Start server
cd /Users/a1/Desktop/ZeonGGStore
echo "🚀 Starting dev server on port 3003..."
PORT=3003 npm run dev &

# Wait for server to start
sleep 5

# Test if server is running
echo ""
echo "📡 Testing server..."
curl -s http://localhost:3003 > /dev/null
if [ $? -eq 0 ]; then
  echo "✅ Server is running on http://localhost:3003"
  echo ""
  echo "📋 Instructions:"
  echo "1. Open http://localhost:3003 in your browser"
  echo "2. Open DevTools (F12) → Console"
  echo "3. Find Recent Drops section"
  echo "4. Click on the skin PNG (left image)"
  echo "5. Then click on the case PNG (right image)"
  echo "6. Check console for logs and verify URL"
  echo ""
  echo "Expected console logs:"
  echo "  👕 Skin image clicked! Toggling to show case image for: [skinId]"
  echo "  📦 Case image clicked! caseHref: /case?caseId=[caseId]"
  echo "  🔗 Navigating to: /case?caseId=[caseId]"
else
  echo "❌ Server failed to start"
  exit 1
fi

wait
