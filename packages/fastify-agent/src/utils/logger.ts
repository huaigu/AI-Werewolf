import winston from 'winston';
import { EnvConfig } from './env.js';

export interface LoggerConfig {
  level: string;
  fileEnabled: boolean;
  consoleEnabled: boolean;
}

export function createLogger(config: EnvConfig): winston.Logger {
  const formats = [
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ];

  // 开发环境使用更友好的格式
  if (config.NODE_ENV === 'development') {
    formats.push(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let log = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
          log += `\n${JSON.stringify(meta, null, 2)}`;
        }
        return log;
      })
    );
  }

  const transports: winston.transport[] = [];

  // 控制台输出
  if (config.LOG_CONSOLE_ENABLED) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(...formats),
      })
    );
  }

  // 文件输出
  if (config.LOG_FILE_ENABLED) {
    // 错误日志文件
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        ),
      })
    );

    // 综合日志文件
    transports.push(
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        ),
      })
    );
  }

  const logger = winston.createLogger({
    level: config.LOG_LEVEL,
    transports,
    // 防止 winston 在未捕获异常时退出程序
    exitOnError: false,
  });

  return logger;
}

// 请求日志专用格式化函数
export function formatRequestLog(req: any, res: any, responseTime: number) {
  return {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    body: req.body ? JSON.stringify(req.body) : undefined,
  };
}

// 错误日志格式化函数
export function formatErrorLog(error: Error, context?: any) {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    context: context || {},
  };
}