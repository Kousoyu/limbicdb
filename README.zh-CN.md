# LimbicDB

[English](./README.md) | 简体中文

**面向嵌入式 Agent 的本地优先记忆引擎。**

把重要的记下来,按上下文召回,并能解释它为什么被用到--一切都在一个本地文件里完成。

> **当前状态 (v1.0.0-beta.1)**:
> - **SQLite 后端**: 关键词搜索稳定,语义/混合搜索实验性MVP
> - **内存后端**: 关键词搜索稳定,语义/混合搜索实验性
> - **快照一致性**: 快照包含嵌入向量(两个后端,beta特性)

## LimbicDB 为什么存在

很多 Agent memory 工具只解决"存"或"搜"的问题,但长期可用的记忆系统不该只有存储和检索。

LimbicDB 关注的是完整的记忆生命周期:

- **记住** 重要信息
- **召回** 当前真正相关的上下文
- **遗忘** 或清理低价值记忆
- **解释** 为什么某条记忆会被召回
- **压缩/整理** 噪声记忆,形成更稳定的长期状态

它适合那些需要**持久、可检查、可嵌入**记忆能力的 Agent,而不是一个依赖服务端的平台。

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
- 也不是"人脑模拟器"

## 快速开始

```ts
import { open } from 'limbicdb'

const memory = open('./agent.limbic')

await memory.remember('User prefers concise answers')
await memory.remember('Project uses PostgreSQL')

const results = await memory.recall('user preferences')

await memory.close()
```

## 后端能力矩阵

| 功能 | SQLite 后端 (`open('./agent.limbic')`) | 内存后端 (`open(':memory:')`) |
|------|----------------------------------------|--------------------------------|
| **关键词搜索** | ✅ 稳定 (FTS5 + LIKE 回退) | ✅ 稳定 |
| **语义搜索** | 🧪 实验性 (MVP) | 🧪 实验性 (自带嵌入函数) |
| **混合搜索** | 🧪 实验性 (MVP) | 🧪 实验性 (70% 语义 + 30% 关键词) |
| **持久化存储** | ✅ 单个 `.limbic` 文件 | ❌ 仅内存 (易失性) |
| **快照/恢复** | ✅ (包含嵌入向量) | ✅ (包含嵌入向量) |
| **基于文件** | ✅ | ❌ |

## 快速开始 (选择你的路径)

### 路径 1: 持久化本地文件 (SQLite 后端)
```typescript
import { open } from 'limbicdb'

// 默认路径使用 SQLite 后端 - 持久化,基于文件
const memory = open('./agent.limbic')

await memory.remember('用户偏好简洁的回答')
await memory.remember('项目使用 PostgreSQL')

const results = await memory.recall('用户偏好', { mode: 'keyword' })

await memory.close()
```

### 路径 2: 实验性语义原型 (内存后端)
```typescript
import { open } from 'limbicdb'

// ':memory:' 路径使用内存后端 - 支持语义搜索
const memory = open(':memory:')

// 要使用语义搜索,请提供嵌入函数
const memoryWithEmbedder = open({
  path: ':memory:',
  embedder: {
    async embed(text) { /* 你的嵌入函数 */ },
    dimensions: 384
  }
})

const results = await memoryWithEmbedder.recall('查询', { mode: 'semantic' })
```

## 核心原则

* **默认本地优先**
 除非你主动选择别的方式,数据默认保存在本地文件里。

* **可解释,而不是神秘**
 记忆系统应该可以检查、追问、审计,而不是黑盒。

* **轻量,而不是臃肿**
 它应该能被自然地嵌入 Agent 和工具中,而不是演变成一个平台。

* **模型无关**
 不依赖某一家模型才能工作;有模型时能力可以增强,但不会被绑死。

* **诚实面对限制**
 我们清楚地记录什么不工作,就像记录什么工作一样。

## 已知限制(Alpha 阶段)

LimbicDB v0.4.0-alpha.3 当前有以下限制:

* **中文 / CJK 搜索支持有限**
  FTS5 默认配置对 CJK 字符支持有限;搜索可能无法匹配词语内的部分字符或多字词中的单个字。

* **部分词匹配不保证**
  搜索 "test" 可能不会匹配 "testing" 或 "tested",具体取决于 FTS 配置。

* **SQLite 语义/混合搜索实验性**
  默认的 `open('./agent.limbic')` 路径使用 SQLite 后端,其中语义/混合搜索现在以 MVP 形式提供但仍属实验性。

* **记忆文件格式稳定性**
  `.limbic` 文件格式在 alpha 版本间可能变化。

* **快照一致性**
  SQLite 快照包含数据和嵌入向量;内存后端快照包含嵌入向量。

这些限制被明确记录以保持透明。未来的版本将根据用户反馈解决这些问题。

## 反馈

LimbicDB 目前仍处于 alpha 阶段。

最有价值的反馈包括:
- 安装与接入问题
- recall 行为是否让人意外
- 文档与实际行为的差异
- README 是否比真实能力讲得更强的地方

欢迎直接使用仓库内置模板提 issue。

## 当前实现状态

### SQLite 后端 (`open('./agent.limbic')`)
**当前 (alpha)**:
* ✅ **单文件存储** - `.limbic` SQLite 文件格式
* ✅ **关键词搜索** - FTS5 + LIKE 回退,支持英文和基础 CJK
* ✅ **记忆生命周期** - remember、recall、forget、inspect、history
* ✅ **自动分类** - 事实/经历/偏好/流程/目标
* ✅ **状态存储** - 记忆相关状态的 get/set
* ✅ **时间线审计** - 完整操作历史
* ✅ **快照** - 时间点恢复 (包含嵌入向量)

**进行中**:
* 🔄 **嵌入向量存储** - 基础集成已完成
* 🧪 **语义搜索** - 实验性 MVP 实现
* 🧪 **混合搜索** - 实验性 MVP 实现
* 🔄 **快照一致性** - 快照包含嵌入向量(alpha特性)

### 内存后端 (`open(':memory:')`)
**当前 (alpha)**:
* ✅ **关键词搜索** - 本地文本匹配
* ✅ **记忆生命周期** - 完整的生命周期操作
* ✅ **自动分类** - 与 SQLite 后端相同
* ✅ **状态存储** - 内存键值存储
* ✅ **时间线审计** - 操作历史

**实验性 (v0.4 alpha)**:
* 🧪 **语义搜索** - 基于向量的相似性搜索 (自带嵌入函数)
* 🧪 **混合搜索** - 70% 语义 + 30% 关键词权重
* 🧪 **嵌入集成** - 异步计算,最终一致性模型
* 🧪 **包含嵌入向量的快照** - 快照包含嵌入向量

### 跨后端
* ✅ **契约测试** - 34 个测试确保内存和 SQLite 后端行为一致
* ✅ **统一 API** - 两个后端使用相同接口
* ✅ **错误处理** - 功能不可用时的优雅降级

## 搜索能力矩阵

明确说明当前支持的搜索能力:

| 能力 | 状态 | 说明 |
|------|------|------|
| **英文关键词搜索** | ✅ 稳定 | 使用 FTS5 的精确和部分词匹配 |
| **中文/CJK 精确词** | 🔄 改进中 | alpha.2 中的混合 FTS5 + LIKE 回退 |
| **中文/CJK 部分匹配** | 🧪 实验性 | 通过 LIKE 回退提供有限支持 |
| **中英混合查询** | 🧪 实验性 | 可用但排序可能不理想 |
| **语义/嵌入搜索** | 🧪 实验性 (自带嵌入函数) | 内存后端实验性,SQLite 后端实验性 MVP |

**状态说明:**
* ✅ **稳定** - 可靠、经过测试、可使用
* 🔄 **改进中** - 功能正常但正在积极优化
* 🧪 **实验性** - 可用但可能有局限
* 📋 **计划中** - 路线图中,尚未实现

## LimbicDB 与其他方案的对比

LimbicDB 不是向量数据库。它是一个记忆生命周期引擎。
此表格帮助你判断它是否适合你的使用场景。

| | LimbicDB | Mem0 | LangChain Memory | ChromaDB | 原始 JSON 文件 |
|---|---|---|---|---|---|
| **定位** | 记忆生命周期引擎 | 记忆即服务 | 链的记忆模块 | 向量数据库 | DIY |
| **本地无服务端** | ✅ 单 `.limbic` 文件 | ⚠️ 有本地模式,但设计用于云端 | ✅ | ✅ | ✅ |
| **无需 API 密钥** | ✅ | ❌ (云端) / ✅ (本地) | ✅ | ✅ | ✅ |
| **语义搜索** | 🧪 实验性 (两个后端,自带嵌入函数) | ✅ 内置 | ✅ 通过向量存储 | ✅ 核心功能 | ❌ |
| **关键词搜索** | ✅ FTS5 + LIKE 回退 | ✅ | ✅ | ⚠️ 有限支持 | ❌ |
| **记忆衰减/遗忘** | ✅ 半衰期模型 | ⚠️ 基础功能 | ❌ | ❌ | ❌ |
| **自动分类** | ✅ 事实/经历/偏好/流程/目标 | ❌ | ❌ | ❌ | ❌ |
| **完整操作历史** | ✅ 可审计时间线 | ❌ | ❌ | ❌ | ❌ |
| **单文件便携** | ✅ 复制/备份一个文件 | ❌ | ❌ | ❌ | ✅ |
| **语言** | TypeScript/JS | Python | Python | Python/JS | 任意 |
| **成熟度** | Alpha | 生产环境 | 生产环境 | 生产环境 | N/A |

**选择 LimbicDB 如果:** 你需要一个本地、便携、可检查的记忆存储用于单个 Agent,并且你更关心记忆生命周期(衰减、遗忘、审计)而不是原始向量搜索性能。

**不要选择 LimbicDB 如果:** 你今天就需要生产级的语义搜索、Python 原生集成,或云端规模的多租户记忆。请使用 Mem0、Chroma 或 LangChain Memory 替代。

> 我们宁愿你选择正确的工具,而不是选择我们。如果 LimbicDB 不适合你的情况,这些替代方案确实是很好的选择。

## 与 Cerebria 的关系

LimbicDB 负责 **memory**。
Cerebria 负责 **runtime orchestration、governance 和 recovery**。

两者一起使用时:

* **Cerebria** 决定 Agent 如何运行
* **LimbicDB** 决定记忆如何存储、召回和维护

**重要:** LimbicDB 和 Cerebria 是**独立的、版本独立**的项目。你可以在没有 Cerebria 的情况下使用 LimbicDB,反之亦然。

---

## API 参考(快速)

### `open(path)` / `open(config)`
创建或打开一个 LimbicDB 实例。

### `remember(content, options?)`
存储一条记忆,支持自动分类。

### `recall(query, options?)`
检索相关记忆(本地搜索和排序)。

### `forget(filter)`
明确遗忘某些记忆(需要安全过滤器)。

### `get(key)` / `set(key, value)`
持久化键值状态(仅限 memory-adjacent 状态)。

### `history(options?)`
查询所有操作的时间线。

### `snapshot()`
创建时间点快照。

### `close()`
干净地关闭数据库。

---

## 记忆类型

LimbicDB 会自动将记忆分类为语义类型:

| 类型 | 描述 | 示例 |
|------|-------------|---------|
| `fact` | 确定性知识 | "API 运行在 3000 端口" |
| `episode` | 事件/经历 | "昨天我们修复了登录 bug" |
| `preference` | 用户偏好 | "用户更喜欢函数式组件" |
| `procedure` | 操作方法 | "部署流程:先 build 再 push 到 main" |
| `goal` | 当前目标 | "周五前完成仪表盘" |

```typescript
// 自动分类
await memory.remember('用户喜欢深色主题') // → 'preference'
await memory.remember('昨天修复了登录问题') // → 'episode'

// 手动覆盖
await memory.remember('PostgreSQL 很棒', { kind: 'preference' })
```

## 记忆强度与保留

LimbicDB 中的记忆有强度分数,会随时间变化:

- 频繁访问的记忆 **会变强**
- 未召回的记忆 **会逐渐淡化**
- 低强度记忆可能被 **自动清理**
- 重要记忆可以 **明确保留**

```typescript
const memory = open({
  path: './agent.limbic',
  decay: {
    halfLifeHours: 168, // 7 天:记忆强度每周减半
    pruneThreshold: 0.01, // 移除低于此强度的记忆
  }
})
```

## 架构设计

LimbicDB 围绕简单但强大的核心构建:

1. **存储抽象**
   - 内存存储(快速,适合开发)
   - SQLite 存储(持久,适合持久化场景)
   - 统一接口,支持未来扩展

2. **记忆生命周期**
   - 写入时分类和标记
   - 召回时相关性评分
   - 后台衰减和清理
   - 可选的压缩和整合

3. **本地优先设计**
   - 单文件格式(`.limbic` SQLite 数据库)
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

// 打开记忆存储(自动选择后端)
const memory = open('./agent.limbic')

// 记住重要信息
await memory.remember('用户对坚果过敏')
await memory.remember('项目截止日期是周五')

// 召回相关上下文
const result = await memory.recall('过敏')
// → [{ content: '用户对坚果过敏', strength: 0.85, kind: 'fact', ... }]

// 存储与记忆相关的状态(不是运行时状态)
await memory.set('session_summary', {
  lastTopic: 'allergies',
  timestamp: Date.now()
})

// 干净地关闭
await memory.close()
```

### 高级:显式选择后端

```typescript
import { openMemory, openSQLite } from 'limbicdb'

// 强制使用内存后端(开发/测试)
const devDb = openMemory(':memory:')

// 强制使用 SQLite 后端(持久化场景)
const prodDb = openSQLite('./agent.limbic')
```

### 语义搜索示例

> **⚠️ 重要**: 下面的示例展示了语义搜索 API。**在 v0.4.0-alpha.3 中,语义搜索在两个后端都工作**但仍属实验性。
>
> 内存后端 (`open(':memory:')`) 有更成熟的实现。SQLite 后端 (`open('./agent.limbic')`) 现在以 MVP 形式支持语义和混合搜索,但如果尚未存储嵌入向量,仍可能降级到关键词搜索。

LimbicDB v0.4 alpha 增加语义搜索支持,使用自带嵌入函数:

```typescript
import { open } from 'limbicdb'

// 选项 1: 内存后端 (在 v0.4 alpha 中完全支持语义搜索)
const memoryBackend = open({
  path: ':memory:',  // 内存后端支持完整的语义搜索
  embedder: {
    async embed(text) {
      // 使用 @xenova/transformers、OpenAI、Cohere 或任何提供商
      // 返回 number[] 向量
      return computeEmbedding(text)
    },
    dimensions: 384
  }
})

// 内存后端的语义召回
const memoryResults = await memoryBackend.recall('用户界面偏好', {
  mode: 'semantic', // 在内存后端完全工作
  limit: 5
})

console.log(`内存后端模式: ${memoryResults.meta.mode}`) // 应该是 'semantic'
console.log(`降级: ${memoryResults.meta.fallback}`) // 应该是 false

// 选项 2: SQLite 后端 (实验性语义搜索 MVP)
const sqliteBackend = open({
  path: './agent.limbic',  // SQLite 后端 - 语义搜索实验性
  embedder: {
    async embed(text) { return computeEmbedding(text) },
    dimensions: 384
  }
})

const sqliteResults = await sqliteBackend.recall('用户界面偏好', {
  mode: 'semantic',
  limit: 5
})

console.log(`SQLite 后端模式: ${sqliteResults.meta.mode}`) // 可能是 'semantic' 或 'keyword' (如果降级)
console.log(`降级: ${sqliteResults.meta.fallback}`) // 如果存在嵌入向量为 false,否则为 true
console.log(`请求模式: ${sqliteResults.meta.requestedMode}`) // 'semantic'
console.log(`执行模式: ${sqliteResults.meta.executedMode}`) // 成功则为 'semantic',降级则为 'keyword'
```

查看完整示例:[`examples/semantic-recall.ts`](examples/semantic-recall.ts)

## 许可证

MIT

---

*为需要持久、可检查、无服务端依赖的嵌入式 Agent 而构建。*