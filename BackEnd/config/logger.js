'use strict';

const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),

  // In development: human-readable coloured output via pino-pretty.
  // In production: newline-delimited JSON — ship to your log aggregator.
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize:        true,
          translateTime:   'SYS:yyyy-mm-dd HH:MM:ss',
          ignore:          'pid,hostname',
          singleLine:      false,
        },
      }
    : undefined,

  // Production JSON includes timestamp automatically.
  ...(isDev ? {} : { timestamp: pino.stdTimeFunctions.isoTime }),
});

module.exports = logger;
