#!/bin/bash

# Cleanup Script: Reset All Databases (PostgreSQL, ChromaDB, Neo4j)
# WARNING: This will delete ALL data!

echo "⚠️  WARNING: Database Cleanup"
echo "============================================================"
echo "This script will DELETE ALL DATA from:"
echo "  - PostgreSQL (users, courses, modules, content, quizzes)"
echo "  - ChromaDB (vector embeddings)"
echo "  - Neo4j (knowledge graph)"
echo "============================================================"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Cleanup cancelled"
  exit 0
fi

echo ""
echo "🗑️  Starting database cleanup..."
echo ""

# 1. Clean PostgreSQL
echo "1️⃣  Cleaning PostgreSQL..."
docker exec teachers_training-postgres-1 psql -U teachers_user -d teachers_training <<EOF
-- Delete all user-related data
DELETE FROM quiz_attempts;
DELETE FROM user_progress;
DELETE FROM users;

-- Delete all content data
DELETE FROM module_content_chunks;
DELETE FROM quiz_questions;
DELETE FROM moodle_quizzes;
DELETE FROM moodle_modules;
DELETE FROM moodle_courses;
DELETE FROM modules;
DELETE FROM content;

-- Reset sequences
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE modules_id_seq RESTART WITH 1;
ALTER SEQUENCE quiz_attempts_id_seq RESTART WITH 1;

-- Verify cleanup
SELECT 'Users:' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'Modules:', COUNT(*) FROM modules
UNION ALL
SELECT 'Courses:', COUNT(*) FROM moodle_courses
UNION ALL
SELECT 'Quiz Attempts:', COUNT(*) FROM quiz_attempts;
EOF

echo "✅ PostgreSQL cleaned"
echo ""

# 2. Clean ChromaDB
echo "2️⃣  Cleaning ChromaDB..."
curl -s -X POST http://localhost:8000/api/v1/reset > /dev/null 2>&1

# Alternative: Delete and recreate collections
docker exec teachers_training-app-1 node -e "
const chromaService = require('./services/chroma.service');
(async () => {
  try {
    await chromaService.initialize();
    // Delete existing collection if it exists
    try {
      await chromaService.client.deleteCollection({ name: 'teachers_training' });
      console.log('ChromaDB collection deleted');
    } catch (e) {
      console.log('No existing collection to delete');
    }
    // Recreate fresh collection
    await chromaService.initialize();
    console.log('ChromaDB collection recreated');
  } catch (error) {
    console.error('ChromaDB cleanup error:', error.message);
  }
})();
" 2>/dev/null

echo "✅ ChromaDB cleaned"
echo ""

# 3. Clean Neo4j
echo "3️⃣  Cleaning Neo4j..."
docker exec teachers_training-neo4j-1 cypher-shell -u neo4j -p password <<EOF
// Delete all nodes and relationships
MATCH (n) DETACH DELETE n;

// Verify cleanup
MATCH (n) RETURN count(n) as total_nodes;
EOF

echo "✅ Neo4j cleaned"
echo ""

echo "============================================================"
echo "✅ ALL DATABASES CLEANED SUCCESSFULLY!"
echo "============================================================"
echo ""
echo "Next steps:"
echo "1. Login to admin portal: http://localhost:3000/admin/login.html"
echo "2. Create courses and modules"
echo "3. Upload content files"
echo "4. Register users with verification"
echo ""
