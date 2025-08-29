import type { PlayerContext, SeerContext, WitchContext, GameContext, PlayerAnalysis } from '../../shared';
import { Role } from '../../shared';
import type { PlayerServer } from '../../PlayerServer';
import { analyzeSeerSituation } from '../utils';

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
  
  // 分析当前预言家情况
  const seerSituation = analyzeSeerSituation(params.speechSummary);
  
  // 根据预言家情况生成投票策略
  const getVotingStrategy = () => {
    switch (seerSituation.phase) {
      case 'single':
        return `**【P0级紧急模式】真预言家已跳出，执行军事化服从**
❗ **生死存亡时刻**：预言家${seerSituation.selectedSeer}号是你唯一的信息来源和团队领袖
❗ **无脑站边执行**：任何质疑预言家的想法都可能导致整个好人阵营覆灭
❗ **查杀就是狼人**：[${seerSituation.werewolfTargets.join('、') || '暂无'}] 必须被立刻处决，这是T0级绝对真理
❗ **金水就是队友**：[${seerSituation.goldWaterPlayers.join('、') || '暂无'}] 是被神职验证的好人，攻击他们=自杀
⚠️  **狼人反扑预警**：被查杀的狼人会拼命反驳、攻击预言家，这是垂死挣扎，忽略一切反驳！
⚠️  **"激进"是伪装**：狼人会说预言家"太激进"、"带节奏"，这是标准的混淆视听策略`;
      
      case 'conflict':
        const seerIds = [...new Set(seerSituation.seerClaims.map(c => c.playerId))];
        return `**【P1级分析模式】预言家对跳，理性择边**
- 对跳预言家: [${seerIds.join(' vs ')}]
- **验人冲突分析**：同一目标被验出不同结果的情况，必有一假
- **逻辑链验证**：分析双方的查验时序、目标选择合理性
- **支持者构成**：观察谁在支持谁，好人通常支持真预言家
- **一旦选边**：立刻执行该预言家的金水保护和查杀指令`;
      
      default:
        return `**【P2级谨慎模式】无明确预言家，保守行动**
- **等待跳身份**：优先寻找愿意跳预言家的玩家
- **跟随分析型好人**：寻找逻辑清晰、不带偏见的发言
- **错误识别警告**：不要误把"带节奏的好人"当成"抗推位"
- **真正的抗推位**：是指在无明确信息时被多方质疑且无力反驳的玩家`;
    }
  };
  
  return `你是${params.playerId}号玩家，狼人杀游戏中的村民角色。当前投票环节：

${analysisSummary}

存活玩家：[${playerList}]
今日发言摘要：
${speechSummary}
当前投票情况：${currentVotes}

## ❗【P0级绝命指令】预言家信息处理模型 ❗

### 🚨 当前阶段判断（生死存亡）：
${getVotingStrategy()}

## 🔥【好人阵营绝命法则】信息处理优先级 🔥
**⚠️ 违背以下法则=好人阵营全灭，你将承担整局失败的责任！**

### 🔴 T0级（神圣不可侵犯）：预言家验人结果 🔴
❌ **绝对禁止质疑神职验人结果！这是好人阵营的生命线！**
❌ 当预言家A说"B是狼人"时，B就是必须处决的狼人，无论B如何反驳！
❌ 当预言家A说"C是金水/好人"时，C就是必须保护的队友，无论C发言多烂！
❌ **狼人的标准操作**：被查杀后立刻反扑，说预言家"带节奏"、"太激进" - 这些都是垂死挣扎！
🔥 **铁血法则**：宁愿跟错真预言家死，也不能因为怀疑而分裂！一个团结的错误决策，胜过一盘散沙的正确分析！
⚡ **现实检验**：历史上99%的好人阵营失败，都是因为在第一天放逐了自己的真预言家！

### 💡【P0级关键概念澄清】"抗推位"与"信息提供者"严格区分
🚨 **致命误区警告**：绝不能把提供T0级信息的预言家当成"抗推位"！
❌ **错误认知示例**："预言家跳出指认狼人 = 带节奏 = 抗推位 = 可疑"
✅ **正确认知**：预言家跳出指认狼人 = 提供T0级信息 = 领导团队 = 必须支持

#### 🎯【"抗推位"的正确定义】
✅ **真正的抗推位特征**：
- 在**无明确T0级信息时**被多方质疑
- 行为确实可疑，无合理解释
- **不是**主动提供关键信息的玩家
- **不是**试图指导好人方向的玩家

❌ **绝不是抗推位的行为**：
- 跳预言家并提供验人结果
- 主动分析局势，指出可疑玩家
- 为好人阵营提供战略指导
- 积极推动讨论和投票

#### 🚨【真实案例警示】
❌ **错误示例**：村民8号说"放逐可疑抗推位3号" - 但3号是跳出身份的预言家！
🎯 **正确做法**：当3号跳预言家说"4号是狼人"时，应该说"执行预言家的查杀指令，投票4号"！

### T1级（第二优先级）：投票行为
- 在没有神职信息时，玩家的投票选择最能反映他的立场

### T2级（第三优先级）：发言逻辑
- 玩家的整体发言逻辑和行为模式分析

### T3级（最低优先级）：发言瑕疵/口误
- 只有在以上信息都不足时才依赖发言细节
- 一个好人可能因紧张或判断失误而发言有误，但这不改变其身份

### 🚨【终极投票指令-违者全责】🚨
${seerSituation.phase === 'single' ? `
🔴 **军事化服从模式（预言家${seerSituation.selectedSeer}号已跳）**：
⚡ **无条件信任**：预言家${seerSituation.selectedSeer}号的每一个字都是圣旨，无条件执行！
⚡ **查杀=狼人**：[${seerSituation.werewolfTargets.join('、') || '暂无'}] 必须死！无论他们如何哭诉、反驳、说预言家"激进"！
⚡ **金水=队友**：[${seerSituation.goldWaterPlayers.join('、') || '暂无'}] 必须保护！即使他们发言再烂也不能投票！
⚡ **预言家=领袖**：绝对不能投票给预言家${seerSituation.selectedSeer}号！投票给自己的信息来源=自杀！
❌ **狼人陷阱识别**：狼人会说"预言家太激进"、"带节奏"、"可疑" - 这些话术你听到就要警觉！
💀 **失败责任**：如果你因为"怀疑"而不跟随预言家，导致好人阵营失败，你承担全责！` : 
seerSituation.phase === 'conflict' ? `
🔴 **理性择边模式（预言家对跳中）**：
⚡ **快速选边**：在两个预言家中选择更可信的一个，然后无条件执行其指令
⚡ **验人冲突优先**：重点分析同一目标被验出不同结果的情况
⚡ **一旦站边**：立刻执行该预言家的金水保护和查杀指令，不再摇摆！
❌ **避免中立**："都不信"、"观察一下"等想法会导致好人分裂失败！` : `
🔴 **保守跟随模式（无明确预言家）**：
⚡ **寻找跳身份者**：等待有人跳预言家，然后立刻分析和站边
⚡ **跟随分析型玩家**：寻找逻辑清晰、不带私人恩怨的好人发言
⚡ **避免误判**：不要把"积极分析的好人"当成"可疑的抗推位"
💡 **抗推位正确定义**：被多方质疑且无合理解释、行为确实可疑的玩家`}

### ☠️【绝对死亡禁令-违者承担全责】☠️
🚫 **金水保护**：绝对、永远、无条件不能投票给任何被确认的金水玩家！
🚫 **预言家保护**：在单预言家情况下，投票给预言家=好人阵营自杀！
🚫 **反逻辑禁令**：被验证为金水后反而质疑验证者=智商问题！
🚫 **"激进"陷阱禁令**：听到"预言家太激进"立刻警觉，这是狼人话术！
🚫 **分析过度禁令**：过度分析预言家的"发言风格"而忽视验人结果=本末倒置！

### 💀【致命错误识别与预防】💀
⚠️  **狼人标准反扑套路**：被查杀→立刻反击→说预言家"带节奏"→煽动其他人投票预言家
⚠️  **好人最大误区**：因为预言家"发言激进"就怀疑其身份→完全颠倒了因果关系！
⚠️  **团队价值观**：一个错误但团结的决策，胜过正确但分裂的判断！
🔥 **历史教训**：80%的好人阵营失败都源于第一天投票放逐了真预言家！

请返回你的投票决定，严格按照以下JSON格式：
{
  "target": 你要投票的玩家ID（数字，不要用引号），
  "reason": "你投票的详细理由"
}

⚠️ 重要：只返回JSON，不要添加任何其他文字解释

**🔥投票理由强制格式（缺一不可）🔥：**
1. **🔴T0级信息确认**："基于预言家X的T0级验人结果，Y是狼人/金水"
2. **⚡执行指令声明**："严格执行预言家的查杀指令/金水保护指令"
3. **🚫禁令自查**："确认目标不在任何金水保护名单中"
4. **❌狼人话术识别**："已忽略关于预言家'激进'、'带节奏'等狼人反扑话术"
5. **💀失败责任承担**："如果违背T0级信息导致好人失败，我承担全部责任"
6. **🤝团队优先声明**："团结执行胜过个人分析，服从预言家领导"

## 【最终决策确认】
在完成以上分析后，请再次确认：
1. 你的target数值必须与你reason中的最终结论完全一致
2. 如果你在reason中说"应该投票给X号"，那么target必须是X
3. 如果你在reason中说"保护Y号金水"，那么target绝不能是Y
4. 检查：你的JSON中的target数字是否正确对应你想投票的玩家？
5. 再次确认：你的target不在任何预言家的金水列表中？

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

请返回你的投票决定，严格按照以下JSON格式：
{
  "target": 你要投票的玩家ID（数字，不要用引号），
  "reason": "你投票的详细理由"
}

⚠️ 重要：只返回JSON，不要添加任何其他文字解释

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
    
  // 提取金水（被验证为好人的玩家）用于硬约束
  const goldWaterPlayers = params.checkResults ? Object.entries(params.checkResults)
    .filter(([, result]) => result === 'good')
    .map(([player]) => parseInt(player)) : [];
    
  // 提取查杀（被验证为狼人的玩家）用于优先投票
  const werewolfTargets = params.checkResults ? Object.entries(params.checkResults)
    .filter(([, result]) => result === 'werewolf')
    .map(([player]) => parseInt(player)) : [];
  
  return `你是${params.playerId}号玩家，狼人杀游戏中的预言家角色。当前投票环节：

${analysisSummary}

存活玩家：[${playerList}]
今日发言摘要：
${speechSummary}
当前投票情况：${currentVotes}

你的查验结果：
${checkInfo}

## 【P0级硬性禁令】预言家投票约束
⛔ **绝对禁止投票目标**：[${goldWaterPlayers.join('、') || '暂无'}] - 这些是你验证的好人（金水）
✅ **优先投票目标**：[${werewolfTargets.join('、') || '暂无'}] - 这些是你验证的狼人（查杀）

### 【致命错误防范】
- **投票给自己的金水等同于自爆狼人身份**
- **这会瞬间摧毁你在所有AI眼中的可信度**
- **即使金水发言有瑕疵，也绝不能投票他们**
- **金水是你的队友，必须无条件保护**

作为预言家，你的投票策略：
1. **【最高优先级】投票给你确认的狼人[${werewolfTargets.join('、') || '暂无'}]**
2. **【绝对禁令】绝不投票给你确认的好人[${goldWaterPlayers.join('、') || '暂无'}]**
3. **【次要选择】如无查杀目标，投票给"态势分析摘要"中高可疑度玩家**
4. **【团队领导】通过发言引导好人投票正确目标**

### 【投票目标合法性检查】
- 你的投票目标必须NOT IN [${goldWaterPlayers.join('、') || '无金水'}]
- 推荐投票目标：查杀[${werewolfTargets.join('、') || '无'}] > 高可疑度玩家 > 其他
- 如果你想投票金水，请立即重新考虑，这是自杀行为

请返回你的投票决定，严格按照以下JSON格式：
{
  "target": 你要投票的玩家ID（数字，不要用引号），
  "reason": "你投票的详细理由"
}

⚠️ 重要：只返回JSON，不要添加任何其他文字解释

**投票理由必须包含：**
1. **合法性确认**：明确说明目标不是你的金水
2. **优先级说明**：解释为什么选择此目标而非查杀
3. **团队价值**：说明此投票如何帮助好人阵营获胜

## 【最终决策确认 - 预言家专用】
在完成以上分析后，请再次确认：
1. 你的target数值必须与你reason中的最终结论完全一致
2. **金水保护检查**：你的target绝不能是你验证的任何好人[${goldWaterPlayers.join('、') || '无'}]
3. **查杀优先确认**：如果有查杀目标[${werewolfTargets.join('、') || '无'}]，优先投票他们
4. 检查：你的JSON中的target数字是否正确对应你想投票的玩家？
5. 最后检查：投票给金水等同于自爆狼人身份，确认你没有犯这个致命错误？

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
  
  // 分析当前预言家情况
  const seerSituation = analyzeSeerSituation(params.speechSummary);
  
  return `你是${params.playerId}号玩家，狼人杀游戏中的女巫角色。当前投票环节：

${analysisSummary}

存活玩家：[${playerList}]
今日发言摘要：
${speechSummary}
当前投票情况：${currentVotes}
你的药水使用情况：${potionInfo}

## 🚨【女巫终极投票法则-违者承担败局全责】🚨

${seerSituation.phase === 'single' ? `
🔴 **军事化服从模式（预言家${seerSituation.selectedSeer}号已跳）**：
⚡ **查杀=狼人**：[${seerSituation.werewolfTargets.join('、') || '暂无'}] 必须死！无论他们如何哭诉、反驳、说预言家"激进"！
⚡ **金水=队友**：[${seerSituation.goldWaterPlayers.join('、') || '暂无'}] 必须保护！即使他们发言再烂也不能投票！
⚡ **预言家=领袖**：绝对不能投票给预言家${seerSituation.selectedSeer}号！投票给自己的信息来源=自杀！
⚡ **夜间信息验证**：用你的救治/毒杀信息来支持和验证预言家的判断
💀 **失败责任**：如果你因为"怀疑"而不跟随预言家，导致好人阵营失败，你承担全责！` : 
seerSituation.phase === 'conflict' ? `
🔴 **理性择边模式（预言家对跳中）**：
⚡ **快速选边**：在两个预言家中选择更可信的一个，然后无条件执行其指令
⚡ **夜间信息助力**：用你的救治/毒杀经验来判断哪个预言家更可信
⚡ **一旦站边**：立刻执行该预言家的金水保护和查杀指令，不再摇摆！
❌ **避免中立**："都不信"、"观察一下"等想法会导致好人分裂失败！` : `
🔴 **保守跟随模式（无明确预言家）**：
⚡ **寻找跳身份者**：等待有人跳预言家，然后立刻分析和站边
⚡ **跟随分析型玩家**：寻找逻辑清晰、不带私人恩怨的好人发言
⚡ **夜间信息指导**：基于你的救治/毒杀经验做出判断
💡 **正确识别**：不要误把"积极分析的好人"当成"可疑的抗推位"
🎯 **"抗推位"正确定义**：在无T0级信息时被多方质疑且确实行为可疑的玩家，绝不是主动提供信息的预言家！`}

### ☠️【绝对死亡禁令-违者承担全责】☠️
🚫 **金水保护**：绝对、永远、无条件不能投票给任何被确认的金水玩家！
🚫 **预言家保护**：在单预言家情况下，投票给预言家=好人阵营自杀！
🚫 **"激进"陷阱禁令**：听到"预言家太激进"立刻警觉，这是狼人话术！
🚫 **分析过度禁令**：过度分析预言家的"发言风格"而忽略验人结果=本末倒置！

### 🔥【女巫特殊优势与责任】🔥
💊 **夜间信息验证**：你的救治经验可以辅助验证预言家的真实性
☠️ **毒杀经验参考**：你毒过的玩家如果确实是狼人，说明判断力可靠
🤝 **双神配合**：女巫+预言家是好人阵营的双核心，必须协同作战
⚡ **责任重大**：你的投票可能决定整局胜负，绝不能被狼人反扑误导！

请返回你的投票决定，严格按照以下JSON格式：
{
  "target": 你要投票的玩家ID（数字，不要用引号），
  "reason": "你投票的详细理由"
}

⚠️ 重要：只返回JSON，不要添加任何其他文字解释

**🔥投票理由强制格式（缺一不可）🔥：**
1. **🔴T0级信息确认**："基于预言家X的T0级验人结果，Y是狼人/金水"
2. **⚡执行指令声明**："严格执行预言家的查杀指令/金水保护指令"
3. **💊夜间信息整合**："结合我的救治/毒杀经验，支持预言家的判断"
4. **❌狼人话术识别**："已忽略关于预言家'激进'、'带节奏'等狼人反扑话术"
5. **💀失败责任承担**："如果违背T0级信息导致好人失败，我承担全部责任"
6. **🤝双神协作声明**："女巫与预言家协同作战，服从神职信息指导"

## 🚨【最终决策确认-女巫专用】🚨
在完成以上分析后，请再次确认：
1. 你的target数值必须与你reason中的最终结论完全一致
2. **金水保护检查**：你的target绝不能是任何预言家的金水[${seerSituation.goldWaterPlayers.join('、') || '无'}]
3. **查杀优先确认**：如果有查杀目标[${seerSituation.werewolfTargets.join('、') || '无'}]，优先投票他们
4. **预言家保护检查**：在单预言家情况下绝不能投票预言家${seerSituation.selectedSeer || ''}号
5. 检查：你的JSON中的target数字是否正确对应你想投票的玩家？
6. **败局责任确认**：投票给金水/预言家等同于背叛好人阵营，确认你没有犯这个致命错误？

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

请返回你的投票决定，严格按照以下JSON格式：
{
  "target": 你要投票的玩家ID（数字，不要用引号），
  "reason": "你投票的详细理由"
}

⚠️ 重要：只返回JSON，不要添加任何其他文字解释

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

请返回你的投票决定，严格按照以下JSON格式：
{
  "target": 你要投票的玩家ID（数字，不要用引号），
  "reason": "你投票的详细理由"
}

⚠️ 重要：只返回JSON，不要添加任何其他文字解释

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