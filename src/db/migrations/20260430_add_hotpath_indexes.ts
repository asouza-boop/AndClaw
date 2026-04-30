export const name = '20260430_add_hotpath_indexes';

export const up = `
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_memory_items_embedding ON memory_items USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_tasks_status_due_date ON tasks (status, due_date);
CREATE INDEX IF NOT EXISTS idx_entity_tags_entity_type_entity_id ON entity_tags (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_page_links_created_at ON page_links (created_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events (start_time);
`;

export const down = `
DROP INDEX IF EXISTS idx_messages_conversation_id;
DROP INDEX IF EXISTS idx_memory_items_embedding;
DROP INDEX IF EXISTS idx_tasks_status_due_date;
DROP INDEX IF EXISTS idx_entity_tags_entity_type_entity_id;
DROP INDEX IF EXISTS idx_page_links_created_at;
DROP INDEX IF EXISTS idx_calendar_events_start_time;
`;
