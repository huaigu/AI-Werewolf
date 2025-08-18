import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  type StartGameParams,
  type PlayerContext,
  type WitchContext,
  type SeerContext,
  SpeechResponseSchema,
  VotingResponseSchema,
  LastWordsResponseSchema
} from '@ai-werewolf/types';
import { MockService } from '../services/MockService.js';
import { createValidationHook, validateResponse } from '../middleware/validation.js';
import { z } from 'zod';
import winston from 'winston';

// 请求体验证 schemas
const startGameSchema = z.object({
  gameId: z.string(),
  playerId: z.number().int().positive(),
  role: z.enum(['villager', 'werewolf', 'seer', 'witch']),
  teammates: z.array(z.number().int().positive()),
});

const playerContextSchema = z.object({
  round: z.number().int().positive(),
  currentPhase: z.enum(['preparing', 'night', 'day', 'voting', 'ended']),
  alivePlayers: z.array(z.object({
    id: z.number().int().positive(),
    isAlive: z.boolean(),
  })),
  allSpeeches: z.record(z.array(z.object({
    playerId: z.number().int().positive(),
    content: z.string(),
    type: z.enum(['player', 'system']).optional(),
  }))),
  allVotes: z.record(z.array(z.object({
    voterId: z.number().int().positive(),
    targetId: z.number().int().positive(),
  }))),
});

export async function registerRoutes(
  fastify: FastifyInstance,
  mockService: MockService,
  logger: winston.Logger
) {
  // POST /api/player/start-game - 开始游戏
  fastify.post('/api/player/start-game', {
    preHandler: createValidationHook({ body: startGameSchema }),
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.body as StartGameParams;
      
      logger.info('开始游戏请求', { 
        gameId: params.gameId, 
        playerId: params.playerId, 
        role: params.role 
      });

      await mockService.startGame(params);
      
      const response = {
        message: 'Game started successfully',
        langfuseEnabled: false // Mock 服务不使用 langfuse
      };

      logger.info('开始游戏响应', response);
      reply.send(response);
    }
  });

  // POST /api/player/speak - 生成发言
  fastify.post('/api/player/speak', {
    preHandler: createValidationHook({ body: playerContextSchema }),
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const context = request.body as PlayerContext;
      
      logger.info('发言请求', { 
        round: context.round, 
        phase: context.currentPhase,
        alivePlayers: context.alivePlayers.length
      });

      const speechResult = await mockService.generateSpeech(context);
      const validatedResponse = validateResponse(SpeechResponseSchema, speechResult);
      
      logger.info('发言响应', { speech: validatedResponse.speech });
      reply.send(validatedResponse);
    }
  });

  // POST /api/player/vote - 生成投票
  fastify.post('/api/player/vote', {
    preHandler: createValidationHook({ body: playerContextSchema }),
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const context = request.body as PlayerContext;
      
      logger.info('投票请求', { 
        round: context.round, 
        alivePlayers: context.alivePlayers.length
      });

      const voteResult = await mockService.generateVote(context);
      const validatedResponse = validateResponse(VotingResponseSchema, voteResult);
      
      logger.info('投票响应', { 
        target: validatedResponse.target, 
        reason: validatedResponse.reason 
      });
      reply.send(validatedResponse);
    }
  });

  // POST /api/player/use-ability - 使用能力
  fastify.post('/api/player/use-ability', {
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const context = request.body as PlayerContext | WitchContext | SeerContext;
      
      logger.info('使用能力请求', { 
        round: (context as PlayerContext).round, 
        phase: (context as PlayerContext).currentPhase 
      });

      try {
        const abilityResult = await mockService.generateNightAction(context);
        
        logger.info('使用能力响应', abilityResult);
        reply.send(abilityResult);
      } catch (error) {
        logger.error('使用能力失败', { error: (error as Error).message });
        reply.status(400).send({ 
          error: true, 
          message: (error as Error).message 
        });
      }
    }
  });

  // POST /api/player/last-words - 遗言
  fastify.post('/api/player/last-words', {
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      logger.info('遗言请求');

      const lastWordsResult = await mockService.generateLastWords();
      const response = { content: lastWordsResult };
      const validatedResponse = validateResponse(LastWordsResponseSchema, response);
      
      logger.info('遗言响应', { content: validatedResponse.content });
      reply.send(validatedResponse);
    }
  });

  // GET /api/player/status - 获取状态
  fastify.get('/api/player/status', {
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      logger.info('状态请求');

      const status = mockService.getStatus();
      
      logger.info('状态响应', status);
      reply.send(status);
    }
  });

  // 健康检查端点
  fastify.get('/health', {
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'fastify-agent',
        version: '1.0.0'
      };
      
      reply.send(health);
    }
  });

  // 根路径信息
  fastify.get('/', {
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const info = {
        name: '@ai-werewolf/fastify-agent',
        version: '1.0.0',
        description: 'AI Werewolf Fastify-based player agent server',
        endpoints: [
          'POST /api/player/start-game',
          'POST /api/player/speak',
          'POST /api/player/vote', 
          'POST /api/player/use-ability',
          'POST /api/player/last-words',
          'GET /api/player/status',
          'GET /health'
        ]
      };
      
      reply.send(info);
    }
  });
}