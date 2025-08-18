import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { EnvConfig } from '../utils/env.js';

// 配置文件 schema，与现有 player 包兼容
const configSchema = z.object({
  server: z.object({
    port: z.number().default(3001),
    host: z.string().default('0.0.0.0'),
  }),
  ai: z.object({
    model: z.string().default('mock-model'),
    maxTokens: z.number().default(1000),
    temperature: z.number().default(0.7),
    provider: z.enum(['mock', 'openrouter', 'openai']).default('mock'),
    apiKey: z.string().optional(),
  }),
  game: z.object({
    personality: z.string().default('default'),
    strategy: z.enum(['aggressive', 'conservative', 'balanced']).default('balanced'),
  }),
  logging: z.object({
    enabled: z.boolean().default(true),
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  }),
});

export type AgentConfig = z.infer<typeof configSchema>;

export class ConfigService {
  private config: AgentConfig;
  private configPath?: string;

  constructor(configPath?: string, envConfig?: EnvConfig) {
    this.configPath = configPath;
    this.config = this.loadConfig(envConfig);
  }

  private loadConfig(envConfig?: EnvConfig): AgentConfig {
    let fileConfig: Partial<AgentConfig> = {};

    // 1. 从文件加载配置
    if (this.configPath) {
      fileConfig = this.loadConfigFromFile(this.configPath);
    }

    // 2. 从环境变量加载配置
    const envConfigParsed = envConfig || {};
    const baseConfig: AgentConfig = {
      server: {
        port: envConfigParsed.PORT || 3001,
        host: envConfigParsed.HOST || '0.0.0.0',
      },
      ai: {
        model: envConfigParsed.AI_MODEL || 'mock-model',
        maxTokens: 1000,
        temperature: 0.7,
        provider: (envConfigParsed.AI_PROVIDER as any) || 'mock',
        apiKey: envConfigParsed.AI_API_KEY,
      },
      game: {
        personality: envConfigParsed.AGENT_PERSONALITY || 'default',
        strategy: envConfigParsed.AGENT_STRATEGY || 'balanced',
      },
      logging: {
        enabled: true,
        level: envConfigParsed.LOG_LEVEL || 'info',
      },
    };

    // 3. 合并配置，文件配置覆盖默认配置
    const mergedConfig = this.mergeConfigs(baseConfig, fileConfig);

    // 4. 验证最终配置
    return this.validateConfig(mergedConfig);
  }

  private loadConfigFromFile(configPath: string): Partial<AgentConfig> {
    try {
      const absolutePath = this.resolveConfigPath(configPath);
      
      if (!existsSync(absolutePath)) {
        console.warn(`⚠️ 配置文件不存在: ${absolutePath}`);
        return {};
      }

      const configContent = readFileSync(absolutePath, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      console.error(`❌ 读取配置文件失败: ${configPath}`, error);
      return {};
    }
  }

  private resolveConfigPath(configPath: string): string {
    // 如果是绝对路径，直接使用
    if (configPath.startsWith('/')) {
      return configPath;
    }
    
    // 相对于项目根目录
    return join(process.cwd(), configPath);
  }

  private mergeConfigs(base: AgentConfig, override: Partial<AgentConfig>): AgentConfig {
    return {
      server: { ...base.server, ...override.server },
      ai: { ...base.ai, ...override.ai },
      game: { ...base.game, ...override.game },
      logging: { ...base.logging, ...override.logging },
    };
  }

  private validateConfig(config: AgentConfig): AgentConfig {
    try {
      return configSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ 配置验证失败:');
        error.errors.forEach(err => {
          console.error(`  ${err.path.join('.')}: ${err.message}`);
        });
        process.exit(1);
      }
      throw error;
    }
  }

  public getConfig(): AgentConfig {
    return this.config;
  }

  public printConfig(): void {
    console.log('\n📋 当前配置:');
    console.log('  服务器配置:');
    console.log(`    - 主机: ${this.config.server.host}`);
    console.log(`    - 端口: ${this.config.server.port}`);
    console.log('  AI 配置:');
    console.log(`    - 提供商: ${this.config.ai.provider}`);
    console.log(`    - 模型: ${this.config.ai.model}`);
    console.log(`    - API密钥: ${this.config.ai.apiKey ? '已设置' : '未设置'}`);
    console.log('  游戏配置:');
    console.log(`    - 个性: ${this.config.game.personality}`);
    console.log(`    - 策略: ${this.config.game.strategy}`);
    console.log('  日志配置:');
    console.log(`    - 启用: ${this.config.logging.enabled}`);
    console.log(`    - 级别: ${this.config.logging.level}`);
    
    if (this.configPath) {
      console.log(`  配置文件: ${this.configPath}`);
    }
    console.log();
  }

  public validateConfigFile(): boolean {
    try {
      configSchema.parse(this.config);
      return true;
    } catch {
      return false;
    }
  }
}

// 命令行参数解析工具
export function parseCommandLineArgs(): { configPath?: string } {
  const args = process.argv.slice(2);
  const configArg = args.find(arg => arg.startsWith('--config='));
  const configPath = configArg ? configArg.split('=')[1] : undefined;
  
  return { configPath };
}