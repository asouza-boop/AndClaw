export const name = '20260430_add_tasks_metadata';

export const up = `
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS metadata JSONB;
`;

export const down = `
ALTER TABLE tasks
DROP COLUMN IF EXISTS metadata;
`;
