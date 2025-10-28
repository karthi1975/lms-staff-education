#!/bin/bash
# Simple automated backup script for Teachers Training System
# Backs up: PostgreSQL database, Docker volumes, application files

BACKUP_DIR="/home/karthi/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_${DATE}"

echo "🔄 Starting backup: $BACKUP_NAME"

# Create backup directory
mkdir -p $BACKUP_DIR

# 1. Backup PostgreSQL database
echo "📦 Backing up PostgreSQL..."
docker exec teachers_training_postgres_1 pg_dump -U teachers_user teachers_training > ${BACKUP_DIR}/postgres_${DATE}.sql

# 2. Backup Neo4j data
echo "📦 Backing up Neo4j..."
docker exec teachers_training_neo4j_1 neo4j-admin database dump neo4j --to-path=/tmp
docker cp teachers_training_neo4j_1:/tmp/neo4j.dump ${BACKUP_DIR}/neo4j_${DATE}.dump 2>/dev/null || echo "Neo4j backup skipped"

# 3. Backup ChromaDB data
echo "📦 Backing up ChromaDB..."
tar -czf ${BACKUP_DIR}/chromadb_${DATE}.tar.gz -C /home/karthi/teachers_training chroma_data 2>/dev/null || echo "ChromaDB backup skipped"

# 4. Backup application files
echo "📦 Backing up application..."
tar -czf ${BACKUP_DIR}/app_${DATE}.tar.gz \
  --exclude='node_modules' \
  --exclude='chroma_data' \
  --exclude='.git' \
  -C /home/karthi teachers_training

# 5. Delete backups older than 7 days
echo "🧹 Cleaning old backups..."
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.dump" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "✅ Backup complete: $BACKUP_NAME"
echo "📁 Location: $BACKUP_DIR"
ls -lh $BACKUP_DIR | tail -5
