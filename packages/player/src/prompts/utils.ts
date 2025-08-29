// 通用工具函数

export function formatPlayerList(players: any[]): string {
  if (!players || !Array.isArray(players)) {
    return '暂无玩家信息';
  }
  return players.filter(p => p.isAlive).map(p => p.id || p).join(', ');
}

export function formatSpeechHistory(history: any[]): string {
  if (!history || !Array.isArray(history)) {
    return '暂无发言记录';
  }
  return history.map(h => `${h.playerId}: "${h.content}"`).join('，');
}

export function formatHistoryEvents(events: string[]): string {
  if (!events || !Array.isArray(events)) {
    return '暂无历史事件';
  }
  return events.join('，');
}

// 预言家声明分析
export interface SeerClaim {
  playerId: number;
  target: number;
  result: 'good' | 'werewolf';
  content: string;
}

export interface SeerSituation {
  seerCount: number;
  seerClaims: SeerClaim[];
  phase: 'none' | 'single' | 'conflict';
  goldWaterPlayers: number[];
  werewolfTargets: number[];
  selectedSeer?: number;
}

// 分析当前场上预言家情况的核心函数
export function analyzeSeerSituation(speeches: any[]): SeerSituation {
  if (!speeches || !Array.isArray(speeches)) {
    return {
      seerCount: 0,
      seerClaims: [],
      phase: 'none',
      goldWaterPlayers: [],
      werewolfTargets: []
    };
  }
  
  const seerClaims: SeerClaim[] = [];
  const seerPlayers = new Set<number>();
  
  // 分析发言中的预言家声明
  speeches.forEach(speech => {
    const content = speech.content || '';
    const playerId = speech.playerId;
    
    // 识别预言家跳身份的关键词
    const seerKeywords = ['预言家', '我是预言', '我预言', '查验', '验人', '金水', '查杀', '我查'];
    const hasSeerKeyword = seerKeywords.some(keyword => content.includes(keyword));
    
    if (hasSeerKeyword) {
      seerPlayers.add(playerId);
      
      // 提取查验结果
      const goodMatches = content.match(/(\d+).*?(金水|好人|是好)/g);
      const badMatches = content.match(/(\d+).*?(查杀|狼人|是狼)/g);
      
      if (goodMatches) {
        goodMatches.forEach(match => {
          const targetMatch = match.match(/(\d+)/);
          if (targetMatch) {
            seerClaims.push({
              playerId,
              target: parseInt(targetMatch[1]),
              result: 'good',
              content: match
            });
          }
        });
      }
      
      if (badMatches) {
        badMatches.forEach(match => {
          const targetMatch = match.match(/(\d+)/);
          if (targetMatch) {
            seerClaims.push({
              playerId,
              target: parseInt(targetMatch[1]),
              result: 'werewolf',
              content: match
            });
          }
        });
      }
    }
  });
  
  const seerCount = seerPlayers.size;
  let phase: 'none' | 'single' | 'conflict' = 'none';
  
  if (seerCount === 0) {
    phase = 'none';
  } else if (seerCount === 1) {
    phase = 'single';
  } else {
    phase = 'conflict';
  }
  
  // 提取金水和查杀目标
  const goldWaterPlayers = seerClaims
    .filter(claim => claim.result === 'good')
    .map(claim => claim.target);
    
  const werewolfTargets = seerClaims
    .filter(claim => claim.result === 'werewolf')
    .map(claim => claim.target);
  
  // 选择主要预言家（单预言家时选择唯一，对跳时需要额外逻辑）
  const selectedSeer = phase === 'single' ? Array.from(seerPlayers)[0] : undefined;
  
  return {
    seerCount,
    seerClaims,
    phase,
    goldWaterPlayers: [...new Set(goldWaterPlayers)],
    werewolfTargets: [...new Set(werewolfTargets)],
    selectedSeer
  };
}