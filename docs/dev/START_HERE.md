# 🚀 LimbicDB 启动指南

## 当前状态：MVP 已就绪，等待发布

**LimbicDB v0.1.0** 包含：
- ✅ 认知原语系统（5种记忆类型）
- ✅ Ebbinghaus 记忆衰减算法
- ✅ 完整 API（8个核心方法）
- ✅ 内存存储实现
- ✅ TypeScript 完整类型定义
- ✅ 演示和验证脚本

## 今日任务（1小时内完成）

### 1. 创建 GitHub 仓库 (5分钟)
```bash
# 浏览器访问: https://github.com/new
# 填写:
# - Repository name: limbicdb
# - Description: Embedded cognitive memory database for AI agents...
# - 不初始化 README/.gitignore/LICENSE
# - 点击 Create repository
```

### 2. 推送代码到 GitHub (5分钟)
```bash
cd /tmp/limbicdb

# 初始化 Git
git init
git add .
git commit -m "feat: initial commit - LimbicDB v0.1.0

- Cognitive memory primitives (fact/episode/preference/procedure/goal)
- Ebbinghaus forgetting curve with spaced repetition  
- Automatic memory classification
- Full timeline audit log
- In-memory storage (SQLite ready)
- TypeScript with complete API"

# 添加远程仓库并推送
git remote add origin https://github.com/Kousoyu/limbicdb.git
git branch -M main
git push -u origin main
```

### 3. 验证项目构建 (5分钟)
```bash
# 运行演示
npm run demo

# 运行验证
npm run verify

# 构建
npm run build

# 类型检查
npm run typecheck
```

### 4. 准备 npm 发布材料 (5分钟)
- 检查 `package.json` 版本为 `0.1.0`
- 确保 `name: "limbicdb"` 可用
- 准备技术文章大纲（见下文）

### 5. 技术传播准备 (15分钟)
**文章标题**: 《给AI Agent一个会遗忘的记忆系统》

**大纲**:
1. 问题：AI Agent 缺乏人类般的记忆机制
2. 认知科学基础：Ebbinghaus + Tulving + ACT-R
3. LimbicDB 创新：记忆衰减 + 认知原语
4. 与 Mem0/Letta 对比：嵌入式 vs 服务器
5. 代码示例：5行代码给 Agent 添加记忆
6. 未来路线：SQLite、向量搜索、生态集成

## 明日任务（npm 登录后）

### 1. 发布 npm 包
```bash
npm login  # 需要手机邮箱验证
npm run build
npm publish --tag alpha
```

### 2. 发布技术文章
- 个人博客 / Medium
- Hacker News
- Reddit: r/LocalLLaMA, r/ArtificialIntelligence
- Twitter/X 带演示视频
- 国内：知乎、掘金

### 3. 开始 SQLite 集成 (3-4天)
```typescript
// 目标: open('./agent.limbic') 创建单文件数据库
```
**任务**:
1. 集成 better-sqlite3
2. 实现 schema.sql 所有表
3. 替换内存存储为 SQLite
4. 实现 FTS5 全文搜索

## 项目结构

```
limbicdb/
├── src/
│   ├── index.ts          # 公共API
│   ├── types.ts          # 完整类型定义
│   ├── core.ts           # 核心实现（内存版）
│   ├── decay.ts          # 记忆衰减算法
│   ├── classify.ts       # 自动分类
│   ├── time.ts           # 时间解析
│   ├── schema.sql        # SQLite schema
│   └── utils/id.ts       # ID生成
├── examples/basic.ts     # 使用示例
├── demo.ts              # 演示脚本
├── scripts/verify.js    # 功能验证
├── PUBLISH_GUIDE.md     # 详细发布指南
└── START_HERE.md        # 本文件
```

## 核心 API 预览

```typescript
import { open } from 'limbicdb'

const db = open(':memory:')

// 存储记忆（自动分类）
await db.remember('用户喜欢React')           // → preference
await db.remember('API跑在3000端口')         // → fact
await db.remember('昨天修复了bug')            // → episode

// 检索记忆
const results = await db.recall('React')

// 持久化状态
await db.set('task', { name: '登录页', progress: 0.7 })
const task = await db.get('task')

// 时间线审计
const events = await db.history({ limit: 10 })

// 快照/恢复
const snapshotId = await db.snapshot()
await db.restore(snapshotId)
```

## 记忆衰减示例

```typescript
const db = open({
  path: ':memory:',
  decay: {
    halfLifeHours: 24,  // 24小时半衰期
    enabled: true
  }
})

// 这条记忆如果从不回忆，24小时后强度减半
await db.remember('临时信息')

// 这条记忆每次被 recall() 都会增强
await db.remember('重要事实')
```

## 常见问题

### Q: 内存版和 SQLite 版有什么区别？
**A**: 当前是内存存储（Map实现），API 完全相同。SQLite 集成后只需改一行代码：
```diff
- const db = open(':memory:')
+ const db = open('./agent.limbic')  // 单文件数据库
```

### Q: 如何测试记忆衰减效果？
**A**: 使用自定义时间进行测试：
```typescript
// 可以模拟时间流逝，测试衰减算法
```

### Q: 向量搜索什么时候加入？
**A**: 阶段2（下周）。提供可插拔 Embedder 接口。

## 紧急联系人

- **GitHub 问题**: 仓库 Issues
- **npm 支持**: https://npmjs.com/support  
- **技术讨论**: 可创建 Discussions

## 成功指标（第一周）

- [ ] GitHub stars: 100+
- [ ] npm 下载: 500+
- [ ] 技术文章阅读: 1000+
- [ ] 收到3个真实用户反馈
- [ ] 开始 SQLite 集成

---

**记住**：今天的核心目标是**验证市场对"认知记忆"概念的兴趣**。

LimbicDB 的创新点（认知原语+记忆衰减）已经完整实现。内存版足够展示这个创新。

**发布 MVP，收集反馈，迭代改进** 🚀