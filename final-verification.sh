#!/bin/bash

# ZCOP System Final Verification Script

set -e

echo "========================================="
echo "ZCOP System - Final Verification"
echo "========================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ISSUES_FOUND=0

echo "1. Checking Backend Configuration..."
echo "-----------------------------------------"

# Check app.module.ts for common issues
if grep -q "TypeOrmModule.forFeature(\[AppService" /root/clawd/zcop/backend/src/app.module.ts; then
    echo -e "${RED}❌ ISSUE: AppService should not be in TypeOrmModule.forFeature${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}✅ App module configuration correct${NC}"
fi

# Check for circular imports in app.service.ts
if grep -q "import.*AppService.*from.*app.service" /root/clawd/zcop/backend/src/app.service.ts; then
    echo -e "${RED}❌ ISSUE: Circular import detected in app.service.ts${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}✅ No circular imports in app.service.ts${NC}"
fi

# Check if main.ts exists
if [ -f /root/clawd/zcop/backend/src/main.ts ]; then
    echo -e "${GREEN}✅ main.ts exists${NC}"
else
    echo -e "${RED}❌ ISSUE: main.ts missing${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

echo ""
echo "2. Checking Frontend Configuration..."
echo "-----------------------------------------"

# Check for required dependencies
if grep -q "framer-motion" /root/clawd/zcop/frontend/package.json; then
    echo -e "${GREEN}✅ framer-motion dependency present${NC}"
else
    echo -e "${RED}❌ ISSUE: framer-motion dependency missing${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if grep -q "styled-components" /root/clawd/zcop/frontend/package.json; then
    echo -e "${GREEN}✅ styled-components dependency present${NC}"
else
    echo -e "${RED}❌ ISSUE: styled-components dependency missing${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if grep -q "react-icons" /root/clawd/zcop/frontend/package.json; then
    echo -e "${GREEN}✅ react-icons dependency present${NC}"
else
    echo -e "${RED}❌ ISSUE: react-icons dependency missing${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

echo ""
echo "3. Checking Documentation..."
echo "-----------------------------------------"

DOCS=(
    "api-documentation.md"
    "user-manual.md"
    "deploy-guide.md"
    "testing-strategy.md"
    "security-scanning-config.md"
    "disaster-recovery-plan.md"
    "legal-compliance-checklist.md"
    "support-training-manual.md"
    "COMMERCIAL_READINESS.md"
    "PROJECT_STATUS.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "/root/clawd/zcop/$doc" ]; then
        echo -e "${GREEN}✅ $doc exists${NC}"
    else
        echo -e "${RED}❌ ISSUE: $doc missing${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done

echo ""
echo "4. Checking Infrastructure Files..."
echo "-----------------------------------------"

INFRA_FILES=(
    "docker-compose.yml"
    "backend/Dockerfile"
    "frontend/Dockerfile"
    "frontend/nginx.conf"
    "ecosystem.config.js"
    "deploy.sh"
    "quick-start.sh"
    "integration-test.sh"
    "env-template.txt"
)

for file in "${INFRA_FILES[@]}"; do
    if [ -f "/root/clawd/zcop/$file" ]; then
        echo -e "${GREEN}✅ $file exists${NC}"
    else
        echo -e "${RED}❌ ISSUE: $file missing${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done

echo ""
echo "5. Checking Service Files..."
echo "-----------------------------------------"

SERVICES=(
    "performance-monitoring.service.ts"
    "memory-management-optimization.service.ts"
    "adaptive-load-balancer-optimization.service.ts"
    "intelligent-caching-optimization.service.ts"
    "security-hardening-optimization.service.ts"
)

for service in "${SERVICES[@]}"; do
    if [ -f "/root/clawd/zcop/backend/src/common/services/$service" ]; then
        echo -e "${GREEN}✅ $service exists${NC}"
    else
        echo -e "${RED}❌ ISSUE: $service missing${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done

echo ""
echo "6. Checking Frontend Components..."
echo "-----------------------------------------"

COMPONENTS=(
    "SmoothUIComponents.tsx"
    "SmoothFormComponents.tsx"
    "SmoothFeedbackComponents.tsx"
    "SmoothListComponents.tsx"
    "SmoothNavigationComponents.tsx"
    "SmoothAnimationComponents.tsx"
    "DashboardComponents.tsx"
)

for component in "${COMPONENTS[@]}"; do
    if [ -f "/root/clawd/zcop/frontend/src/components/$component" ] || \
       [ -f "/root/clawd/zcop/frontend/src/components/form/$component" ] || \
       [ -f "/root/clawd/zcop/frontend/src/components/feedback/$component" ] || \
       [ -f "/root/clawd/zcop/frontend/src/components/list/$component" ] || \
       [ -f "/root/clawd/zcop/frontend/src/components/navigation/$component" ] || \
       [ -f "/root/clawd/zcop/frontend/src/components/animations/$component" ] || \
       [ -f "/root/clawd/zcop/frontend/src/components/dashboard/$component" ]; then
        echo -e "${GREEN}✅ $component exists${NC}"
    else
        echo -e "${YELLOW}⚠️  WARNING: $component not found in expected location${NC}"
    fi
done

echo ""
echo "========================================="
echo "Verification Summary"
echo "========================================="

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! System is ready.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Install dependencies: cd backend && npm install"
    echo "2. Install frontend dependencies: cd frontend && npm install"
    echo "3. Run quick start: ./quick-start.sh"
    exit 0
else
    echo -e "${RED}❌ Found $ISSUES_FOUND issue(s) that need attention.${NC}"
    echo ""
    echo "Please review and fix the issues above."
    exit 1
fi