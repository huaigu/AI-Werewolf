import type { GameContext, PlayerContext, SeerContext, WitchContext, PlayerAnalysis } from '../../shared';
import { formatPlayerList, formatHistoryEvents } from '../utils';
import { Role } from '../../shared';
import type { PlayerServer } from '../../PlayerServer';

function formatAnalysisSummary(analysis: PlayerAnalysis): string {
  const profilesText = analysis.profiles
    .map(p => {
      const suspicionPercent = Math.round(p.suspicionScore * 100);
      const evidenceText = p.keyEvidence.length > 0 ? p.keyEvidence.join('; ') : '暂无';
      return `  - 玩家 ${p.id} (${p.isAlive ? '存活' : '死亡'}):
    - 可疑度: ${suspicionPercent}%
    - 行为标签: [${p.behaviorTags.join(', ')}]
    - 关键证据: ${evidenceText}`;
    })
    .join('\n');

  return `## 态势分析摘要 (由辅助系统生成)
- 当前阶段: ${analysis.phase}
- 玩家档案与怀疑链:
${profilesText}`;
}

export function getWerewolfNightAction(playerServer: PlayerServer, context: GameContext, analysisSummary: string): string {
  const playerList = formatPlayerList(context.alivePlayers);
  const historyEvents = formatHistoryEvents(['夜间行动阶段']);
  const teammates = playerServer.getTeammates()?.join('、') || '暂无队友信息';
  
  // 添加游戏进度说明，防止AI幻觉
  const gameProgressInfo = context.round === 1 
    ? `【重要提示】现在是第1轮夜间阶段，游戏刚刚开始：
  - 还没有任何白天发言记录
  - 还没有任何投票记录
  - 没有玩家暴露身份
  - 你的击杀决策应基于随机性或位置策略
  - 不要假设或编造不存在的玩家行为`
    : '';
  
  return `你是${playerServer.getPlayerId()}号玩家，狼人杀游戏中的狼人角色。当前游戏状态：

${analysisSummary}

- 存活玩家: [${playerList}]
- 你的狼人队友ID: [${teammates}]
- 当前轮次: 第${context.round}轮
- 历史事件: ${historyEvents}

${gameProgressInfo}

作为狼人，你需要决定：
- action: 固定为'kill'
- target: 要击杀的目标玩家ID（数字）
- reason: 选择该目标的详细理由

击杀策略建议：
1. **基于"态势分析摘要"选择威胁度最高的目标（如被标记为'Leader'或'Logical'的神职）**
2. 优先击杀低可疑度但分析能力强的好人
3. 避免击杀高可疑度的玩家（可能被好人投票出局）
4. 第1轮时基于位置或随机选择目标
5. 与队友协调选择目标

请分析当前局势并选择最佳击杀目标。`;
}

export function getSeerNightAction(playerServer: PlayerServer, context: SeerContext, analysisSummary: string): string {
  const playerList = formatPlayerList(context.alivePlayers);
  const historyEvents = formatHistoryEvents(['夜间行动阶段']);
  const checkInfo = context.investigatedPlayers ? Object.values(context.investigatedPlayers)
    .map((investigation) => {
      const investigationData = investigation as { target: number; isGood: boolean };
      return `玩家${investigationData.target}是${investigationData.isGood ? '好人' : '狼人'}`;
    })
    .join('，') : '暂无查验结果';
  
  // 添加游戏进度说明，防止AI幻觉
  const gameProgressInfo = context.round === 1 
    ? `【重要提示】现在是第1轮夜间阶段，游戏刚刚开始：
  - 还没有任何白天发言记录
  - 还没有任何投票记录
  - 你只能基于随机性或位置选择查验目标
  - 不要假设或编造不存在的玩家行为`
    : '';
  
  return `你是${playerServer.getPlayerId()}号玩家，狼人杀游戏中的预言家角色。当前游戏状态：

${analysisSummary}

- 存活玩家: [${playerList}]
- 当前轮次: 第${context.round}轮
- 历史事件: ${historyEvents}
- 已查验结果: ${checkInfo}

${gameProgressInfo}

作为预言家，你需要决定：
- action: 固定为'investigate'
- target: 要查验的目标玩家ID（数字，不能是${playerServer.getPlayerId()}）
- reason: 选择该玩家的理由

查验策略建议：
1. **基于"态势分析摘要"优先查验高可疑度玩家**
2. 【重要】不能查验自己（${playerServer.getPlayerId()}号玩家）
3. 利用关键证据选择最值得查验的目标
4. 避免查验已经暴露身份的玩家
5. 第1轮时基于位置或随机选择其他玩家
6. 考虑查验结果对白天发言的影响

请分析当前局势并选择最佳查验目标。`;
}

export function getWitchNightAction(playerServer: PlayerServer, context: WitchContext, analysisSummary: string): string {
  const playerList = formatPlayerList(context.alivePlayers);
  const historyEvents = formatHistoryEvents(['夜间行动阶段']);
  const potionInfo = context.potionUsed ? 
    `解药${context.potionUsed.heal ? '已用' : '可用'}，毒药${context.potionUsed.poison ? '已用' : '可用'}` 
    : '解药可用，毒药可用';
  
  // 添加游戏进度说明，防止AI幻觉
  const gameProgressInfo = context.round === 1 
    ? `【重要提示】现在是第1轮夜间阶段，游戏刚刚开始：
  - 还没有任何白天发言记录
  - 还没有任何投票记录
  - 你只知道当前存活的玩家和今晚被杀的玩家
  - 请基于当前已知信息做决策，不要假设或编造不存在的信息`
    : '';
  
  // 根据药水使用状态动态生成可用行动选项
  const availableActions: string[] = [];
  const healUsed = context.potionUsed?.heal || false;
  const poisonUsed = context.potionUsed?.poison || false;
  
  if (!healUsed) {
    availableActions.push("1. 是否使用解药救人（healTarget: 被杀玩家的ID或0表示不救）");
  }
  if (!poisonUsed) {
    availableActions.push(`${healUsed ? '1' : '2'}. 是否使用毒药毒人（poisonTarget: 要毒的玩家ID或0表示不毒）`);
  }
  
  const actionText = availableActions.length > 0 
    ? `作为女巫，你需要决定：\n${availableActions.join('\n')}\n${availableActions.length + 1}. action: 'using'（使用任意药水）或'idle'（不使用药水）`
    : `作为女巫，你的两种药水都已使用完毕：\n- 解药：已用\n- 毒药：已用\n你只能选择 action: 'idle'（不使用药水）`;

  return `你是${playerServer.getPlayerId()}号玩家，狼人杀游戏中的女巫角色。当前游戏状态：

${analysisSummary}

- 存活玩家: [${playerList}]
- 当前轮次: 第${context.round}轮
- 今晚被杀玩家ID: ${context.killedTonight || 0} (0表示无人被杀)
- 历史事件: ${historyEvents}

${gameProgressInfo}

你的药水使用情况：
${potionInfo}

${actionText}

药水使用策略：
${!healUsed ? `
**解药使用策略：**
1. **【重要】如果你自己被杀，强烈建议自救！女巫可以且应该使用解药救治自己**
2. **自救优先级**：除非场上有更重要的已跳身份神职需要救治，否则优先自救保留女巫能力
3. **基于"态势分析摘要"评估被杀玩家的价值（如被标记为'Leader'的好人值得救）**
4. 考虑解药的战略价值和时机` : ''}
${!poisonUsed ? `
**毒药使用策略：**
1. **毒药优先使用在高可疑度且有确凿证据的狼人身上**
2. **基于预言家查验结果：如果有明确查杀信息，优先毒杀已确认的狼人**
3. **配合白天信息：结合发言分析选择毒杀目标**
4. 考虑毒药的战略价值和时机` : ''}
${availableActions.length === 0 ? `
**无可用药水时的策略：**
1. **专注于白天的分析和投票决策**
2. **利用之前使用药水获得的信息指导好人阵营**
3. **隐藏身份，避免暴露女巫身份被针对**` : ''}

注意事项：
${!healUsed ? `- **如果你自己被杀，设置 healTarget 为你自己的玩家ID 来自救**
- 如果救其他人，healTarget设为被杀玩家的ID
- 如果不使用解药，healTarget设为0` : `- **解药已用完，healTarget只能设为0**`}
${!poisonUsed ? `- 如果毒人，poisonTarget设为目标玩家的ID
- 如果不使用毒药，poisonTarget设为0` : `- **毒药已用完，poisonTarget只能设为0**`}
- 如果都不使用或无药可用，action设为'idle'，所有target都设为0
- 女巫自救是合法且推荐的策略，不要因为错误理解规则而放弃自救
- 请为每个决定提供详细的理由（healReason和poisonReason）`;
}

export function getGuardNightAction(playerServer: PlayerServer, context: PlayerContext): string {
  const playerId = playerServer.getPlayerId();
  const params = {
    playerId,
    role: playerServer.getRole(),
    currentRound: context.round,
    alivePlayers: context.alivePlayers,
    historyEvents: [],
    guardHistory: [] as string[]
  };
  const playerList = formatPlayerList(params.alivePlayers);
  const historyEvents = formatHistoryEvents(params.historyEvents);
  const guardInfo = params.guardHistory?.join('，') || '第1夜守护玩家A，第2夜守护玩家B';
  
  return `你是${playerServer.getPlayerId()}号玩家，狼人杀游戏中的守卫角色。当前游戏状态：
- 存活玩家: [${playerList}]
- 当前轮次: 第${context.round}轮
- 历史事件: ${historyEvents}
- 你的守护记录: ${guardInfo}

作为守卫，你的任务是：
1. 选择一名玩家进行守护
2. 保护可能的神职角色
3. 避免连续守护同一玩家

请分析当前局势，特别是：
- 哪些玩家可能是神职角色，需要优先保护？
- 狼人可能会选择击杀谁？
- 如何在白天发言中隐藏身份？`;
}

export function getHunterDeathAction(playerServer: PlayerServer, context: PlayerContext, killedBy: 'werewolf' | 'vote' | 'poison'): string {
  const playerId = playerServer.getPlayerId();
  const params = {
    playerId,
    role: playerServer.getRole(),
    currentRound: context.round,
    alivePlayers: context.alivePlayers,
    historyEvents: [],
    killedBy
  };
  const playerList = formatPlayerList(params.alivePlayers);
  const killedByInfo = params.killedBy === 'werewolf' ? '狼人击杀' : 
                      params.killedBy === 'vote' ? '投票放逐' : '女巫毒杀';
  
  return `你是${playerServer.getPlayerId()}号玩家，狼人杀游戏中的猎人角色。当前游戏状态：
- 存活玩家: [${playerList}]
- 你被${killedByInfo}
- 当前轮次: 第${context.round}轮

作为猎人，你的决策是：
1. 选择一名玩家开枪击杀
2. 优先击杀最可疑的狼人
3. 避免误伤好人
4. 最大化好人阵营收益

请分析当前局势，特别是：
- 哪些玩家最可疑，最可能是狼人？
- 根据之前的发言和行为，谁最值得击杀？
- 如何避免误伤神职角色？`;
}

// 工厂函数 - 统一使用 PlayerServer 和 GameContext
export function getRoleNightAction(playerServer: PlayerServer, context: GameContext, analysis?: PlayerAnalysis): string {
  const role = playerServer.getRole();
  const playerId = playerServer.getPlayerId();
  
  if (!role || playerId === undefined) {
    throw new Error('PlayerServer must have role and playerId set');
  }

  // 生成分析摘要（如果提供了分析数据）
  const analysisSummary = analysis ? formatAnalysisSummary(analysis) : '';
  
  switch (role) {
    case Role.VILLAGER:
      throw new Error('Villager has no night action, should be skipped');
    case Role.WEREWOLF: {
      return getWerewolfNightAction(playerServer, context as PlayerContext, analysisSummary);
    }
    case Role.SEER: {
      return getSeerNightAction(playerServer, context as SeerContext, analysisSummary);
    }
    case Role.WITCH: {
      return getWitchNightAction(playerServer, context as WitchContext, analysisSummary);
    }
    default:
      throw new Error(`Unknown role: ${role}`);
  }
}