import { z } from 'zod';

// 环境变量验证 schema
const envSchema = z.object({
  // Server
  PORT: z.string().transform(Number).default('3001'),
  HOST: z.string().default('0.0.0.0'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE_ENABLED: z.string().transform(val => val === 'true').default('true'),
  LOG_CONSOLE_ENABLED: z.string().transform(val => val === 'true').default('true'),
  
  // Agent
  AGENT_PERSONALITY: z.string().default('default'),
  AGENT_STRATEGY: z.enum(['aggressive', 'conservative', 'balanced']).default('balanced'),
  
  // AI (future use)
  AI_PROVIDER: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  
  // Game
  GAME_MOCK_ENABLED: z.string().transform(val => val === 'true').default('true'),
  GAME_RESPONSE_DELAY_MS: z.string().transform(Number).default('100'),
  
  // Development
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadEnvConfig(): EnvConfig {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment variable validation failed:');
      error.errors.forEach(err => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}

export function validateEnvConfig(config: Partial<EnvConfig>): boolean {
  try {
    envSchema.parse(config);
    return true;
  } catch {
    return false;
  }
}