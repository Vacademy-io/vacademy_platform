-- Create chat_sessions table for storing chatbot session state
CREATE TABLE chat_sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    institute_id VARCHAR(255) NOT NULL,
    context_type VARCHAR(50) NOT NULL,
    context_meta JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_chat_session_institute 
        FOREIGN KEY (institute_id) REFERENCES institutes(id)
);

CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id, status);
CREATE INDEX idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX idx_chat_sessions_last_active ON chat_sessions(last_active DESC);
CREATE INDEX idx_chat_sessions_institute_id ON chat_sessions(institute_id);


-- Create chat_messages table for storing conversation messages
CREATE TABLE chat_messages (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    message_type VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_chat_message_session 
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id, id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX idx_chat_messages_type ON chat_messages(session_id, message_type);

-- Trigger function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers to tables
CREATE TRIGGER trigger_update_chat_sessions
BEFORE UPDATE ON chat_sessions
FOR EACH ROW
EXECUTE FUNCTION update_chat_updated_at();

CREATE TRIGGER trigger_update_chat_messages
BEFORE UPDATE ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_chat_updated_at();

-- Add comments for documentation
COMMENT ON TABLE chat_sessions IS 'Stores AI chatbot session state with passive context';
COMMENT ON TABLE chat_messages IS 'Stores conversation messages including user, assistant, tool_call, and tool_result types';
COMMENT ON COLUMN chat_sessions.context_type IS 'Type of context: slide_doubt, question_doubt, assignment_doubt, chapter_doubt, course_doubt, feedback, help, guide, general';
COMMENT ON COLUMN chat_sessions.context_meta IS 'JSON metadata specific to context_type (e.g., slide_id, question_id)';
COMMENT ON COLUMN chat_messages.message_type IS 'Message type: user, assistant, tool_call, tool_result';
COMMENT ON COLUMN chat_messages.metadata IS 'JSON metadata for tool calls (tool_name, tool_arguments, tool_call_id)';
