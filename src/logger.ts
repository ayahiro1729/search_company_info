export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function getCurrentLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
    return level;
  }
  return 'info';
}

const activeLevel = getCurrentLevel();

function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] >= levelPriority[activeLevel];
}

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  debug(message: string): void {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', message));
    }
  },
  info(message: string): void {
    if (shouldLog('info')) {
      console.info(formatMessage('info', message));
    }
  },
  warn(message: string, error?: unknown): void {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message), error ?? '');
    }
  },
  error(message: string, error?: unknown): void {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message), error ?? '');
    }
  }
};
