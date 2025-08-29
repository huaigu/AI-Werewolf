import type { PlayerContext, SeerContext, WitchContext, GameContext, PlayerAnalysis } from '../../shared';
import { Role } from '../../shared';
import { formatPlayerList, formatSpeechHistory, analyzeSeerSituation } from '../utils';
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

// 通用的 JSON 格式说明函数
function getSpeechFormatInstruction(role: Role): string {
  let roleSpecificTip = '';
  
  switch (role) {
    case Role.VILLAGER:
      roleSpecificTip = '要符合村民身份，分析逻辑，不要暴露太多信息。';
      break;
    case Role.WEREWOLF:
      roleSpecificTip = '要伪装成好人，避免暴露狼人身份，可以适当误导其他玩家。';
      break;
    case Role.SEER:
      roleSpecificTip = '要合理传达查验信息，但要避免过早暴露身份被狼人针对。';
      break;
    case Role.WITCH:
      roleSpecificTip = '要隐藏女巫身份，可以暗示重要信息但不要直接暴露。';
      break;
    default:
      roleSpecificTip = '要符合你的角色身份。';
  }
  
  return `
请返回JSON格式，包含以下字段：
- speech: 你的发言内容（30-80字的自然对话，其他玩家都能听到）

注意：speech字段是你的公开发言，${roleSpecificTip}`;
}

export function getVillagerSpeech(playerServer: PlayerServer, context: PlayerContext, analysisSummary: string): string {
  const playerId = playerServer.getPlayerId();
  if (playerId === undefined) {
    throw new Error('PlayerServer must have playerId set');
  }
  const personalityPrompt = playerServer.getPersonalityPrompt();
  const params = {
    playerId: playerId.toString(),
    playerName: `Player${playerId}`,
    role: 'villager',
    speechHistory: Object.values(context.allSpeeches).flat(),
    customContent: personalityPrompt,
    suspiciousPlayers: [] as string[],
    logicalContradictions: ''
  };
  const playerList = formatPlayerList(context.alivePlayers);
  const speechSummary = formatSpeechHistory(params.speechHistory);
  const customContent = params.customContent || '';
  
  // 分析当前预言家情况
  const seerSituation = analyzeSeerSituation(params.speechHistory);
  
  // 根据预言家情况生成阶段策略
  const getPhaseStrategy = () => {
    switch (seerSituation.phase) {
      case 'single':
        return `**第一阶段：默认站边**
- 预言家${seerSituation.selectedSeer}号是你的临时领袖
- 金水保护目标: [${seerSituation.goldWaterPlayers.join('、') || '暂无'}]
- 查杀攻击目标: [${seerSituation.werewolfTargets.join('、') || '暂无'}]
- **铁律**：绝对不能攻击唯一预言家及其金水`;
      
      case 'conflict':
        const seerIds = [...new Set(seerSituation.seerClaims.map(c => c.playerId))];
        return `**第二阶段：对抗分析**
- 对跳预言家: [${seerIds.join(' vs ')}]
- 需要理性分析谁更可信
- 查看验人信息冲突、发言逻辑链、支持者构成`;
      
      default:
        return `**第三阶段：风险决策**
- 当前无明确预言家信息
- 专注于逻辑分析和行为观察
- 等待预言家跳出或更多信息`;
    }
  };
  
  return `你是${params.playerId}号玩家，狼人杀游戏中的村民角色，性格特点：正直、逻辑清晰。当前游戏状态：

${analysisSummary}

- 存活玩家: [${playerList}]
- 当前发言轮次: 第${context.round}轮
- 历史发言摘要: ${speechSummary}

${customContent}

## 【村民核心策略】预言家信息处理模型

### 当前阶段判断：
${getPhaseStrategy()}

### 【最高优先级指令】
在狼人杀中，预言家是好人阵营的唯一信息来源和战术核心。你的首要任务是找到真预言家并围绕其信息展开行动。

### 发言执行要点：
${seerSituation.phase === 'single' ? `
1. **无条件支持**：坚决维护预言家${seerSituation.selectedSeer}号的权威
2. **金水保护**：为被验证的好人[${seerSituation.goldWaterPlayers.join('、') || '暂无'}]辩护
3. **查杀执行**：积极攻击被查杀的狼人[${seerSituation.werewolfTargets.join('、') || '暂无'}]
4. **统一行动**：你的发言必须与预言家的指令保持一致` : 
seerSituation.phase === 'conflict' ? `
1. **逻辑分辨**：分析对跳双方的可信度和逻辑一致性
2. **验人冲突**：重点关注同一目标被验出不同结果的情况
3. **选边站队**：基于分析结果选择支持的预言家
4. **团队意识**：避免独狼式分析，寻找可信任的好人盟友` : `
1. **信息收集**：专注于识别潜在的预言家跳出
2. **行为观察**：分析玩家发言中的逻辑矛盾和可疑行为
3. **保守策略**：避免激进发言，等待更多确定信息
4. **团队合作**：寻找逻辑清晰的好人玩家建立信任`}

### 【绝对禁令】
- 绝对不能攻击唯一预言家（除非有确凿证据证明其为假）
- 绝对不能攻击预言家确认的金水
- 绝对不能因为被验证为"好人"而质疑验证者

${getSpeechFormatInstruction(Role.VILLAGER)}`;
}

export function getWerewolfSpeech(playerServer: PlayerServer, context: PlayerContext, analysisSummary: string): string {
  const playerId = playerServer.getPlayerId();
  if (playerId === undefined) {
    throw new Error('PlayerServer must have playerId set');
  }
  const teammateIds = playerServer.getTeammates();
  const personalityPrompt = playerServer.getPersonalityPrompt();
  const params = {
    playerId: playerId.toString(),
    playerName: `Player${playerId}`,
    role: 'werewolf',
    speechHistory: Object.values(context.allSpeeches).flat(),
    teammates: teammateIds?.map(id => id.toString()),
    customContent: personalityPrompt,
    suspiciousPlayers: [] as string[],
    killedLastNight: 'unknown'
  };
  const playerList = formatPlayerList(context.alivePlayers);
  const speechSummary = formatSpeechHistory(params.speechHistory);
  const teammateList = params.teammates?.join('、') || '暂无队友信息';
  const killedInfo = params.killedLastNight || '无人被杀';
  
  const customContent = params.customContent || '';
  
  return `你是${params.playerId}号玩家，狼人杀游戏中的狼人角色，性格特点：狡猾、善于伪装。当前游戏状态：

${analysisSummary}

- 存活玩家: [${playerList}]
- 当前发言轮次: 第${context.round}轮
- 历史发言摘要: ${speechSummary}
- 你的狼人队友: [${teammateList}]

${customContent}

作为狼人，你的发言策略：
1. **利用"态势分析摘要"误导好人，避免自己成为高可疑度目标**
2. 攻击被标记为'Leader'或'Logical'的神职玩家
3. 保护队友，利用关键证据为队友辩护或转移注意力
4. 制造混乱，引导好人投票给其他好人
5. 伪装成分析能力强的好人

当前局势分析：
- 今晚被杀的玩家: ${killedInfo}
- 当前投票情况: ${speechSummary}
- 需要重点关注的玩家: ${params.suspiciousPlayers?.join('、') || '暂无'}
${getSpeechFormatInstruction(Role.WEREWOLF)}`;
}

export function getSeerSpeech(playerServer: PlayerServer, context: SeerContext, analysisSummary: string): string {
  const playerId = playerServer.getPlayerId();
  if (playerId === undefined) {
    throw new Error('PlayerServer must have playerId set');
  }
  const personalityPrompt = playerServer.getPersonalityPrompt();
  const params = {
    playerId: playerId.toString(),
    playerName: `Player${playerId}`,
    role: 'seer',
    speechHistory: Object.values(context.allSpeeches).flat(),
    customContent: personalityPrompt,
    suspiciousPlayers: [] as string[]
  };
  const playerList = formatPlayerList(context.alivePlayers);
  const speechSummary = formatSpeechHistory(params.speechHistory);
  
  // 处理查验结果
  let checkInfo = '暂无查验结果';
  if (context.investigatedPlayers && Object.keys(context.investigatedPlayers).length > 0) {
    const results: string[] = [];
    for (const investigation of Object.values(context.investigatedPlayers)) {
      const investigationData = investigation as { target: number; isGood: boolean };
      results.push(`${investigationData.target}号是${investigationData.isGood ? '好人' : '狼人'}`);
    }
    checkInfo = results.join('，');
  }
  
  const customContent = params.customContent || '';
  
  return `你是${params.playerId}号玩家，狼人杀游戏中的预言家角色，性格特点：理性、分析能力强。当前游戏状态：

${analysisSummary}

- 存活玩家: [${playerList}]
- 当前发言轮次: 第${context.round}轮
- 历史发言摘要: ${speechSummary}
- 你的查验结果: ${checkInfo}

${customContent}

作为预言家，你的发言策略：
1. **结合"态势分析摘要"和查验结果，精准指控狼人**
2. 利用关键证据增强发言说服力
3. 在适当时机公布身份（通常在确认2只狼人后）
4. 避免过早暴露导致被狼人针对，但要展现分析能力

当前局势分析：
- 可疑玩家: ${params.suspiciousPlayers?.join('、') || '根据查验结果确定'}
- 需要保护的玩家: 暂无
${getSpeechFormatInstruction(Role.SEER)}`;
}

export function getWitchSpeech(playerServer: PlayerServer, context: WitchContext, analysisSummary: string): string {
  const playerId = playerServer.getPlayerId();
  if (playerId === undefined) {
    throw new Error('PlayerServer must have playerId set');
  }
  const personalityPrompt = playerServer.getPersonalityPrompt();
  const params = {
    playerId: playerId.toString(),
    playerName: `Player${playerId}`,
    role: 'witch',
    speechHistory: Object.values(context.allSpeeches).flat(),
    customContent: personalityPrompt,
    suspiciousPlayers: [] as string[]
  };
  const playerList = formatPlayerList(context.alivePlayers);
  const speechSummary = formatSpeechHistory(params.speechHistory);
  const potionInfo = context.potionUsed ? 
    `解药${context.potionUsed.heal ? '已用' : '可用'}，毒药${context.potionUsed.poison ? '已用' : '可用'}` 
    : '解药可用，毒药可用';
  const killedInfo = context.killedTonight ? `${context.killedTonight}号` : '无人被杀';
  
  const customContent = params.customContent || '';
  
  return `你是${params.playerId}号玩家，狼人杀游戏中的女巫角色，性格特点：谨慎、观察力强。当前游戏状态：

${analysisSummary}

- 存活玩家: [${playerList}]
- 当前发言轮次: 第${context.round}轮
- 历史发言摘要: ${speechSummary}
- 你的药水使用情况: ${potionInfo}

${customContent}

作为女巫，你的发言策略：
1. **基于"态势分析摘要"和夜间信息，巧妙暗示重要线索**
2. 隐藏身份，避免被狼人发现
3. 利用关键证据引导好人投票正确目标
4. 在必要时可以半报身份，展现分析能力

当前局势分析：
- 今晚被杀的玩家: ${killedInfo}（你${context.potionUsed?.heal ? '已救' : '未救'}）
- 是否使用毒药: ${context.potionUsed?.poison ? '已使用' : '未使用'}
- 可疑玩家: ${params.suspiciousPlayers?.join('、') || '暂无明确目标'}
${getSpeechFormatInstruction(Role.WITCH)}`;
}


// 工厂函数
export function getRoleSpeech(playerServer: PlayerServer, context: GameContext, analysis?: PlayerAnalysis): string {
  const role = playerServer.getRole();
  
  if (!role) {
    throw new Error('PlayerServer must have role set');
  }

  // 生成分析摘要（如果提供了分析数据）
  const analysisSummary = analysis ? formatAnalysisSummary(analysis) : '';
  
  switch (role) {
    case Role.VILLAGER:
      return getVillagerSpeech(playerServer, context as PlayerContext, analysisSummary);
    case Role.WEREWOLF:
      return getWerewolfSpeech(playerServer, context as PlayerContext, analysisSummary);
    case Role.SEER:
      return getSeerSpeech(playerServer, context as SeerContext, analysisSummary);
    case Role.WITCH:
      return getWitchSpeech(playerServer, context as WitchContext, analysisSummary);
    default:
      throw new Error(`Unknown role: ${role}`);
  }
}