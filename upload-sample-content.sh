#!/bin/bash

# Upload sample education material to ChromaDB

echo "Uploading education material to ChromaDB..."

# Upload the education PDF
curl -X POST http://localhost:3000/api/content/bulk \
  -F "files=@uploads/1759260466537-Education_Material.pdf" \
  -F "moduleId=1"

echo ""
echo "Upload complete!"
