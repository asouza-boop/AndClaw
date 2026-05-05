import { EventEmitter } from 'events';

export const agentEvents = new EventEmitter();
export const MEMORY_DIGESTED = 'memory.digested';
export const TASK_MUTATED = 'task.mutated';
export const MEETING_MUTATED = 'meeting.mutated';
