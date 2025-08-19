import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadEnvConfig } from './utils/env';
import { createLogger } from './utils/logger';
import { loggingMiddleware } from './middleware/logging';
import { ConfigService, parseCommandLineArgs } from './services/ConfigService';
import { MockService } from './services/MockService';
import { registerRoutes } from './routes';
import { readFileSync, mkdirSync, existsSync } from 'fs';

async function createServer() {
  // 1. 加载环境配置
  const envConfig = loadEnvConfig();
  
  // 2. 解析命令行参数
  const { configPath } = parseCommandLineArgs();
  
  // 3. 初始化配置服务
  const configService = new ConfigService(configPath, envConfig);
  const config = configService.getConfig();
  
  // 4. 验证配置
  if (!configService.validateConfigFile()) {
    console.error('❌ 配置验证失败，程序退出');
    process.exit(1);
  }
  
  // 5. 创建日志目录
  if (!existsSync('logs')) {
    mkdirSync('logs', { recursive: true });
  }
  
  // 6. 创建日志器
  const logger = createLogger(envConfig);
  
  // 7. 创建 Fastify 实例
  const fastify = Fastify({
    logger: false, // 使用自定义 Winston 日志
    trustProxy: true,
  });

  // 8. 注册 CORS
  await fastify.register(cors, {
    origin: true, // 允许所有来源，生产环境应该配置具体的域名
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // 9. 注册日志中间件
  await fastify.register(loggingMiddleware, { 
    logger, 
    logBody: true, 
    logResponse: false 
  });

  // 10. 创建 Mock 服务
  const mockService = new MockService(config);

  // 11. 注册路由
  await registerRoutes(fastify, mockService, logger);

  return { fastify, config, logger };
}

async function startServer() {
  let server: { fastify: any; config: any; logger: any } | null = null;
  
  try {
    // 创建服务器
    server = await createServer();
    const { fastify, config, logger } = server;
    
    // 打印配置信息
    console.log('\n🚀 启动 AI-Werewolf Fastify Agent');
    console.log('=====================================');
    
    const configService = new ConfigService();
    configService.printConfig();
    
    // 启动服务器
    const address = await fastify.listen({
      port: config.server.port,
      host: config.server.host
    });
    
    logger.info('🚀 Fastify Agent 服务器启动成功', {
      address,
      port: config.server.port,
      host: config.server.host,
      environment: process.env.NODE_ENV || 'development'
    });
    
    console.log(`🌐 服务器运行在: ${address}`);
    console.log(`📊 健康检查: ${address}/health`);
    console.log(`📚 API 文档: ${address}/`);
    console.log('=====================================\n');

  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    if (server) {
      server.logger.error('服务器启动失败', { error });
    }
    process.exit(1);
  }
  
  return server;
}

// 优雅关闭处理
async function gracefulShutdown(signal: string, server: any) {
  if (!server) return;
  
  const { fastify, logger } = server;
  
  logger.info(`收到 ${signal} 信号，开始优雅关闭服务器...`);
  console.log(`\n📊 收到 ${signal} 信号，正在关闭服务器...`);
  
  try {
    await fastify.close();
    logger.info('Fastify 服务器已关闭');
    console.log('✅ 服务器已优雅关闭');
  } catch (error) {
    logger.error('关闭服务器时出错', { error });
    console.error('❌ 关闭服务器时出错:', error);
  }
  
  process.exit(0);
}

// 启动服务器
const server = await startServer();

// 监听进程信号
process.on('SIGTERM', () => gracefulShutdown('SIGTERM', server));
process.on('SIGINT', () => gracefulShutdown('SIGINT', server));

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('💥 未捕获的异常:', error);
  if (server) {
    server.logger.error('未捕获的异常', { error });
  }
  gracefulShutdown('uncaughtException', server);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 未处理的Promise拒绝:', reason, 'at:', promise);
  if (server) {
    server.logger.error('未处理的Promise拒绝', { reason, promise });
  }
  gracefulShutdown('unhandledRejection', server);
});