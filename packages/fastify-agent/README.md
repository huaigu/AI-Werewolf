# AI-Werewolf Fastify Agent

基于 Fastify 的 AI 狼人杀玩家代理服务，使用现代化技术栈构建，与现有 player 包 API 完全兼容。

## 技术栈

- **Fastify**: 高性能 Node.js Web 框架
- **Winston**: 专业日志管理
- **TypeScript**: 类型安全开发
- **Zod**: 运行时类型验证
- **Bun**: 包管理和运行时

## 特性

- 🚀 **高性能**: 基于 Fastify 的异步处理
- 📝 **完整日志**: Winston 结构化日志记录
- 🛡️ **类型安全**: TypeScript + Zod 双重保护
- 🔧 **配置灵活**: 支持文件和环境变量配置
- 🎭 **个性丰富**: 多种 AI 角色个性和策略
- ✅ **API 兼容**: 与现有 player 包完全兼容

## 快速开始

### 安装依赖

```bash
bun install
```

### 开发模式

```bash
# 使用默认配置
bun run dev

# 使用特定配置
bun run dev:default
bun run dev:aggressive
bun run dev:conservative
bun run dev:witty

# 使用自定义配置文件
bun run dev:config=path/to/config.json
```

### 生产模式

```bash
# 构建
bun run build

# 启动
bun run start

# 使用配置启动
bun run start:config=configs/production.json
```

## API 端点

### 游戏控制
- `POST /api/player/start-game` - 初始化游戏
- `GET /api/player/status` - 获取玩家状态

### 游戏操作
- `POST /api/player/speak` - 生成发言
- `POST /api/player/vote` - 生成投票
- `POST /api/player/use-ability` - 使用夜晚能力
- `POST /api/player/last-words` - 生成遗言

### 系统
- `GET /health` - 健康检查
- `GET /` - 服务信息

## 配置

### 配置文件格式

```json
{
  "server": {
    "port": 3001,
    "host": "0.0.0.0"
  },
  "ai": {
    "model": "mock-model",
    "maxTokens": 1000,
    "temperature": 0.7,
    "provider": "mock"
  },
  "game": {
    "personality": "default",
    "strategy": "balanced"
  },
  "logging": {
    "enabled": true,
    "level": "info"
  }
}
```

### 环境变量

复制 `.env.example` 到 `.env` 并根据需要修改：

```bash
cp .env.example .env
```

主要环境变量：
- `PORT` - 服务器端口
- `HOST` - 服务器主机
- `LOG_LEVEL` - 日志级别 (error/warn/info/debug)
- `AGENT_PERSONALITY` - AI 个性
- `AGENT_STRATEGY` - AI 策略

## AI 个性和策略

### 个性类型
- **default**: 平衡的表现
- **aggressive**: 激进主动
- **conservative**: 保守谨慎
- **witty**: 机智幽默

### 策略类型
- **aggressive**: 高风险高回报
- **conservative**: 安全防守型
- **balanced**: 平衡策略

## 日志系统

### 日志级别
- `error`: 错误信息
- `warn`: 警告信息
- `info`: 一般信息 (默认)
- `debug`: 调试信息

### 日志输出
- 控制台输出：彩色格式化
- 文件输出：JSON 格式
  - `logs/error.log` - 错误日志
  - `logs/combined.log` - 综合日志

### 日志内容
每个 API 请求都会记录：
- 请求方法和路径
- 请求体内容
- 响应状态码
- 响应时间
- 错误堆栈（如有）

## 开发

### 类型检查
```bash
bun run typecheck
```

### 代码格式化
```bash
bun run lint
```

### 测试
```bash
bun run test
bun run test:watch
bun run test:coverage
```

## Mock 数据服务

当前实现使用 MockService 提供假数据：

### 角色行为
- **村民**: 保守发言，随机投票
- **狼人**: 误导性发言，策略性投票
- **预言家**: 分析性发言，基于"调查"投票
- **女巫**: 神秘发言，平衡性行动

### 个性化
根据配置的个性和策略，AI 会调整：
- 发言风格和用词
- 决策倾向和风险偏好
- 投票理由和行动逻辑

## 部署

### Docker (推荐)
```bash
# 构建镜像
docker build -t ai-werewolf-fastify-agent .

# 运行容器
docker run -p 3001:3001 -e NODE_ENV=production ai-werewolf-fastify-agent
```

### PM2
```bash
# 安装 PM2
bun add -g pm2

# 启动服务
pm2 start bun --name "fastify-agent" -- run start
```

## 与现有系统集成

此包与现有的 `@ai-werewolf/player` 包 API 完全兼容，可以直接替换：

1. 确保端口配置正确
2. 使用相同的配置文件格式
3. API 调用方式保持不变

## 扩展开发

### 添加真实 AI 服务
1. 在 `src/services/` 创建新的 AI 服务类
2. 实现与 MockService 相同的接口
3. 在配置中切换 provider

### 自定义中间件
在 `src/middleware/` 添加新的中间件并在 `index.ts` 中注册。

### 扩展 API
在 `routes.ts` 中添加新的端点定义。

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！