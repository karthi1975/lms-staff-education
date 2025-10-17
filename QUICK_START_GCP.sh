#!/bin/bash

# Quick Start Script for GCP Quiz Upload Fix
# Copy this entire script to your GCP instance and run it

echo "============================================"
echo "Quiz Upload Fix - Quick Start"
echo "============================================"
echo ""

cd ~/teachers_training

echo "Step 1: Pulling latest code from GitHub..."
git pull origin master

if [ $? -ne 0 ]; then
    echo "❌ Git pull failed"
    exit 1
fi

echo "✅ Code updated"
echo ""

echo "Step 2: Restarting Docker containers..."
sudo docker-compose restart app

echo "Waiting 15 seconds for app to start..."
sleep 15

echo "✅ App restarted"
echo ""

echo "Step 3: Running course-module structure setup..."
chmod +x fix-course-module-structure.sh
./fix-course-module-structure.sh

echo ""
echo "============================================"
echo "✅ Setup Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Open admin portal: http://YOUR_GCP_IP:3000/admin/lms-dashboard.html"
echo "2. Navigate to 'Business Studies Form Two' course"
echo "3. Open browser DevTools (F12) and go to Console tab"
echo "4. Click '📝 Upload Quiz' for each module"
echo "5. Watch console to see module IDs being used"
echo "6. Upload corresponding quiz files from quizzes/CORRECT_MODULES/"
echo ""
echo "Module Quiz Mapping:"
echo "  Module 1 (Production)   → module_01_production.json"
echo "  Module 2 (Financing)    → module_02_financing.json"
echo "  Module 3 (Management)   → module_03_management.json"
echo "  Module 4 (Warehousing)  → module_04_warehousing.json"
echo "  Module 5 (Opportunity)  → module_05_opportunity.json"
echo ""
echo "See COMPLETE_QUIZ_UPLOAD_FIX.md for full documentation"
echo ""
