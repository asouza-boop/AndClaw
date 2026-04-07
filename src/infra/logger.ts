type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function emit(level: LogLevel, event: string, payload: Record<string, unknown> = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...payload,
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug(event: string, payload: Record<string, unknown> = {}) {
    emit('debug', event, payload);
  },
  info(event: string, payload: Record<string, unknown> = {}) {
    emit('info', event, payload);
  },
  warn(event: string, payload: Record<string, unknown> = {}) {
    emit('warn', event, payload);
  },
  error(event: string, payload: Record<string, unknown> = {}) {
    emit('error', event, payload);
  },
};
