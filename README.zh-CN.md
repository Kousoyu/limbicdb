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

## 发展方向

LimbicDB 正在朝着一个更可靠的 memory runtime 演进，包括：

* 更稳定的 recall 语义
* 可解释的召回决策
* retention / pruning 策略
* 面向长期使用的 compact 能力
* 面向嵌入式场景的稳定本地文件格式

## 与 CogniCore 的关系

LimbicDB 负责 **memory**。
CogniCore 负责 **runtime orchestration、governance 和 recovery**。

两者一起使用时：

* **CogniCore** 决定 Agent 如何运行
* **LimbicDB** 决定记忆如何存储、召回和维护

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

LimbicDB 会自动将记忆分类为认知类型：

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
   - 可通过插件支持语义搜索

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

## 许可证

MIT

---

*灵感来自认知科学的记忆保留和检索原理，但专注于嵌入式 Agent 的实用工程实现。*