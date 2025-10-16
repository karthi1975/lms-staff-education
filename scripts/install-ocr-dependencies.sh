#!/bin/bash
# Install OCR dependencies on GCP instance

set -e

echo "🔧 Installing OCR Dependencies for Business Studies Indexing"
echo "=============================================================="
echo ""

echo "📦 Updating package lists..."
sudo apt-get update -qq

echo ""
echo "📦 Installing Tesseract OCR..."
sudo apt-get install -y tesseract-ocr tesseract-ocr-eng

echo ""
echo "📦 Installing poppler-utils (for pdftoppm)..."
sudo apt-get install -y poppler-utils

echo ""
echo "✅ Checking installations..."
echo ""

echo "Tesseract version:"
tesseract --version | head -1

echo ""
echo "pdftoppm version:"
pdftoppm -v 2>&1 | head -1

echo ""
echo "=============================================================="
echo "🎉 OCR dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "  1. Upload the OCR indexing script to GCP"
echo "  2. Run: docker exec teachers_training_app_1 node /app/scripts/ocr-index-business-studies.js"
echo ""
