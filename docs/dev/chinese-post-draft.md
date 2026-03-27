# LimbicDB v0.4.0-alpha.1 发布：本地优先的语义记忆引擎（自带嵌入函数）

## 项目背景
LimbicDB 是一个本地优先的记忆引擎，专为嵌入式AI代理设计。今天发布的 v0.4.0-alpha.1 版本加入了语义搜索能力，采用了"自带嵌入函数"的极简设计理念。

## 核心问题
现有的Agent记忆系统通常有三种选择：
1. **纯关键词搜索** - 召回能力有限
2. **云向量数据库** - 需要API密钥，有延迟，隐私问题
3. **复杂本地方案** - sqlite-vss需要编译，跨平台问题多

LimbicDB选择了第四条路：**自带嵌入函数 + 暴力余弦相似度**。

## v0.4.0-alpha.1 主要特性

### 🧠 语义搜索接口
```typescript
// 三种搜索模式
await memory.recall('用户界面偏好', { mode: 'semantic' })  // 纯语义
await memory.recall('会议', { mode: 'hybrid' })            // 混合搜索（30%关键词+70%语义）
await memory.recall('React', { mode: 'keyword' })          // 传统关键词
```

### 🔧 极简设计
- **移除复杂配置**：删除了 `similarityThreshold` 和 `useHybrid`，只剩 `mode` 字段
- **硬编码权重**：混合搜索中关键词占30%，语义占70%
- **最终一致性**：`remember()` 异步计算嵌入，`recall()` 只查已有嵌入
- **优雅降级**：无嵌入函数时自动回退到关键词搜索

### 🗃️ 技术实现
- **向量存储层**：支持内存和SQLite双后端，BLOB存储（384维=1536字节）
- **暴力搜索**：无向量索引，余弦相似度线性搜索（<1万条记忆足够快）
- **无原生依赖**：纯JavaScript实现，无sqlite-vss编译问题
- **跨平台**：任何能运行Node.js的地方都能用

### 📊 统计信息
```typescript
console.log(db.stats)
// {
//   memoryCount: 42,
//   embeddingsCount: 38,      // 新字段：已计算嵌入的记忆数量
//   embeddingsDimensions: 384 // 新字段：嵌入维度
// }
```

## 完整示例：使用 @xenova/transformers
```typescript
import { open } from 'limbicdb';
import { pipeline } from '@xenova/transformers';

// 1. 创建嵌入函数
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
async function embed(text: string) {
  const result = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
}

// 2. 创建记忆引擎（自带嵌入函数）
const memory = open({
  path: './agent.limbic',  // 或 ':memory:' 内存模式
  embedder: { 
    embed, 
    dimensions: 384,
    modelHint: 'all-MiniLM-L6-v2' 
  }
});

// 3. 存储记忆（异步计算嵌入）
await memory.remember('用户在所有应用中都偏好深色模式');
await memory.remember('项目使用TypeScript和React开发');

// 4. 语义搜索：找到含义相关但不含关键词的记忆
const result = await memory.recall('界面主题偏好', { mode: 'semantic' });
// 会找到"深色模式"的记忆，即使查询中没有"深色"或"模式"关键词
```

## 为什么选择暴力搜索？
1. **无编译问题** - 避开sqlite-vss的跨平台兼容性问题
2. **1万条记忆足够快** - 大多数嵌入式Agent用不到那么多记忆
3. **简单优于完美** - 原型阶段先证明架构可行
4. **用户控制嵌入模型** - 可用本地模型（all-MiniLM-L6-v2）或云API

## 当前限制（Alpha阶段）
- **暴力搜索** - 记忆量>1万时可能变慢
- **SQLite后端语义搜索** 是TODO（目前回退到关键词搜索）
- **无向量索引** - 简单线性搜索
- **快照/恢复** 暂不包含嵌入向量

## 适用场景
- **本地AI代理** - 需要持久化记忆且隐私敏感
- **嵌入式应用** - 不想依赖外部API或服务
- **可解释性要求高** - 需要知道为什么某条记忆被召回
- **记忆生命周期管理** - 需要自动遗忘、衰减机制

## 安装使用
```bash
npm install limbicdb@alpha
# 或
npm install limbicdb@0.4.0-alpha.1
```

完整示例：[semantic-recall.ts](https://github.com/Kousoyu/limbicdb/blob/main/examples/semantic-recall.ts)
项目地址：https://github.com/Kousoyu/limbicdb
npm包：https://www.npmjs.com/package/limbicdb

## 寻求反馈
这是一个alpha版本/原型，主要目标是验证架构是否可行。特别想了解：

1. **接口设计**：`mode` 参数的方式是否直观？
2. **性能**：暴力搜索在您的使用场景下是否可以接受？
3. **嵌入函数集成**：自带嵌入函数的方式是否适合您的技术栈？
4. **缺失功能**：哪些功能能让这个项目对您真正有用？

您的反馈将决定下一步的优先级（完善SQLite后端、性能优化、还是更多功能）。

感谢阅读！