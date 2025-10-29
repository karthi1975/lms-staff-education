-- Create course_content table for module-independent file storage
-- Files are indexed to RAG+Graph DB without module assignment

CREATE TABLE IF NOT EXISTS course_content (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  file_name VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  file_path TEXT NOT NULL,
  file_type VARCHAR(100),
  file_size BIGINT,
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  processing_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  processed_at TIMESTAMP,
  chunk_count INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB, -- Store any additional metadata (topics, extracted info, etc.)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_course_content_course_id ON course_content(course_id);
CREATE INDEX IF NOT EXISTS idx_course_content_processed ON course_content(processed);
CREATE INDEX IF NOT EXISTS idx_course_content_processing_status ON course_content(processing_status);
CREATE INDEX IF NOT EXISTS idx_course_content_uploaded_at ON course_content(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_content_metadata ON course_content USING GIN (metadata);

-- Comments
COMMENT ON TABLE course_content IS 'Module-independent file storage for RAG+Graph DB indexing';
COMMENT ON COLUMN course_content.course_id IS 'Course association for organizational purposes only';
COMMENT ON COLUMN course_content.processed IS 'Whether file has been processed through OCR → Chunking → Embeddings';
COMMENT ON COLUMN course_content.chunk_count IS 'Number of chunks created and indexed to ChromaDB';
COMMENT ON COLUMN course_content.metadata IS 'JSON metadata: topics, keywords, extracted entities, etc.';
