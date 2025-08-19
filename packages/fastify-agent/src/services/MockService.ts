import { 
  Role, 
  GamePhase,
  type StartGameParams,
  type PlayerContext,
  type WitchContext,
  type SeerContext,
  type PlayerId,
  type SpeechResponseType,
  type VotingResponseType,
  type NightActionResponseType
} from '@ai-werewolf/types';
import { v4 as uuidv4 } from 'uuid';
import { AgentConfig } from './ConfigService';

export class MockService {
  private gameId?: string;
  private playerId?: number;
  private role?: Role;
  private teammates?: PlayerId[];
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  // 开始游戏
  async startGame(params: StartGameParams): Promise<void> {
    this.gameId = params.gameId;
    this.playerId = params.playerId;
    this.role = params.role as Role;
    this.teammates = params.teammates;

    // 模拟延迟
    await this.simulateDelay();
  }

  // 生成发言
  async generateSpeech(context: PlayerContext): Promise<SpeechResponseType> {
    await this.simulateDelay();

    const speeches = this.getSpeechTemplates();
    const roleSpeeches = speeches[this.role || Role.VILLAGER];
    const speech = this.getRandomItem(roleSpeeches);

    return {
      speech: this.personalizeContent(speech)
    };
  }

  // 生成投票
  async generateVote(context: PlayerContext): Promise<VotingResponseType> {
    await this.simulateDelay();

    const alivePlayers = context.alivePlayers.filter(p => p.id !== this.playerId);
    const target = this.getRandomItem(alivePlayers).id;
    
    const reasons = this.getVoteReasons();
    const reason = this.getRandomItem(reasons);

    return {
      target,
      reason: this.personalizeContent(reason)
    };
  }

  // 生成夜晚行动
  async generateNightAction(
    context: PlayerContext | WitchContext | SeerContext
  ): Promise<NightActionResponseType> {
    await this.simulateDelay();

    switch (this.role) {
      case Role.WEREWOLF:
        return this.generateWerewolfAction(context);
      case Role.SEER:
        return this.generateSeerAction(context);
      case Role.WITCH:
        return this.generateWitchAction(context as WitchContext);
      default:
        throw new Error(`Role ${this.role} has no night action`);
    }
  }

  // 生成遗言
  async generateLastWords(): Promise<string> {
    await this.simulateDelay();

    const lastWords = [
      "很遗憾要离开游戏了，希望好人阵营能够获胜！",
      "我相信真相终将大白，请大家仔细分析！",
      "虽然我要出局了，但我会在天上看着你们的！",
      "希望我的牺牲能帮助大家找到真正的狼人！",
      "游戏愉快，期待下次再与大家对决！"
    ];

    return this.personalizeContent(this.getRandomItem(lastWords));
  }

  // 获取状态
  getStatus() {
    return {
      gameId: this.gameId,
      playerId: this.playerId,
      role: this.role,
      teammates: this.teammates,
      isAlive: true,
      config: {
        personality: this.config.game.personality,
        strategy: this.config.game.strategy,
        provider: this.config.ai.provider
      }
    };
  }

  // 私有方法

  private async simulateDelay(): Promise<void> {
    const delay = Math.random() * 200 + 100; // 100-300ms 随机延迟
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private getRandomItem<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }

  private personalizeContent(content: string): string {
    const personality = this.config.game.personality;
    const strategy = this.config.game.strategy;

    // 根据个性和策略调整内容风格
    if (personality === 'aggressive' || strategy === 'aggressive') {
      return content.replace(/我觉得/g, '我确信').replace(/可能/g, '一定');
    } else if (personality === 'conservative' || strategy === 'conservative') {
      return content.replace(/一定/g, '可能').replace(/确信/g, '觉得');
    }

    return content;
  }

  private getSpeechTemplates(): Record<Role, string[]> {
    return {
      [Role.VILLAGER]: [
        "我是村民，希望大家能够理性分析局势。",
        "从目前的情况看，我们需要仔细观察每个人的发言。",
        "我觉得今天的讨论很重要，请大家多发表意见。",
        "作为村民，我会尽力帮助大家找出狼人。",
        "我支持大家的分析，让我们团结起来找出真相。"
      ],
      [Role.WEREWOLF]: [
        "我觉得有些人的发言很可疑，大家要小心分析。",
        "从逻辑上看，真正的狼人肯定在隐藏自己。",
        "我建议大家关注那些试图引导讨论方向的人。",
        "今天的投票很关键，我们不能投错人。",
        "我认为应该投给那些行为异常的玩家。"
      ],
      [Role.SEER]: [
        "我有一些信息想要分享给大家。",
        "根据我的观察，我对某些玩家有一些看法。",
        "我觉得我们应该重点关注几个可疑的目标。",
        "从我的角度来看，有些人的身份值得怀疑。",
        "我建议大家相信我的判断，跟随我的投票。"
      ],
      [Role.WITCH]: [
        "我一直在观察局势，现在有一些想法。",
        "从整体情况来看，我们需要更加谨慎。",
        "我手中有一些重要信息，但现在不便透露。",
        "我建议大家保持冷静，理性分析每个人的发言。",
        "我会根据情况做出最有利于好人的选择。"
      ]
    };
  }

  private getVoteReasons(): string[] {
    return [
      "从TA的发言中能感受到明显的引导倾向",
      "TA的逻辑有漏洞，行为比较可疑",
      "TA一直在试图转移大家的注意力",
      "根据我的分析，TA是狼人的概率很高",
      "TA的投票策略和发言不太一致",
      "我觉得TA在故意隐藏什么信息",
      "从整体行为来看，TA最符合狼人特征"
    ];
  }

  private generateWerewolfAction(context: PlayerContext): NightActionResponseType {
    const alivePlayers = context.alivePlayers.filter(
      p => p.id !== this.playerId && !this.teammates?.includes(p.id)
    );

    if (alivePlayers.length === 0) {
      return {
        action: 'idle',
        target: 0,
        reason: "没有可以攻击的目标"
      };
    }

    const target = this.getRandomItem(alivePlayers).id;
    return {
      action: 'kill',
      target,
      reason: `选择攻击玩家${target}，认为TA对我们威胁最大`
    };
  }

  private generateSeerAction(context: PlayerContext): NightActionResponseType {
    const alivePlayers = context.alivePlayers.filter(p => p.id !== this.playerId);
    const target = this.getRandomItem(alivePlayers).id;

    return {
      action: 'investigate',
      target,
      reason: `查验玩家${target}，想确认TA的身份`
    };
  }

  private generateWitchAction(context: WitchContext): NightActionResponseType {
    const { killedTonight, potionUsed } = context;
    let healTarget = 0;
    let poisonTarget = 0;
    let healReason = "今晚不使用解药";
    let poisonReason = "今晚不使用毒药";

    // 决定是否使用解药
    if (killedTonight && !potionUsed.heal) {
      const shouldHeal = Math.random() > 0.5; // 50% 概率使用解药
      if (shouldHeal) {
        healTarget = killedTonight;
        healReason = `救治玩家${killedTonight}，不能让好人出局`;
      }
    }

    // 决定是否使用毒药
    if (!potionUsed.poison) {
      const shouldPoison = Math.random() > 0.7; // 30% 概率使用毒药
      if (shouldPoison) {
        const alivePlayers = context.alivePlayers.filter(p => p.id !== this.playerId);
        if (alivePlayers.length > 0) {
          poisonTarget = this.getRandomItem(alivePlayers).id;
          poisonReason = `毒死玩家${poisonTarget}，认为TA是狼人`;
        }
      }
    }

    return {
      action: (healTarget > 0 || poisonTarget > 0) ? 'using' : 'idle',
      healTarget,
      healReason,
      poisonTarget,
      poisonReason
    };
  }
}