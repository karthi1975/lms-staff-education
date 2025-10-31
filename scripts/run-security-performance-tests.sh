#!/bin/bash

# Military-Grade Security & Performance Test Runner
# Runs comprehensive security validation and performance benchmarking

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  MILITARY-GRADE SECURITY & PERFORMANCE TEST SUITE          ║${NC}"
echo -e "${BLUE}║  Dual Coaching Bot Feature Validation                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

# Check if Jest is available
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx is not available${NC}"
    exit 1
fi

# Set environment
export NODE_ENV=test
export JWT_SECRET=${JWT_SECRET:-test-secret-key-for-testing}

# Create reports directory
REPORTS_DIR="./test-reports"
mkdir -p "$REPORTS_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo -e "${YELLOW}📋 Test Configuration:${NC}"
echo -e "   Environment: $NODE_ENV"
echo -e "   Reports Directory: $REPORTS_DIR"
echo -e "   Timestamp: $TIMESTAMP"
echo ""

# ============================================
# 1. RUN SECURITY TESTS
# ============================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  PHASE 1: SECURITY VALIDATION TESTS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}🔒 Running 41 security tests covering:${NC}"
echo "   - SQL Injection Protection (OWASP A03:2021)"
echo "   - XSS Protection (Cross-Site Scripting)"
echo "   - Authentication & Authorization (OWASP A01:2021)"
echo "   - Input Validation"
echo "   - Session Management Security"
echo "   - API Security"
echo "   - Data Leakage Prevention"
echo "   - Cryptographic Security"
echo "   - Business Logic Security"
echo "   - Secure Headers & Configuration"
echo ""

SECURITY_START=$(date +%s)

if npx jest tests/security/security-validation.test.js --verbose --json --outputFile="$REPORTS_DIR/security-results-$TIMESTAMP.json" 2>&1 | tee "$REPORTS_DIR/security-output-$TIMESTAMP.log"; then
    SECURITY_STATUS="PASSED"
    SECURITY_COLOR=$GREEN
else
    SECURITY_STATUS="FAILED"
    SECURITY_COLOR=$RED
fi

SECURITY_END=$(date +%s)
SECURITY_DURATION=$((SECURITY_END - SECURITY_START))

echo ""
echo -e "${SECURITY_COLOR}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${SECURITY_COLOR}  Security Tests: $SECURITY_STATUS (Duration: ${SECURITY_DURATION}s)${NC}"
echo -e "${SECURITY_COLOR}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================
# 2. RUN PERFORMANCE TESTS
# ============================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  PHASE 2: PERFORMANCE BENCHMARKING TESTS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}⚡ Running 24 performance tests with military-grade thresholds:${NC}"
echo "   - API Response Times (< 500ms)"
echo "   - Mode Switching Performance (< 200ms)"
echo "   - Prompt Generation (< 100ms)"
echo "   - Database Query Performance (< 100ms)"
echo "   - Session Creation (< 150ms)"
echo "   - Analytics Generation (< 1000ms)"
echo "   - Concurrent User Load Testing (50-100 concurrent)"
echo "   - Stress Testing (Breaking Points)"
echo "   - Memory Efficiency"
echo "   - Cache Performance"
echo ""

PERF_START=$(date +%s)

if npx jest tests/performance/performance-benchmarks.test.js --verbose --json --outputFile="$REPORTS_DIR/performance-results-$TIMESTAMP.json" 2>&1 | tee "$REPORTS_DIR/performance-output-$TIMESTAMP.log"; then
    PERF_STATUS="PASSED"
    PERF_COLOR=$GREEN
else
    PERF_STATUS="FAILED"
    PERF_COLOR=$RED
fi

PERF_END=$(date +%s)
PERF_DURATION=$((PERF_END - PERF_START))

echo ""
echo -e "${PERF_COLOR}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${PERF_COLOR}  Performance Tests: $PERF_STATUS (Duration: ${PERF_DURATION}s)${NC}"
echo -e "${PERF_COLOR}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================
# 3. GENERATE SUMMARY REPORT
# ============================================

TOTAL_DURATION=$((SECURITY_DURATION + PERF_DURATION))

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    FINAL TEST SUMMARY                       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${YELLOW}Test Execution Summary:${NC}"
echo -e "  ├─ Security Tests: ${SECURITY_COLOR}$SECURITY_STATUS${NC} (${SECURITY_DURATION}s)"
echo -e "  ├─ Performance Tests: ${PERF_COLOR}$PERF_STATUS${NC} (${PERF_DURATION}s)"
echo -e "  └─ Total Duration: ${TOTAL_DURATION}s"
echo ""
echo -e "  ${YELLOW}Test Coverage:${NC}"
echo -e "  ├─ Security Tests: 41 tests"
echo -e "  ├─ Performance Tests: 24 tests"
echo -e "  └─ Total: 65 tests"
echo ""
echo -e "  ${YELLOW}Test Reports:${NC}"
echo -e "  ├─ Security JSON: $REPORTS_DIR/security-results-$TIMESTAMP.json"
echo -e "  ├─ Security Log: $REPORTS_DIR/security-output-$TIMESTAMP.log"
echo -e "  ├─ Performance JSON: $REPORTS_DIR/performance-results-$TIMESTAMP.json"
echo -e "  └─ Performance Log: $REPORTS_DIR/performance-output-$TIMESTAMP.log"
echo ""

# ============================================
# 4. OVERALL STATUS
# ============================================

if [ "$SECURITY_STATUS" = "PASSED" ] && [ "$PERF_STATUS" = "PASSED" ]; then
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ ALL TESTS PASSED - MILITARY-GRADE STANDARDS MET         ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}🎉 Congratulations! Your system meets military-grade security"
    echo -e "   and performance standards.${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ❌ TESTS FAILED - REVIEW REQUIRED                           ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${RED}⚠️  Some tests did not meet military-grade standards."
    echo -e "   Please review the test reports for details.${NC}"
    echo ""
    exit 1
fi
