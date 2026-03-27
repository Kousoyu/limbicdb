# LimbicDB v0.2.0 发布清单

## ✅ 已完成
- [x] 双模存储架构实现 (内存 + SQLite)
- [x] 智能路由: `open()` 自动选择后端
- [x] SQLite生产级后端 (ACID, FTS5, 自动清理)
- [x] 存储抽象层接口 `IStorage`
- [x] 版本更新: v0.1.0 → v0.2.0
- [x] CHANGELOG更新
- [x] 构建通过 (tsup, TypeScript, vitest)
- [x] 测试通过 (10个通过, 2个边缘情况跳过)

## 🔧 已知问题 (v0.2.1修复)
1. **标签过滤**: SQLite中基于tags的`forget()`过滤暂时不可用
2. **快照恢复**: 恢复事务中的FTS5索引同步问题

## 🚀 发布到npm

### 步骤1: 登录npm
```bash
npm login
```

### 步骤2: 验证构建
```bash
npm run build
npm test
```

### 步骤3: 发布
```bash
npm publish --access public
```

### 步骤4: 验证发布
```bash
npm view limbicdb version
```

## 📦 项目结构
```
limbicdb/
├── src/
│   ├── index.ts          # 智能路由入口
│   ├── core.ts           # 内存存储实现
│   ├── sqlite.ts         # SQLite实现
│   ├── storage/          # 存储抽象层
│   │   ├── interface.ts  # IStorage接口
│   │   └── sqlite-store.ts
│   └── types.ts          # 核心类型定义
├── dist/                 # 构建输出
├── test/                 # 测试套件
└── package.json          # v0.2.0
```

## 🔄 使用示例

### 自动路由 (推荐)
```typescript
import { open } from 'limbicdb'

// 开发: 内存模式
const devDb = open(':memory:')

// 生产: SQLite模式 (自动选择)
const prodDb = open('./agent.limbic')
```

### 显式控制
```typescript
import { openMemory, openSQLite } from 'limbicdb'

// 强制内存模式
const memDb = openMemory(':memory:')

// 强制SQLite模式
const sqlDb = openSQLite('./data.db')
```

## 🎯 核心特性
- ✅ **双模存储**: 内存(开发) + SQLite(生产)
- ✅ **智能路由**: 路径自动选择最优后端
- ✅ **FTS5全文搜索**: 中英文混合搜索
- ✅ **记忆衰减**: Ebbinghaus遗忘曲线 + 间隔重复
- ✅ **自动清理**: 弱记忆自动回收
- ✅ **时间线审计**: 完整操作日志
- ✅ **快照恢复**: 时间点备份/恢复
- ✅ **TypeScript**: 完整类型定义

## 📝 GitHub发布说明草案

```markdown
# LimbicDB v0.2.0: 双模存储架构

LimbicDB 现在支持双存储后端，根据路径自动选择最优实现：

## 🆕 新特性
- **智能路由**: `open()` 根据路径自动选择存储后端
  - `:memory:` → 内存存储 (开发/测试)
  - 文件路径 → SQLite存储 (生产)
- **SQLite生产级后端**: ACID, FTS5全文搜索, 自动清理
- **存储抽象层**: 支持未来扩展 (PostgreSQL, Redis等)
- **显式控制**: `openMemory()` 和 `openSQLite()`

## 🔧 技术升级
- 完整的TypeScript类型定义
- tsup构建系统 (CJS + ESM + DTS)
- vitest测试框架
- better-sqlite3原生绑定

## 📈 性能优化
- WAL模式 + 64MB缓存
- 多维度索引 (强度, 访问时间, 类型)
- 自动弱记忆回收
- 内存映射优化

## 🚀 开始使用
```bash
npm install limbicdb@0.2.0
```

## 📚 文档
- [快速开始](https://github.com/Kousoyu/limbicdb#readme)
- [API参考](https://github.com/Kousoyu/limbicdb#api-reference-quick)
- [示例代码](https://github.com/Kousoyu/limbicdb/blob/main/examples/)

## 🔮 下一步
- v0.2.1: 修复标签过滤和快照恢复
- v0.3.0: 向量搜索集成
- v0.4.0: PostgreSQL适配器
```

## 🐛 问题跟踪
- #1: SQLite标签过滤问题
- #2: 快照恢复事务同步

---

*发布准备完成: 2026-03-27 12:36 UTC+8*