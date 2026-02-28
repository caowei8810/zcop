#!/bin/bash

# ZCOP System Integration Test Script

set -e

echo "========================================="
echo "ZCOP System Integration Test Suite"
echo "========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test
run_test() {
    local test_name=$1
    local test_command=$2
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Running: $test_name... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}FAILED${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Function to run a test with expected output
run_test_with_output() {
    local test_name=$1
    local test_command=$2
    local expected=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Running: $test_name... "
    
    local result=$(eval "$test_command" 2>/dev/null)
    
    if [[ "$result" == *"$expected"* ]]; then
        echo -e "${GREEN}PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}FAILED${NC} (Expected: $expected)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

echo "1. File Structure Tests"
echo "-----------------------------------------"
run_test "Backend directory exists" "test -d /root/clawd/zcop/backend"
run_test "Frontend directory exists" "test -d /root/clawd/zcop/frontend"
run_test "Documentation exists" "test -f /root/clawd/zcop/deploy-guide.md"
run_test "Docker compose exists" "test -f /root/clawd/zcop/docker-compose.yml"
run_test "Environment template exists" "test -f /root/clawd/zcop/env-template.txt"
echo ""

echo "2. Backend Code Tests"
echo "-----------------------------------------"
run_test "App module exists" "test -f /root/clawd/zcop/backend/src/app.module.ts"
run_test "App controller exists" "test -f /root/clawd/zcop/backend/src/app.controller.ts"
run_test "App service exists" "test -f /root/clawd/zcop/backend/src/app.service.ts"
run_test "Performance monitoring service exists" "test -f /root/clawd/zcop/backend/src/common/services/performance-monitoring.service.ts"
run_test "Unit tests exist" "test -f /root/clawd/zcop/backend/src/app.controller.spec.ts"
echo ""

echo "3. Frontend Code Tests"
echo "-----------------------------------------"
run_test "Frontend App exists" "test -f /root/clawd/zcop/frontend/src/App.tsx"
run_test "Smooth UI components exist" "test -f /root/clawd/zcop/frontend/src/components/SmoothUIComponents.tsx"
run_test "Dashboard components exist" "test -f /root/clawd/zcop/frontend/src/components/dashboard/DashboardComponents.tsx"
run_test "Frontend package.json exists" "test -f /root/clawd/zcop/frontend/package.json"
echo ""

echo "4. Configuration Tests"
echo "-----------------------------------------"
run_test "Backend package.json exists" "test -f /root/clawd/zcop/backend/package.json"
run_test "TypeScript config exists" "test -f /root/clawd/zcop/backend/tsconfig.json"
run_test "Dockerfile backend exists" "test -f /root/clawd/zcop/backend/Dockerfile"
run_test "Dockerfile frontend exists" "test -f /root/clawd/zcop/frontend/Dockerfile"
run_test "PM2 ecosystem config exists" "test -f /root/clawd/zcop/ecosystem.config.js"
echo ""

echo "5. Documentation Tests"
echo "-----------------------------------------"
run_test "API documentation exists" "test -f /root/clawd/zcop/api-documentation.md"
run_test "User manual exists" "test -f /root/clawd/zcop/user-manual.md"
run_test "Security config exists" "test -f /root/clawd/zcop/security-scanning-config.md"
run_test "Disaster recovery plan exists" "test -f /root/clawd/zcop/disaster-recovery-plan.md"
run_test "Legal compliance checklist exists" "test -f /root/clawd/zcop/legal-compliance-checklist.md"
run_test "Support training manual exists" "test -f /root/clawd/zcop/support-training-manual.md"
run_test "Testing strategy exists" "test -f /root/clawd/zcop/testing-strategy.md"
run_test "Load test config exists" "test -f /root/clawd/zcop/load-test-config.json"
run_test "Monitoring config exists" "test -f /root/clawd/zcop/monitoring-config.yaml"
echo ""

echo "6. Code Quality Checks"
echo "-----------------------------------------"
# Check if app.module.ts imports all required services
run_test_with_output "App module imports PerformanceMonitoringService" \
    "grep -q 'PerformanceMonitoringService' /root/clawd/zcop/backend/src/app.module.ts" \
    "PerformanceMonitoringService"
run_test_with_output "App module imports optimization services" \
    "grep -q 'OptimizationService' /root/clawd/zcop/backend/src/app.module.ts" \
    "OptimizationService"
echo ""

echo "========================================="
echo "Test Summary"
echo "========================================="
echo "Total Tests:  $TOTAL_TESTS"
echo -e "Passed:       ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:       ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}All tests passed! System is ready for deployment.${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please review and fix the issues.${NC}"
    exit 1
fi