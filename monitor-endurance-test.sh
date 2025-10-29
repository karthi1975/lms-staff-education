#!/bin/bash

# Monitor Endurance Test Progress
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Endurance Test Monitor${NC}"
echo ""

STATS_FILE=$(ls -t endurance-test-stats-*.json 2>/dev/null | head -1)

if [ -z "$STATS_FILE" ]; then
    echo -e "${RED}❌ No stats file found. Test may not be running yet.${NC}"
    exit 1
fi

echo "Monitoring: $STATS_FILE"
echo "Press Ctrl+C to stop"
echo ""

while true; do
    clear
    echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  SOLID REFACTORING - ENDURANCE TEST STATUS  ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
    echo ""
    
    if [ -f "$STATS_FILE" ]; then
        cat "$STATS_FILE" | python3 -m json.tool 2>/dev/null || cat "$STATS_FILE"
    fi
    
    echo ""
    echo -e "${BLUE}Last Updated: $(date)${NC}"
    sleep 5
done
