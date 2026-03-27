# LimbicDB

[English](./README.md) | 简体中文

**面向嵌入式 Agent 的本地优先记忆引擎。**

把重要的记下来，按上下文召回，并能解释它为什么被用到——一切都在一个本地文件里完成。

## LimbicDB 为什么存在

很多 Agent memory 工具只解决“存”或“搜”的问题，但长期可用的记忆系统不该只有存储和检索。

LimbicDB 关注的是完整的记忆生命周期：

- **记住** 重要信息
- **召回** 当前真正相关的上下文
- **遗忘** 或清理低价值记忆
- **解释** 为什么某条记忆会被召回
- **压缩/整理** 噪声记忆，形成更稳定的长期状态

它适合那些需要**持久、可检查、可嵌入**记忆能力的 Agent，而不是一个依赖服务端的平台。

## LimbicDB 是什么

- 一个 **本地优先** 的记忆引擎
- 一个适合 Agent 使用的 **单文件持久化存储**
- 一个围绕 **记住 / 召回 / 遗忘 / 检查** 设计的 memory runtime
- 一个适合本地工具和嵌入式 Agent 的轻量基础层

## LimbicDB 不是什么

- 不是 Agent 运行时
- 不是工作流编排器
- 不是云端 memory 平台
- 不是图数据库
- 也不是“人脑模拟器”

## 快速开始

```ts
import { open } from 'limbicdb'

const memory = open('./agent.limbic')

await memory.remember('User prefers concise answers')
await memory.remember('Project uses PostgreSQL')

const results = await memory.recall('user preferences')

await memory.close()
```

## 核心原则

* **默认本地优先**
 除非你主动选择别的方式，数据默认保存在本地文件里。

* **可解释，而不是神秘**
 记忆系统应该可以检查、追问、审计，而不是黑盒。

* **轻量，而不是臃肿**
 它应该能被自然地嵌入 Agent 和工具中，而不是演变成一个平台。

* **模型无关**
 不依赖某一家模型才能工作；有模型时能力可以增强，但不会被绑死。

## 已知限制（Alpha 阶段）

LimbicDB 0.3.0-alpha 专注于建立可靠的基础功能。当前已知限制包括：

* **中文 / CJK 搜索支持有限**  
  FTS5 默认配置对 CJK 字符支持有限；搜索可能无法匹配词语内的部分字符或多字词中的单个字。

* **部分词匹配不保证**  
  搜索 "test" 可能不会匹配 "testing" 或 "tested"，具体取决于 FTS 配置。

* **当前搜索基于关键词，而非语义**  
  `recall()` 使用本地文本匹配和排序，而非基于嵌入向量的语义搜索。

* **记忆文件格式稳定性**  
  `.limbic` 文件格式在 alpha 版本间可能变化。

这些限制被明确记录以保持透明。未来的版本将根据用户反馈解决这些问题。

## 反馈

LimbicDB 目前仍处于 alpha 阶段。

最有价值的反馈包括：
- 安装与接入问题
- recall 行为是否让人意外
- memory / SQLite 后端是否存在不一致
- 中文 / CJK 搜索问题
- README 是否比真实能力讲得更强

欢迎直接使用仓库内置模板提 issue。

## 当前状态

为避免混淆“已经实现”和“计划实现”的功能，以下是清晰的分层说明：

### 当前（已实现且稳定）
* **单文件 SQLite 存储** - `.limbic` 文件格式
* **双后端支持** - 内存后端（快速、临时）+ SQLite 后端（持久化）
* **契约测试语义** - 34 个测试确保内存和 SQLite 后端行为一致
* **关键词召回** - 本地文本匹配和排序
* **记忆生命周期** - remember、recall、forget、inspect、history
* **自动分类** - facts、episodes、preferences、procedures、goals

### 实验性（改进中，可能变化）
* **CJK 搜索增强** - 混合 FTS5 + LIKE 回退，支持中文/日文/韩文文本
* **可解释性深度** - 理解记忆为什么被召回
* **压缩整理行为** - 噪声减少和长期记忆整合

### 计划中（尚未实现）
* **嵌入/语义召回** - 基于向量的相似性搜索 (v0.4, 接口就绪)
* **更丰富的解释 API** - 对记忆决策的深入洞察
* **更强的文件格式保证** - 跨版本稳定的 `.limbic` 格式
* **高级保留策略** - 复杂的衰减和清理策略

## 搜索能力矩阵

明确说明当前支持的搜索能力：

| 能力 | 状态 | 说明 |
|------|------|------|
| **英文关键词搜索** | ✅ 稳定 | 使用 FTS5 的精确和部分词匹配 |
| **中文/CJK 精确词** | 🔄 改进中 | alpha.2 中的混合 FTS5 + LIKE 回退 |
| **中文/CJK 部分匹配** | 🧪 实验性 | 通过 LIKE 回退提供有限支持 |
| **中英混合查询** | 🧪 实验性 | 可用但排序可能不理想 |
| **语义/嵌入搜索** | 🔄 v0.4 (自带嵌入函数) | 接口已设计，实现进行中 |

**状态说明：**
* ✅ **稳定** - 可靠、经过测试、可使用
* 🔄 **改进中** - 功能正常但正在积极优化
* 🧪 **实验性** - 可用但可能有局限
* 📋 **计划中** - 路线图中，尚未实现

## 发展方向

LimbicDB 正在朝着一个更可靠的 memory runtime 演进，包括：

* 更稳定的 recall 语义
* 可解释的召回决策
* retention / pruning 策略
* 面向长期使用的 compact 能力
* 面向嵌入式场景的稳定本地文件格式

## LimbicDB 与其他方案的对比

LimbicDB 不是向量数据库。它是一个记忆生命周期引擎。
此表格帮助你判断它是否适合你的使用场景。

| | LimbicDB | Mem0 | LangChain Memory | ChromaDB | 原始 JSON 文件 |
|---|---|---|---|---|---|
| **定位** | 记忆生命周期引擎 | 记忆即服务 | 链的记忆模块 | 向量数据库 | DIY |
| **本地无服务端** | ✅ 单 `.limbic` 文件 | ⚠️ 有本地模式，但设计用于云端 | ✅ | ✅ | ✅ |
| **无需 API 密钥** | ✅ | ❌ (云端) / ✅ (本地) | ✅ | ✅ | ✅ |
| **语义搜索** | 🔄 v0.4 (自带嵌入函数) | ✅ 内置 | ✅ 通过向量存储 | ✅ 核心功能 | ❌ |
| **关键词搜索** | ✅ FTS5 + LIKE 回退 | ✅ | ✅ | ⚠️ 有限支持 | ❌ |
| **记忆衰减/遗忘** | ✅ 半衰期模型 | ⚠️ 基础功能 | ❌ | ❌ | ❌ |
| **自动分类** | ✅ 事实/经历/偏好/流程/目标 | ❌ | ❌ | ❌ | ❌ |
| **完整操作历史** | ✅ 可审计时间线 | ❌ | ❌ | ❌ | ❌ |
| **单文件便携** | ✅ 复制/备份一个文件 | ❌ | ❌ | ❌ | ✅ |
| **语言** | TypeScript/JS | Python | Python | Python/JS | 任意 |
| **成熟度** | Alpha | 生产环境 | 生产环境 | 生产环境 | N/A |

**选择 LimbicDB 如果：** 你需要一个本地、便携、可检查的记忆存储用于单个 Agent，并且你更关心记忆生命周期（衰减、遗忘、审计）而不是原始向量搜索性能。

**不要选择 LimbicDB 如果：** 你今天就需要生产级的语义搜索、Python 原生集成，或云端规模的多租户记忆。请使用 Mem0、Chroma 或 LangChain Memory 替代。

> 我们宁愿你选择正确的工具，而不是选择我们。如果 LimbicDB 不适合你的情况，这些替代方案确实是很好的选择。

## 与 CogniCore 的关系

LimbicDB 负责 **memory**。
CogniCore 负责 **runtime orchestration、governance 和 recovery**。

两者一起使用时：

* **CogniCore** 决定 Agent 如何运行
* **LimbicDB** 决定记忆如何存储、召回和维护

**重要：** LimbicDB 和 CogniCore 是**独立的、版本独立**的项目。你可以在没有 CogniCore 的情况下使用 LimbicDB，反之亦然。

---

## API 参考（快速）

### `open(path)` / `open(config)`
创建或打开一个 LimbicDB 实例。

### `remember(content, options?)`
存储一条记忆，支持自动分类。

### `recall(query, options?)`
检索相关记忆（本地搜索和排序）。

### `forget(filter)`
明确遗忘某些记忆（需要安全过滤器）。

### `get(key)` / `set(key, value)`
持久化键值状态（仅限 memory-adjacent 状态）。

### `history(options?)`
查询所有操作的时间线。

### `snapshot()`
创建时间点快照。

### `close()`
干净地关闭数据库。

---

## 记忆类型

LimbicDB 会自动将记忆分类为语义类型：

| 类型 | 描述 | 示例 |
|------|-------------|---------|
| `fact` | 确定性知识 | "API 运行在 3000 端口" |
| `episode` | 事件/经历 | "昨天我们修复了登录 bug" |
| `preference` | 用户偏好 | "用户更喜欢函数式组件" |
| `procedure` | 操作方法 | "部署流程：先 build 再 push 到 main" |
| `goal` | 当前目标 | "周五前完成仪表盘" |

```typescript
// 自动分类
await memory.remember('用户喜欢深色主题') // → 'preference'
await memory.remember('昨天修复了登录问题') // → 'episode'

// 手动覆盖
await memory.remember('PostgreSQL 很棒', { kind: 'preference' })
```

## 记忆强度与保留

LimbicDB 中的记忆有强度分数，会随时间变化：

- 频繁访问的记忆 **会变强**
- 未召回的记忆 **会逐渐淡化**
- 低强度记忆可能被 **自动清理**
- 重要记忆可以 **明确保留**

```typescript
const memory = open({
  path: './agent.limbic',
  decay: {
    halfLifeHours: 168, // 7 天：记忆强度每周减半
    pruneThreshold: 0.01, // 移除低于此强度的记忆
  }
})
```

## 架构设计

LimbicDB 围绕简单但强大的核心构建：

1. **存储抽象**
   - 内存存储（快速，适合开发）
   - SQLite 存储（持久，适合生产）
   - 统一接口，支持未来扩展

2. **记忆生命周期**
   - 写入时分类和标记
   - 召回时相关性评分
   - 后台衰减和清理
   - 可选的压缩和整合

3. **本地优先设计**
   - 单文件格式（`.limbic` SQLite 数据库）
   - 默认无外部依赖
   - 可按需通过插件增强搜索能力

## 开始使用

### 安装

```bash
npm install limbicdb
```

### 基本用法

```typescript
import { open } from 'limbicdb'

// 打开记忆存储（自动选择后端）
const memory = open('./agent.limbic')

// 记住重要信息
await memory.remember('用户对坚果过敏')
await memory.remember('项目截止日期是周五')

// 召回相关上下文
const context = await memory.recall('过敏')
// → [{ content: '用户对坚果过敏', strength: 0.85, kind: 'fact', ... }]

// 存储与记忆相关的状态（不是运行时状态）
await memory.set('session_summary', { 
  lastTopic: 'allergies',
  timestamp: Date.now() 
})

// 干净地关闭
await memory.close()
```

### 高级：显式选择后端

```typescript
import { openMemory, openSQLite } from 'limbicdb'

// 强制使用内存后端（开发/测试）
const devDb = openMemory(':memory:')

// 强制使用 SQLite 后端（生产）
const prodDb = openSQLite('./agent.limbic')
```

### 语义搜索示例

LimbicDB v0.4 增加语义搜索支持，使用自带嵌入函数：

```typescript
import { open } from 'limbicdb'

// 使用你的嵌入函数打开
const memory = open({
  path: './agent.limbic',
  embedder: {
    async embed(text) {
      // 使用 @xenova/transformers、OpenAI、Cohere 或任何提供商
      // 返回 number[] 向量
      return computeEmbedding(text)
    },
    dimensions: 384
  }
})

// 语义召回查找含义，不仅仅是关键词
const results = await memory.recall('用户界面偏好', {
  mode: 'semantic', // 或 'hybrid' 或 'keyword'
  limit: 5
})

console.log(`模式: ${results.meta.mode}`)
console.log(`降级: ${results.meta.fallback}`) // 如果没有嵌入函数则为 true
```

查看完整示例：[`examples/semantic-recall.ts`](examples/semantic-recall.ts)

## 许可证

MIT

---

*为需要持久、可检查、无服务端依赖的嵌入式 Agent 而构建。*