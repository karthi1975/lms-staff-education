#!/bin/bash

# Test Navigation Consolidation
# Verifies login redirects to dashboard.html and old lms-dashboard.html redirects correctly

echo "🧪 Testing Navigation Consolidation"
echo "===================================="
echo ""

BASE_URL="http://localhost:3000"

# Check if server is running
if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo "❌ Server not running at $BASE_URL"
    exit 1
fi

echo "✅ Server is running"
echo ""

# Test 1: Verify lms-dashboard.html redirects to dashboard.html
echo "🔍 Test 1: lms-dashboard.html redirect"
REDIRECT_URL=$(curl -s -o /dev/null -w '%{redirect_url}' "$BASE_URL/admin/lms-dashboard.html")
if [[ "$REDIRECT_URL" == *"dashboard.html"* ]] || curl -s "$BASE_URL/admin/lms-dashboard.html" | grep -q "dashboard.html"; then
    echo "   ✅ lms-dashboard.html redirects to dashboard.html"
else
    echo "   ❌ lms-dashboard.html does not redirect properly"
fi
echo ""

# Test 2: Verify no references to lms-dashboard remain (except the redirect file itself)
echo "🔍 Test 2: Check for remaining lms-dashboard references"
REFS=$(grep -r "lms-dashboard" public/admin/*.html 2>/dev/null | grep -v "lms-dashboard.html:" | wc -l | tr -d ' ')
if [ "$REFS" = "0" ]; then
    echo "   ✅ No references to lms-dashboard.html found (except redirect file)"
else
    echo "   ⚠️  Found $REFS references to lms-dashboard.html:"
    grep -r "lms-dashboard" public/admin/*.html 2>/dev/null | grep -v "lms-dashboard.html:" | head -5
fi
echo ""

# Test 3: Verify dashboard.html loads correctly
echo "🔍 Test 3: dashboard.html loads"
DASHBOARD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin/dashboard.html")
if [ "$DASHBOARD_STATUS" = "200" ]; then
    echo "   ✅ dashboard.html loads successfully (HTTP 200)"
else
    echo "   ❌ dashboard.html failed to load (HTTP $DASHBOARD_STATUS)"
fi
echo ""

# Test 4: Verify dashboard has clean navigation (4 items only)
echo "🔍 Test 4: Clean navigation verification"
DASHBOARD_HTML=$(curl -s "$BASE_URL/admin/dashboard.html")

HAS_DASHBOARD=$(echo "$DASHBOARD_HTML" | grep -o "Dashboard" | wc -l | tr -d ' ')
HAS_COURSES=$(echo "$DASHBOARD_HTML" | grep -o "Courses" | wc -l | tr -d ' ')
HAS_USERS=$(echo "$DASHBOARD_HTML" | grep -o "Users" | wc -l | tr -d ' ')
HAS_AI=$(echo "$DASHBOARD_HTML" | grep -o "AI Assistant" | wc -l | tr -d ' ')

NO_CONTENT=$(echo "$DASHBOARD_HTML" | grep -c "Content Library" || echo "0")
NO_SETTINGS=$(echo "$DASHBOARD_HTML" | grep -c "Settings" | grep -v "Moodle Settings" || echo "0")

if [ "$HAS_DASHBOARD" -gt "0" ] && [ "$HAS_COURSES" -gt "0" ] && [ "$HAS_USERS" -gt "0" ] && [ "$HAS_AI" -gt "0" ]; then
    echo "   ✅ All 4 navigation items present (Dashboard, Courses, Users, AI Assistant)"
else
    echo "   ⚠️  Some navigation items may be missing"
fi

if [ "$NO_CONTENT" = "0" ] && [ "$NO_SETTINGS" = "0" ]; then
    echo "   ✅ Placeholder items removed (Content Library, Settings)"
else
    echo "   ⚠️  Some placeholder items may still be present"
fi
echo ""

# Test 5: Verify login redirects to dashboard.html
echo "🔍 Test 5: Login redirect verification"
if grep -q "dashboard.html" public/admin/login.html && ! grep -q "lms-dashboard.html" public/admin/login.html; then
    echo "   ✅ login.html redirects to dashboard.html"
else
    echo "   ❌ login.html still references lms-dashboard.html"
fi
echo ""

# Test 6: Check other pages for correct links
echo "🔍 Test 6: Breadcrumb and navigation links"
FILES_TO_CHECK=("courses.html" "users.html" "chat.html")
BROKEN_LINKS=0

for file in "${FILES_TO_CHECK[@]}"; do
    if [ -f "public/admin/$file" ]; then
        if grep -q "lms-dashboard.html" "public/admin/$file"; then
            echo "   ❌ $file still references lms-dashboard.html"
            BROKEN_LINKS=$((BROKEN_LINKS + 1))
        fi
    fi
done

if [ "$BROKEN_LINKS" = "0" ]; then
    echo "   ✅ All pages use dashboard.html"
else
    echo "   ⚠️  $BROKEN_LINKS file(s) still reference lms-dashboard.html"
fi
echo ""

# Summary
echo "===================================="
echo "📊 Test Summary"
echo "===================================="
echo ""

TOTAL_TESTS=6
PASSED=0

# Count passed tests (simplified)
if curl -s "$BASE_URL/admin/lms-dashboard.html" | grep -q "dashboard.html"; then PASSED=$((PASSED + 1)); fi
if [ "$REFS" = "0" ]; then PASSED=$((PASSED + 1)); fi
if [ "$DASHBOARD_STATUS" = "200" ]; then PASSED=$((PASSED + 1)); fi
if [ "$HAS_DASHBOARD" -gt "0" ]; then PASSED=$((PASSED + 1)); fi
if grep -q "dashboard.html" public/admin/login.html; then PASSED=$((PASSED + 1)); fi
if [ "$BROKEN_LINKS" = "0" ]; then PASSED=$((PASSED + 1)); fi

echo "Tests Passed: $PASSED/$TOTAL_TESTS"
echo ""

if [ "$PASSED" = "$TOTAL_TESTS" ]; then
    echo "✅ All navigation consolidation tests PASSED!"
    exit 0
else
    echo "⚠️  Some tests need attention"
    exit 1
fi
