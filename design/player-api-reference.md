# 玩家 API 参考

## 概述

玩家 API 定义了游戏主控与 AI 玩家服务之间的 HTTP 接口。每个 AI 玩家作为独立的 Express 服务器运行，暴露 RESTful 端点用于游戏交互。

## 基础配置

- **协议**: HTTP/HTTPS
- **Content-Type**: `application/json`
- **玩家端口**: 3001-3008 (独立 AI 玩家)
- **基础 URL 格式**: `http://localhost:{port}/api/player`

## 核心端点

### 1. 开始游戏

使用游戏上下文和角色分配初始化玩家。

**端点**: `POST /api/player/start-game`

**请求体**:
```typescript
interface StartGameParams {
  gameId: string;        // 唯一游戏标识符
  playerId: number;      // 玩家 ID (1-8)
  role: string;          // "villager" | "werewolf" | "seer" | "witch"
  teammates: number[];   // 队友 ID (仅狼人)
}
```

**响应**:
```typescript
{
  "success": true,
  "message": "Game started successfully"
}
```

**示例**:
```bash
curl -X POST http://localhost:3001/api/player/start-game \
  -H "Content-Type: application/json" \
  -d '{
    "gameId": "game-123",
    "playerId": 1,
    "role": "werewolf",
    "teammates": [3, 7]
  }'
```

### 2. 生成发言

请求 AI 玩家在白天阶段生成上下文相关的发言。

**端点**: `POST /api/player/speak`

**请求体**:
```typescript
interface SpeechRequest {
  context: PlayerContext;  // 完整游戏上下文
}

interface PlayerContext {
  round: number;                    // 当前回合数
  currentPhase: GamePhase;         // "day" | "night" | "voting"
  alivePlayers: PlayerInfo[];      // 存活玩家列表
  allSpeeches: AllSpeeches;        // 按回合的历史发言
  allVotes: AllVotes;              // 按回合的历史投票
}

interface PlayerInfo {
  id: number;
  isAlive: boolean;
}

type AllSpeeches = Record<number, Speech[]>;
type AllVotes = Record<number, Vote[]>;

interface Speech {
  playerId: number;
  content: string;
  type?: "player" | "system";
}

interface Vote {
  voterId: number;
  targetId: number;
}
```

**响应**:
```typescript
interface SpeechResponse {
  speech: string;  // AI 生成的发言内容 (30-80 字符)
}
```

**示例**:
```bash
curl -X POST http://localhost:3001/api/player/speak \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "round": 1,
      "currentPhase": "day",
      "alivePlayers": [{"id": 1, "isAlive": true}, {"id": 2, "isAlive": true}],
      "allSpeeches": {},
      "allVotes": {}
    }
  }'
```

### 3. 生成投票

请求 AI 玩家在投票阶段做出投票决定。

**端点**: `POST /api/player/vote`

**请求体**:
```typescript
interface VoteRequest {
  context: PlayerContext;  // 与发言上下文相同
}
```

**响应**:
```typescript
interface VotingResponse {
  target: number;   // 要投票的目标玩家 ID
  reason: string;   // 投票理由
}
```

**示例**:
```bash
curl -X POST http://localhost:3001/api/player/vote \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "round": 1,
      "currentPhase": "voting",
      "alivePlayers": [{"id": 1, "isAlive": true}, {"id": 2, "isAlive": true}],
      "allSpeeches": {"1": [{"playerId": 2, "content": "I think player 1 is suspicious"}]},
      "allVotes": {}
    }
  }'
```

### 4. 使用夜间能力

请求 AI 玩家使用角色特定的夜间能力。

**端点**: `POST /api/player/use-ability`

**请求体**:
```typescript
interface AbilityRequest {
  context: PlayerContext | SeerContext | WitchContext;
}

// 特殊角色的扩展上下文
interface SeerContext extends PlayerContext {
  investigatedPlayers: Record<number, {
    target: number;
    isGood: boolean;
  }>;
}

interface WitchContext extends PlayerContext {
  killedTonight?: number;                    // 被狼人杀死的玩家
  potionUsed: { heal: boolean; poison: boolean }; // 药水使用状态
}
```

**响应** (根据角色不同):

**狼人响应**:
```typescript
interface WerewolfNightAction {
  action: "kill" | "idle";
  target: number;      // 目标玩家 ID (0 表示无行动)
  reason: string;      // 行动理由
}
```

**预言家响应**:
```typescript
interface SeerNightAction {
  action: "investigate";
  target: number;      // 要调查的玩家 ID
  reason: string;      // 调查理由
}
```

**女巫响应**:
```typescript
interface WitchNightAction {
  action: "using" | "idle";
  healTarget: number;    // 要治疗的玩家 ID (0 表示无行动)
  healReason: string;    // 治疗理由
  poisonTarget: number;  // 要毒杀的玩家 ID (0 表示无行动)
  poisonReason: string;  // 毒杀理由
}
```

### 5. 玩家状态

获取当前玩家状态和配置信息。

**端点**: `GET /api/player/status`

**响应**:
```typescript
interface PlayerStatus {
  gameId?: string;
  playerId?: number;
  role?: string;
  teammates?: number[];
  isAlive: boolean;
  config: {
    personality: string;  // 玩家性格类型
  };
}
```

## 错误处理

所有端点都遵循一致的错误响应格式：

```typescript
interface ErrorResponse {
  success: false;
  error: string;        // 错误消息
  code?: string;        // 错误代码（可选）
}
```

**常见 HTTP 状态码**:
- `200`: 成功
- `400`: 请求错误（参数无效）
- `500`: 内部服务器错误（AI 生成失败）
- `503`: 服务不可用（玩家未初始化）

## AI 响应验证

所有 AI 生成的响应都使用 Zod 模式进行验证以确保类型安全：

### 发言验证
```typescript
const SpeechResponseSchema = z.object({
  speech: z.string().min(1).max(200)
});
```

### 投票验证
```typescript
const VotingResponseSchema = z.object({
  target: z.number().int().positive(),
  reason: z.string().min(1)
});
```

### 夜间行动验证
```typescript
const WerewolfNightActionSchema = z.object({
  action: z.enum(["kill", "idle"]),
  target: z.number().int().min(0),
  reason: z.string().min(1)
});

const SeerNightActionSchema = z.object({
  action: z.literal("investigate"),
  target: z.number().int().positive(),
  reason: z.string().min(1)
});

const WitchNightActionSchema = z.object({
  action: z.enum(["using", "idle"]),
  healTarget: z.number().int().min(0),
  healReason: z.string().min(1),
  poisonTarget: z.number().int().min(0),
  poisonReason: z.string().min(1)
});
```

## 请求/响应流程

### 典型游戏流程 API 调用

1. **游戏初始化**:
   ```
   POST /api/player/start-game → 初始化所有 6-8 个玩家
   ```

2. **夜间阶段**:
   ```
   POST /api/player/use-ability → 狼人选择目标
   POST /api/player/use-ability → 预言家调查玩家
   POST /api/player/use-ability → 女巫使用药水
   ```

3. **白天阶段**:
   ```
   POST /api/player/speak → 玩家 1 发言
   POST /api/player/speak → 玩家 2 发言
   ... (所有存活玩家依次发言)
   ```

4. **投票阶段**:
   ```
   POST /api/player/vote → 玩家 1 投票
   POST /api/player/vote → 玩家 2 投票
   ... (所有存活玩家投票)
   ```

5. **状态检查** (任何时候):
   ```
   GET /api/player/status → 检查玩家配置
   ```

## 配置和性格

每个玩家服务都可以配置不同的性格特征，这些特征会影响 AI 决策：

### 性格类型
- **aggressive**: 更倾向于冒险和大胆指控
- **conservative**: 谨慎的方法，偏向安全投票
- **cunning**: 战略性和欺骗性，善于误导
- **witty**: 在发言中使用幽默和机智的观察

### 策略类型
- **aggressive**: 高风险、高回报的决策
- **conservative**: 安全、防御性的游戏风格
- **balanced**: 平衡风险和安全的适中方法

这些配置影响提示生成和决策算法，但不改变 API 接口。

## 速率限制和性能

### 当前限制
- **顺序处理**: 玩家逐一做出决策
- **AI 模型延迟**: 响应时间取决于 AI 提供商（通常为 1-5 秒）
- **无速率限制**: 当前没有内置速率限制

### 推荐使用模式
- **超时处理**: 为 AI 响应实施 30 秒超时
- **重试逻辑**: 为失败的 AI 调用内置指数退避
- **优雅降级**: AI 生成失败时的回退响应

此 API 设计确保了类型安全、关注点清晰分离，以及游戏主控与 AI 玩家之间的可靠通信。