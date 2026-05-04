export const name = '20260502_tasks_unique_title_meeting_id';

export const up = `
CREATE UNIQUE INDEX IF NOT EXISTS tasks_title_meeting_id_uidx
ON tasks (title, (metadata->>'meeting_id'))
WHERE metadata->>'meeting_id' IS NOT NULL;
`;

export const down = `
DROP INDEX IF EXISTS tasks_title_meeting_id_uidx;
`;
