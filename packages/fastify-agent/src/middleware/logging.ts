import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { formatRequestLog, formatErrorLog } from '../utils/logger';
import winston from 'winston';

export interface LoggingOptions {
  logger: winston.Logger;
  logBody?: boolean;
  logResponse?: boolean;
}

export async function loggingMiddleware(
  fastify: FastifyInstance,
  options: LoggingOptions
) {
  const { logger, logBody = true, logResponse = false } = options;

  // 请求开始时记录
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.startTime = Date.now();
  });

  // 请求结束时记录
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const responseTime = Date.now() - (request.startTime || Date.now());
    
    const logData = {
      ...formatRequestLog(request, reply, responseTime),
      ...(logBody && { body: request.body }),
    };

    // 根据状态码决定日志级别
    if (reply.statusCode >= 400) {
      logger.warn('HTTP Request Error', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });

  // 错误处理
  fastify.setErrorHandler(async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
    const responseTime = Date.now() - (request.startTime || Date.now());
    
    const errorLog = {
      ...formatErrorLog(error, {
        method: request.method,
        url: request.url,
        body: logBody ? request.body : undefined,
        responseTime: `${responseTime}ms`,
      }),
    };

    logger.error('Request Error', errorLog);

    // 返回统一错误格式
    const statusCode = error.statusCode || 500;
    const errorResponse = {
      error: true,
      message: error.message || 'Internal Server Error',
      statusCode,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    };

    reply.status(statusCode).send(errorResponse);
  });
}

// 扩展 FastifyRequest 类型以包含 startTime
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}