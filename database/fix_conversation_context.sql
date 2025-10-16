-- Fix: Create missing conversation_context table
-- This table is required by moodle-orchestrator.service.js

CREATE TABLE IF NOT EXISTS conversation_context (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    whatsapp_id VARCHAR(20) NOT NULL,
    conversation_state VARCHAR(50) DEFAULT 'course_selection',
    current_course_id INTEGER,
    current_module_id INTEGER,
    current_question_index INTEGER,
    quiz_answers JSONB,
    context_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_context_user ON conversation_context(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_context_whatsapp ON conversation_context(whatsapp_id);
CREATE INDEX IF NOT EXISTS idx_conversation_context_state ON conversation_context(conversation_state);
CREATE INDEX IF NOT EXISTS idx_conversation_context_activity ON conversation_context(last_activity_at);

-- Grant permissions
GRANT ALL PRIVILEGES ON conversation_context TO teachers_user;
GRANT ALL PRIVILEGES ON SEQUENCE conversation_context_id_seq TO teachers_user;

-- Success message
SELECT 'conversation_context table created successfully!' as status;
