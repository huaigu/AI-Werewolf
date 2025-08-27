import { 
  Role, 
  GamePhase,
  type StartGameParams, 
  type PlayerContext, 
  type WitchContext, 
  type SeerContext,
  type PlayerId,
  PersonalityType,
  VotingResponseType,
  SpeechResponseType,
  VotingResponseSchema,
  NightActionResponseType,
  WerewolfNightActionSchema,
  SeerNightActionSchema,
  WitchNightActionSchema,
  SpeechResponseSchema
} from './shared';
import { WerewolfPrompts } from './prompts';
import { generateObject, generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { 
  getAITelemetryConfig,
  createGameSession,
  createPhaseTrace,
  endPhaseTrace,
  logEvent,
  type AITelemetryContext
} from './services/langfuse';
import { PlayerConfig } from './config/PlayerConfig';
import { readFileSync } from 'fs';
import { join } from 'path';

// 角色到夜间行动 Schema 的映射
const ROLE_SCHEMA_MAP = {
  [Role.WEREWOLF]: WerewolfNightActionSchema,
  [Role.SEER]: SeerNightActionSchema,
  [Role.WITCH]: WitchNightActionSchema,
} as const;

export class PlayerServer {
  private gameId?: string;
  private playerId?: number;
  private role?: Role;
  private teammates?: PlayerId[];
  private config: PlayerConfig;
  private guideContent?: string;

  constructor(config: PlayerConfig) {
    this.config = config;
    this.loadGuideContent();
  }

  private loadGuideContent(): void {
    try {
      const guidePath = join(__dirname, 'prompts', 'guide.md');
      this.guideContent = readFileSync(guidePath, 'utf-8');
    } catch (error) {
      console.warn('Failed to load guide.md:', error);
      this.guideContent = '';
    }
  }

  private getRoleSpecificGuide(): string {
    if (!this.guideContent || !this.role) {
      return '';
    }

    // 根据角色提取对应的指南部分
    if (this.role === Role.WEREWOLF) {
      // 提取狼人指南部分 (## 狼人指南 到 ## 神职指南)
      const werewolfStart = this.guideContent.indexOf('## 狼人指南');
      const werewolfEnd = this.guideContent.indexOf('## 神职指南');
      if (werewolfStart !== -1 && werewolfEnd !== -1) {
        return this.guideContent.substring(werewolfStart, werewolfEnd).trim();
      }
    } else if (this.role === Role.SEER || this.role === Role.WITCH) {
      // 提取神职指南部分 (## 神职指南 到 ## 村民指南)
      const godStart = this.guideContent.indexOf('## 神职指南');
      const godEnd = this.guideContent.indexOf('## 村民指南');
      if (godStart !== -1 && godEnd !== -1) {
        return this.guideContent.substring(godStart, godEnd).trim();
      }
    } else if (this.role === Role.VILLAGER) {
      // 提取村民指南部分 (## 村民指南 到最后)
      const villagerStart = this.guideContent.indexOf('## 村民指南');
      if (villagerStart !== -1) {
        return this.guideContent.substring(villagerStart).trim();
      }
    }

    // 如果找不到对应部分，返回完整指南
    return this.guideContent;
  }

  async startGame(params: StartGameParams): Promise<void> {
    this.gameId = params.gameId;
    this.role = params.role as Role;
    this.teammates = params.teammates;
    this.playerId = params.playerId;
    
    // 创建 Langfuse session
    createGameSession(this.gameId, {
      playerId: this.playerId,
      role: this.role,
      teammates: this.teammates
    });
    
    if (this.config.logging.enabled) {
      console.log(`🎮 Player started game ${this.gameId} as ${this.role}`);
      console.log(`👤 Player ID: ${this.playerId}`);
      if (this.teammates && this.teammates.length > 0) {
        console.log(`🤝 Teammates: ${this.teammates.join(', ')}`);
      }
      console.log(`📊 Game ID (session): ${this.gameId}`);
    }
  }

  async speak(context: PlayerContext): Promise<string> {
    if (!this.role || !this.config.ai.apiKey) {
      return "我需要仔细思考一下当前的情况。";
    }

    const speechResponse = await this.generateSpeech(context);
    return speechResponse.speech;
  }

  async vote(context: PlayerContext): Promise<VotingResponseType> {
    if (!this.role || !this.config.ai.apiKey) {
      return { target: 1, reason: "默认投票给玩家1" };
    }

    return await this.generateVote(context);
  }

  async useAbility(context: PlayerContext | WitchContext | SeerContext): Promise<any> {
    if (!this.role || !this.config.ai.apiKey) {
      throw new Error("我没有特殊能力可以使用。");
    }

    return await this.generateAbilityUse(context);
  }

  async lastWords(): Promise<string> {
    // 暂时返回默认遗言，后续可实现AI生成
    return "很遗憾要离开游戏了，希望好人阵营能够获胜！";
  }

  getStatus() {
    return {
      gameId: this.gameId,
      playerId: this.playerId,
      role: this.role,
      teammates: this.teammates,
      isAlive: true,
      config: {
        personality: this.config.game.personality
      }
    };
  }

  // Getter methods for prompt factories
  getRole(): Role | undefined {
    return this.role;
  }

  getPlayerId(): number | undefined {
    return this.playerId;
  }

  getTeammates(): PlayerId[] | undefined {
    return this.teammates;
  }

  getPersonalityPrompt(): string {
    return this.buildPersonalityPrompt();
  }

  getGameId(): string | undefined {
    return this.gameId;
  }

  // 通用AI生成方法
  private async generateWithLangfuse<T>(
    params: {
      functionId: string;
      schema: any;  // Zod schema
      prompt: string;
      maxOutputTokens?: number;
      temperature?: number;
      context?: PlayerContext;  // 使用 PlayerContext 替代 telemetryMetadata
    }
  ): Promise<T> {
    const { functionId, context, schema, prompt, maxOutputTokens, temperature } = params;
    
    console.log(`📝 ${functionId} prompt:`, prompt);
    console.log(`📋 ${functionId} schema:`, JSON.stringify(schema.shape, null, 2));
    
    // 获取遥测配置
    const telemetryConfig = this.getTelemetryConfig(functionId, context);
    
    // 获取角色特定的指南内容
    const roleGuide = this.getRoleSpecificGuide();
    const systemPrompt = roleGuide ? `${roleGuide}\n\n` : '';
    
    try {
      const result = await generateObject({
        model: this.getModel(),
        schema: schema,
        prompt: systemPrompt + "always response in chinese \r\n" + prompt,
        maxOutputTokens: maxOutputTokens || this.config.ai.maxTokens,
        temperature: temperature ?? this.config.ai.temperature,
        // 使用 experimental_telemetry（只有在有配置时才传递）
        ...(telemetryConfig && { experimental_telemetry: telemetryConfig }),
      });

      console.log(`🎯 ${functionId} result:`, JSON.stringify(result.object, null, 2));
      
      return result.object as T;
    } catch (error: any) {
      console.error(`AI ${functionId} failed with generateObject:`, error);
      
      // Fallback: 如果模型不支持 json_schema，使用 generateText + JSON 解析
      const errorMsg = error?.message || error?.toString() || '';
      const isJsonSchemaNotSupported = errorMsg.includes('json_schema') && 
                                      (errorMsg.includes('not supported') || errorMsg.includes('not valid'));
      
      if (isJsonSchemaNotSupported) {
        console.log(`🔄 Falling back to generateText for ${functionId}`);
        return await this.generateWithTextFallback<T>(params);
      }
      
      throw new Error(`Failed to generate ${functionId}: ${error}`);
    }
  }

  // Fallback方法：使用generateText + JSON解析
  private async generateWithTextFallback<T>(
    params: {
      functionId: string;
      schema: any;  // Zod schema
      prompt: string;
      maxOutputTokens?: number;
      temperature?: number;
      context?: PlayerContext;
    }
  ): Promise<T> {
    const { functionId, context, schema, prompt, maxOutputTokens, temperature } = params;
    
    // 获取遥测配置
    const telemetryConfig = this.getTelemetryConfig(functionId, context);
    
    // 获取角色特定的指南内容
    const roleGuide = this.getRoleSpecificGuide();
    const systemPrompt = roleGuide ? `${roleGuide}\n\n` : '';
    
    // 构建包含JSON格式要求的提示词
    const jsonPrompt = systemPrompt + "always response in chinese \r\n" + prompt + 
      `\n\n请严格按照以下JSON格式回答，注意数据类型（数字不要用引号），不要添加任何解释文字，只输出JSON：\n${JSON.stringify(this.getSchemaExample(schema), null, 2)}`;
    
    try {
      const result = await generateText({
        model: this.getModel(),
        prompt: jsonPrompt,
        maxOutputTokens: maxOutputTokens || this.config.ai.maxTokens,
        temperature: temperature ?? this.config.ai.temperature,
        // 使用 experimental_telemetry（只有在有配置时才传递）
        ...(telemetryConfig && { experimental_telemetry: telemetryConfig }),
      });

      console.log(`📄 ${functionId} text result:`, result.text);
      
      // 解析JSON
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // 类型强制转换
      const coerced = this.coerceTypes(parsed, schema);
      
      // 使用schema验证
      const validated = schema.parse(coerced);
      console.log(`🎯 ${functionId} validated result:`, JSON.stringify(validated, null, 2));
      
      return validated as T;
    } catch (error) {
      console.error(`AI ${functionId} fallback failed:`, error);
      throw new Error(`Failed to generate ${functionId} with fallback: ${error}`);
    }
  }

  // 类型强制转换
  private coerceTypes(data: any, schema: any): any {
    const shape = schema.shape || schema._def?.shape;
    if (!shape || !data || typeof data !== 'object') {
      return data;
    }
    
    const coerced = { ...data };
    
    Object.keys(shape).forEach(key => {
      if (coerced[key] === undefined || coerced[key] === null) {
        return; // 跳过缺失的字段
      }
      
      const field = shape[key];
      const fieldType = field._def?.typeName;
      
      if (fieldType === 'ZodNumber') {
        // 字符串数字转换为数字
        if (typeof coerced[key] === 'string' && !isNaN(Number(coerced[key]))) {
          coerced[key] = Number(coerced[key]);
        }
      } else if (fieldType === 'ZodBoolean') {
        // 字符串布尔值转换
        if (typeof coerced[key] === 'string') {
          const lowerValue = coerced[key].toLowerCase();
          if (lowerValue === 'true' || lowerValue === '1') {
            coerced[key] = true;
          } else if (lowerValue === 'false' || lowerValue === '0') {
            coerced[key] = false;
          }
        }
      } else if (fieldType === 'ZodString') {
        // 确保是字符串
        if (typeof coerced[key] !== 'string') {
          coerced[key] = String(coerced[key]);
        }
      }
    });
    
    return coerced;
  }

  // 从schema生成示例JSON
  private getSchemaExample(schema: any): any {
    const shape = schema.shape || schema._def?.shape;
    if (!shape) return {};
    
    const example: any = {};
    Object.keys(shape).forEach(key => {
      const field = shape[key];
      if (field._def?.typeName === 'ZodString') {
        example[key] = "示例文本";
      } else if (field._def?.typeName === 'ZodNumber') {
        example[key] = 1;
      } else if (field._def?.typeName === 'ZodBoolean') {
        example[key] = true;
      } else if (field._def?.typeName === 'ZodEnum') {
        example[key] = field._def.values[0];
      } else {
        example[key] = "示例值";
      }
    });
    
    return example;
  }

  // AI生成方法
  private async generateSpeech(context: PlayerContext): Promise<SpeechResponseType> {
    const prompt = this.buildSpeechPrompt(context);
    
    return this.generateWithLangfuse<SpeechResponseType>({
      functionId: 'speech-generation',
      schema: SpeechResponseSchema,
      prompt: prompt,
      context: context,
    });
  }

  private async generateVote(context: PlayerContext): Promise<VotingResponseType> {
    const prompt = this.buildVotePrompt(context);
    
    return this.generateWithLangfuse<VotingResponseType>({
      functionId: 'vote-generation',
      schema: VotingResponseSchema,
      prompt: prompt,
      context: context,
    });
  }

  private async generateAbilityUse(context: PlayerContext | WitchContext | SeerContext): Promise<NightActionResponseType> {
    if (this.role === Role.VILLAGER) {
      throw new Error('Village has no night action, should be skipped');
    }
    
    const schema = ROLE_SCHEMA_MAP[this.role!];
    if (!schema) {
      throw new Error(`Unknown role: ${this.role}`);
    }

    const prompt = this.buildAbilityPrompt(context);
    
    return this.generateWithLangfuse<NightActionResponseType>({
      functionId: 'ability-generation',
      schema: schema,
      prompt: prompt,
      context: context,
    });
  }

  // Prompt构建方法
  private buildSpeechPrompt(context: PlayerContext): string {
    const speechPrompt = WerewolfPrompts.getSpeech(
      this,
      context
    );

    return speechPrompt + '\n\n注意：发言内容控制在30-80字，语言自然，像真人玩家。';
  }

  private buildVotePrompt(context: PlayerContext): string {
    const personalityPrompt = this.buildPersonalityPrompt();

    const additionalParams = {
      teammates: this.teammates
    };

    // 为预言家添加查验结果
    if (this.role === Role.SEER && 'investigatedPlayers' in context) {
      const seerContext = context as any;
      const checkResults: {[key: string]: 'good' | 'werewolf'} = {};
      
      for (const investigation of Object.values(seerContext.investigatedPlayers)) {
        const investigationData = investigation as { target: number; isGood: boolean };
        checkResults[investigationData.target.toString()] = investigationData.isGood ? 'good' : 'werewolf';
      }
      
      (additionalParams as any).checkResults = checkResults;
    }

    const votingPrompt = WerewolfPrompts.getVoting(
      this,
      context
    );

    return personalityPrompt + votingPrompt;
  }

  private buildAbilityPrompt(context: PlayerContext | WitchContext | SeerContext): string {
    const nightPrompt = WerewolfPrompts.getNightAction(this, context);
    
    return nightPrompt;
  }

  // 辅助方法
  private getModel() {
    const openrouter = createOpenAI({
      baseURL: process.env.BASEURL || "",
      apiKey: this.config.ai.apiKey || process.env.OPENROUTER_API_KEY
    });


    const chatModel =  openrouter.chat(this.config.ai.model);
    return chatModel
  }

  private getTelemetryConfig(
    functionId: string,
    context?: PlayerContext
  ) {
    if (!this.gameId || !this.playerId) {
      return false;
    }
    
    const telemetryContext: AITelemetryContext = {
      gameId: this.gameId,
      playerId: this.playerId,
      functionId,
      context,
    };
    
    return getAITelemetryConfig(telemetryContext);
  }

  private buildPersonalityPrompt(): string {
    if (!this.config.game.strategy) {
      return '';
    }

    const personalityType = this.config.game.strategy === 'balanced' ? 'cunning' : this.config.game.strategy as PersonalityType;
    
    return WerewolfPrompts.getPersonality(personalityType) + '\n\n';
  }
}