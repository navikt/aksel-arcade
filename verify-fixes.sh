#!/bin/bash

# Quick verification script for AkselArcade fixes
# This verifies the build works before manual browser testing

echo "🔍 AkselArcade - Fix Verification"
echo "=================================="
echo ""

echo "1️⃣ Type checking..."
npm run type-check
if [ $? -ne 0 ]; then
  echo "❌ Type check failed"
  exit 1
fi
echo "✅ Type check passed"
echo ""

echo "2️⃣ Running unit tests..."
npm test -- --run
if [ $? -ne 0 ]; then
  echo "❌ Tests failed"
  exit 1
fi
echo "✅ All tests passed"
echo ""

echo "3️⃣ Building production bundle..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi
echo "✅ Build successful"
echo ""

echo "================================================"
echo "✅ All automated checks passed!"
echo ""
echo "Next steps:"
echo "1. Run 'npm run dev'"
echo "2. Open http://localhost:5173"
echo "3. Follow MANUAL_TEST_GUIDE.md for verification"
echo "================================================"
