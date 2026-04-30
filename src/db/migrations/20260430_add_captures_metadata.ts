export const name = '20260430_add_captures_metadata';

export const up = `
ALTER TABLE captures
ADD COLUMN IF NOT EXISTS metadata JSONB;

ALTER TABLE memory_items
ADD COLUMN IF NOT EXISTS memory_type TEXT DEFAULT 'contextual',
ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW();
`;

export const down = `
ALTER TABLE captures
DROP COLUMN IF EXISTS metadata;

ALTER TABLE memory_items
DROP COLUMN IF EXISTS last_accessed_at,
DROP COLUMN IF EXISTS usage_count,
DROP COLUMN IF EXISTS memory_type;
`;
