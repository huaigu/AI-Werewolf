import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

export interface ValidationOptions {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
}

export function createValidationHook(options: ValidationOptions) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 验证请求体
      if (options.body && request.body) {
        request.body = options.body.parse(request.body);
      }

      // 验证查询参数
      if (options.query && request.query) {
        request.query = options.query.parse(request.query);
      }

      // 验证路径参数
      if (options.params && request.params) {
        request.params = options.params.parse(request.params);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400).send({
          error: true,
          message: 'Validation Error',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        });
        return;
      }
      throw error;
    }
  };
}

export function validateResponse<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Response validation failed: ${error.message}`);
    }
    throw error;
  }
}

// 常用的验证 schema
export const commonSchemas = {
  // 分页参数
  pagination: z.object({
    page: z.string().transform(Number).default('1'),
    limit: z.string().transform(Number).default('10'),
  }),
  
  // ID 参数
  id: z.object({
    id: z.string().transform(Number),
  }),
  
  // 游戏相关
  gameId: z.object({
    gameId: z.string().uuid(),
  }),
  
  playerId: z.object({
    playerId: z.number().int().positive(),
  }),
};