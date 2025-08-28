import type { PlayerContext, SeerContext, WitchContext, GameContext, PlayerAnalysis } from '../../shared';
import { Role } from '../../shared';
import type { PlayerServer } from '../../PlayerServer';

function formatPlayerList(players: any[]): string {
  return players.map(p => p.name || p.id || p).join(', ');
}

function formatSpeechSummary(speeches: any[]): string {
  return speeches.map(s => `- ${s.playerId}: "${s.content}"`).join('\n');
}

function formatCurrentVotes(votes: any[] | any): string {
  if (!votes) return '暂无投票';
  
  // 如果是数组格式（旧格式）
  if (Array.isArray(votes)) {
    return votes.map(v => `${v.voter}投${v.target}`).join('，');
  }
  
  // 如果是 AllVotes 格式，提取所有轮次的投票
  const allVotes: string[] = [];
  for (const [round, roundVotes] of Object.entries(votes)) {
    if (Array.isArray(roundVotes)) {
      const roundVoteStr = roundVotes.map((v: any) => `第${round}轮: ${v.voterId}投${v.targetId}`);
      allVotes.push(...roundVoteStr);
    }
  }
  
  return allVotes.length > 0 ? allVotes.join('，') : '暂无投票';
}

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

export function getVillagerVoting(playerServer: PlayerServer, context: PlayerContext, analysisSummary: string): string {
  const playerId = playerServer.getPlayerId();
  const params = {
    playerId: playerId?.toString() || '0',
    role: playerServer.getRole() || Role.VILLAGER,
    alivePlayers: context.alivePlayers,
    speechSummary: Object.values(context.allSpeeches).flat(),
    currentVotes: [] as any[],
    allVotes: context.allVotes,
    currentRound: context.round
  };
  const playerList = formatPlayerList(params.alivePlayers);
  const speechSummary = formatSpeechSummary(params.speechSummary);
  const currentVotes = formatCurrentVotes(params.currentVotes);
  
  return `你是${params.playerId}号玩家，狼人杀游戏中的村民角色。当前投票环节：

${analysisSummary}

存活玩家：[${playerList}]
今日发言摘要：
${speechSummary}
当前投票情况：${currentVotes}

## 【致命错误防范】投票前信息核查
**第一步：准确理解预言家查验结果**
- 预言家说"X是好人/金水" → X是你的队友，预言家可能是真的
- 预言家说"X是狼人/查杀" → X是敌人，预言家可能是真的
- **如果你被查验为"好人"，千万不要因此质疑查验者！**

**第二步：逻辑自检**
- 检查：我是否错误地理解了查验结果？
- 检查：我是否把"金水"错当成了"查杀"？
- 检查：我是否因为被发"好人牌"而错误地敌视预言家？

作为村民，你的投票策略：
1. **首要原则：保护给你发"好人牌"的预言家（除非有确凿证据证明他是假的）**
2. **逻辑验证：重新确认预言家的每一个查验结果，确保理解正确**
3. **优先根据"态势分析摘要"中的高可疑度玩家进行决策**
4. 利用"关键证据"来构建你的投票理由
5. 独立分析，避免盲从被标记为'Follower'的玩家

请返回你的投票决定，格式要求：
- target: 你要投票的玩家ID（数字）
- reason: 你投票的详细理由

**投票理由必须包含以下内容：**
1. 明确复述关键预言家的查验结果（确保理解正确）
2. 说明你对每个查验结果的理解和判断
3. 基于正确理解的查验结果进行逻辑推理
4. 绝对避免"因为被查验为好人而质疑查验者"的致命错误

`;
}

export function getWerewolfVoting(playerServer: PlayerServer, context: PlayerContext, analysisSummary: string): string {
  const playerId = playerServer.getPlayerId();
  const teammateIds = playerServer.getTeammates();
  const params = {
    playerId: playerId?.toString() || '0',
    role: playerServer.getRole() || Role.WEREWOLF,
    alivePlayers: context.alivePlayers,
    speechSummary: Object.values(context.allSpeeches).flat(),
    currentVotes: [] as any[],
    allVotes: context.allVotes,
    currentRound: context.round,
    teammates: teammateIds?.map(id => id.toString())
  };
  const playerList = formatPlayerList(params.alivePlayers);
  const speechSummary = formatSpeechSummary(params.speechSummary);
  const currentVotes = formatCurrentVotes(params.currentVotes);
  const teammates = params.teammates?.join('、') || '暂无队友信息';
  
  return `你是${params.playerId}号玩家，狼人杀游戏中的狼人角色。当前投票环节：

${analysisSummary}

存活玩家：[${playerList}]
你的狼人队友：${teammates}
今日发言摘要：
${speechSummary}
当前投票情况：${currentVotes}

作为狼人，你的投票策略：
1. **攻击"态势分析摘要"中看起来像神职或逻辑好的好人（如被标记为'Leader'或'Logical'）**
2. 保护你的狼队友和可疑度已经很高的队友，可以将票投给其他嫌疑人
3. 利用"关键证据"伪装成好人，攻击其他玩家
4. 制造好人之间的矛盾

请返回你的投票决定，格式要求：
- target: 你要投票的玩家ID（数字）
- reason: 你投票的详细理由

`;
}

export function getSeerVoting(playerServer: PlayerServer, context: SeerContext, analysisSummary: string): string {
  const playerId = playerServer.getPlayerId();
  const params = {
    playerId: playerId?.toString() || '0',
    role: playerServer.getRole() || Role.SEER,
    alivePlayers: context.alivePlayers,
    speechSummary: Object.values(context.allSpeeches).flat(),
    currentVotes: [] as any[],
    allVotes: context.allVotes,
    currentRound: context.round,
    checkResults: Object.fromEntries(
      Object.entries(context.investigatedPlayers).map(([round, data]) => [
        data.target.toString(),
        data.isGood ? 'good' as const : 'werewolf' as const
      ])
    )
  };
  const playerList = formatPlayerList(params.alivePlayers);
  const speechSummary = formatSpeechSummary(params.speechSummary);
  const currentVotes = formatCurrentVotes(params.currentVotes);
  const checkInfo = params.checkResults ? Object.entries(params.checkResults)
    .map(([player, result]) => `- ${player}: ${result === 'good' ? '好人' : '狼人'}`)
    .join('\n') : '暂无查验结果';
  
  return `你是${params.playerId}号玩家，狼人杀游戏中的预言家角色。当前投票环节：

${analysisSummary}

存活玩家：[${playerList}]
今日发言摘要：
${speechSummary}
当前投票情况：${currentVotes}

你的查验结果：
${checkInfo}

作为预言家，你的投票策略：
1. **优先投票给你确认的狼人，结合"态势分析摘要"中的证据**
2. 保护你确认的好人，避免误导性投票
3. 利用"关键证据"引导好人投票正确目标
4. 在身份公开后，发挥领导作用，基于具体分析

请返回你的投票决定，格式要求：
- target: 你要投票的玩家ID（数字）
- reason: 你投票的详细理由

`;
}

export function getWitchVoting(playerServer: PlayerServer, context: WitchContext, analysisSummary: string): string {
  const playerId = playerServer.getPlayerId();
  const params = {
    playerId: playerId?.toString() || '0',
    role: playerServer.getRole() || Role.WITCH,
    alivePlayers: context.alivePlayers,
    speechSummary: Object.values(context.allSpeeches).flat(),
    currentVotes: [] as any[],
    allVotes: context.allVotes,
    currentRound: context.round,
    potionUsed: context.potionUsed
  };
  const playerList = formatPlayerList(params.alivePlayers);
  const speechSummary = formatSpeechSummary(params.speechSummary);
  const currentVotes = formatCurrentVotes(params.currentVotes);
  const potionInfo = params.potionUsed ? 
    `解药${params.potionUsed.heal ? '已用' : '可用'}，毒药${params.potionUsed.poison ? '已用' : '可用'}` 
    : '解药已用，毒药可用';
  
  return `你是${params.playerId}号玩家，狼人杀游戏中的女巫角色。当前投票环节：

${analysisSummary}

存活玩家：[${playerList}]
今日发言摘要：
${speechSummary}
当前投票情况：${currentVotes}
你的药水使用情况：${potionInfo}

作为女巫，你的投票策略：
1. **【首要原则】找到并配合预言家的查验结果**
   - 预言家说"X是好人/金水" → 保护X，X是好人队友
   - 预言家说"X是狼人/查杀" → 投票X，X是确认狼人
   - 预言家的查验信息比你的个人判断更重要
2. **【金水保护】优先保护预言家确认的好人**
   - 避免投票给被预言家验证为好人的玩家
   - 当多人攻击金水玩家时，要为金水玩家辩护
3. **【查杀配合】配合投票预言家确认的狼人**
   - 当预言家指出查杀时，应该积极配合投票
   - 利用你的夜间信息验证预言家的判断
4. **【夜间信息整合】基于你的救治/毒杀信息辅助判断**
   - 你救过的玩家很可能是好人，要保护他们
   - 你毒杀的目标如果是狼人，证明你的判断正确
   - 结合"态势分析摘要"中的证据做最终决策
5. **【身份隐藏】在配合的同时保持隐蔽**
   - 不要过于明显地暴露女巫身份
   - 在必要时可以暗示有重要夜间信息

请返回你的投票决定，格式要求：
- target: 你要投票的玩家ID（数字）
- reason: 你投票的详细理由

**投票理由必须包含以下内容：**
1. **预言家信息分析**：明确说明你对场上预言家查验结果的理解
2. **配合策略说明**：解释你的投票如何配合预言家的信息
3. **夜间信息整合**：说明你的夜间行动（救治/毒杀）如何影响你的判断
4. **最终决策逻辑**：基于以上信息得出投票目标的完整推理过程

`;
}

export function getGuardVoting(playerServer: PlayerServer, context: PlayerContext): string {
  const playerId = playerServer.getPlayerId();
  const params = {
    playerId: playerId?.toString() || '0',
    role: playerServer.getRole() || Role.VILLAGER,
    alivePlayers: context.alivePlayers,
    speechSummary: Object.values(context.allSpeeches).flat(),
    currentVotes: [] as any[],
    allVotes: context.allVotes,
    currentRound: context.round,
    guardHistory: [] as string[]
  };
  const playerList = formatPlayerList(params.alivePlayers);
  const speechSummary = formatSpeechSummary(params.speechSummary);
  const currentVotes = formatCurrentVotes(params.currentVotes);
  const guardInfo = params.guardHistory?.join('，') || '守护历史';
  
  return `你是${params.playerId}号玩家，狼人杀游戏中的守卫角色。当前投票环节：

存活玩家：[${playerList}]
今日发言摘要：
${speechSummary}
当前投票情况：${currentVotes}
你的守护记录：${guardInfo}

作为守卫，你的投票策略：
1. 分析玩家逻辑，投票给最可疑的玩家
2. 隐藏身份，避免被狼人发现
3. 在必要时可以暗示有保护能力
4. 考虑守护对象的安全

请返回你的投票决定，格式要求：
- target: 你要投票的玩家ID（数字）
- reason: 你投票的详细理由

`;
}

export function getHunterVoting(playerServer: PlayerServer, context: PlayerContext): string {
  const playerId = playerServer.getPlayerId();
  const params = {
    playerId: playerId?.toString() || '0',
    role: playerServer.getRole() || Role.VILLAGER,
    alivePlayers: context.alivePlayers,
    speechSummary: Object.values(context.allSpeeches).flat(),
    currentVotes: [] as any[],
    allVotes: context.allVotes,
    currentRound: context.round
  };
  const playerList = formatPlayerList(params.alivePlayers);
  const speechSummary = formatSpeechSummary(params.speechSummary);
  const currentVotes = formatCurrentVotes(params.currentVotes);
  
  return `你是${params.playerId}号玩家，狼人杀游戏中的猎人角色。当前投票环节：

存活玩家：[${playerList}]
今日发言摘要：
${speechSummary}
当前投票情况：${currentVotes}

作为猎人，你的投票策略：
1. 分析玩家逻辑，投票给最可疑的玩家
2. 隐藏身份，避免被狼人发现
3. 在必要时可以威胁或暗示身份
4. 考虑开枪技能的威慑作用

请返回你的投票决定，格式要求：
- target: 你要投票的玩家ID（数字）
- reason: 你投票的详细理由

`;
}

// 工厂函数
export function getRoleVoting(playerServer: PlayerServer, context: GameContext, analysis?: PlayerAnalysis): string {
  const role = playerServer.getRole();
  
  if (!role) {
    throw new Error('PlayerServer must have role set');
  }

  // 生成分析摘要（如果提供了分析数据）
  const analysisSummary = analysis ? formatAnalysisSummary(analysis) : '';
  
  switch (role) {
    case Role.VILLAGER:
      return getVillagerVoting(playerServer, context as PlayerContext, analysisSummary);
    case Role.WEREWOLF:
      return getWerewolfVoting(playerServer, context as PlayerContext, analysisSummary);
    case Role.SEER:
      return getSeerVoting(playerServer, context as SeerContext, analysisSummary);
    case Role.WITCH:
      return getWitchVoting(playerServer, context as WitchContext, analysisSummary);
    default:
      throw new Error(`Unknown role: ${role}`);
  }
}