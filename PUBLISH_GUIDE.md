# LimbicDB 发布指南

## 🚀 立即行动步骤（今天）

### 1. 创建 GitHub 仓库

**在浏览器中执行：**
1. 访问 [github.com/new](https://github.com/new)
2. 填写信息：
   - **Repository name**: `limbicdb`
   - **Description**: `Embedded cognitive memory database for AI agents. Like SQLite, but for agent memory with cognitive science principles.`
   - **Visibility**: Public
   - **Initialize with**: 不勾选任何选项（不添加README、.gitignore、license）
   - **点击 "Create repository"**

### 2. 本地 Git 初始化

**在终端执行：**

```bash
# 进入项目目录
cd /tmp/limbicdb

# 初始化 Git
git init

# 添加远程仓库
git remote add origin https://github.com/Kousoyu/limbicdb.git

# 添加所有文件
git add .

# 提交
git commit -m "feat: initial commit - LimbicDB v0.1.0

- Cognitive memory primitives (fact/episode/preference/procedure/goal)
- Ebbinghaus forgetting curve with spaced repetition
- Automatic memory classification
- Full timeline audit log
- In-memory storage (SQLite ready)
- TypeScript with complete API"

# 推送
git branch -M main
git push -u origin main
```

### 3. 设置 GitHub 功能

**在仓库页面：**
1. **添加 Topics**: `ai`, `agent`, `memory`, `limbic`, `cognitive-science`, `embedded-database`, `sqlite`
2. **设置 Description**: 使用 README.md 的第一段
3. **添加 LICENSE**: MIT (已经包含在仓库中)
4. **添加 README 徽章** (可选)

### 4. 测试项目构建

```bash
# 安装依赖
cd /tmp/limbicdb
npm install

# 运行演示
npx tsx demo.ts

# 构建测试
npm run build
```

### 5. 准备 npm 发布

```bash
# 登录 npm (需要等到明天中午)
npm login

# 构建
npm run build

# 发布 (标记为 alpha 版)
npm publish --tag alpha

# 或先进行 dry-run
npm publish --dry-run
```

## 📦 npm 发布检查清单

### 发布前验证：
- [ ] `package.json` 中 `name: "limbicdb"` 可用
- [ ] `version: "0.1.0"`
- [ ] `main: "./dist/index.cjs"` 正确
- [ ] `types: "./dist/index.d.ts"` 正确
- [ ] `files` 字段包含 `dist/`, `README.md`, `LICENSE`
- [ ] `npm run build` 成功生成 `dist/` 目录
- [ ] `npm run test` 通过 (暂无测试，稍后添加)
- [ ] `node -e "require('./dist/index.cjs')"` 不报错

### 发布命令：
```bash
# 1. 登录 (需要手机邮箱验证)
npm login

# 2. 构建
npm run build

# 3. 发布 alpha 版
npm publish --tag alpha

# 4. 验证
npm view limbicdb
```

## 🧪 验证发布成功

### 在另一个目录测试：
```bash
mkdir /tmp/test-limbicdb
cd /tmp/test-limbicdb
npm init -y
npm install limbicdb@alpha

# 创建测试文件 test.js
cat > test.js << 'EOF'
import { open } from 'limbicdb'

async function test() {
  const db = open(':memory:')
  await db.remember('Test memory')
  const results = await db.recall('test')
  console.log('Success!', results.length, 'memories found')
  await db.close()
}

test().catch(console.error)
EOF

# 运行测试
node test.js
```

## 📝 技术文章大纲

**标题**: 《给AI Agent一个会遗忘的记忆系统：LimbicDB的设计哲学》

**要点**:
1. **问题**: AI Agent缺乏人类般的记忆机制
2. **认知科学基础**: Ebbinghaus遗忘曲线 + Tulving记忆分类
3. **核心创新**: 记忆衰减 + 认知原语
4. **与竞品对比**: Mem0需要服务器，LimbicDB只需一个文件
5. **使用示例**: 代码展示
6. **未来方向**: SQLite集成、向量搜索、生态扩展

**发布渠道**:
- 个人博客/Medium
- Hacker News
- Reddit: r/LocalLLaMA, r/ArtificialIntelligence
- Twitter/X 技术圈
- 国内: 知乎、掘金

## 🗺️ 后续开发路线

### 阶段1: SQLite 持久化 (3-4天)
```typescript
// 目标: open('./agent.limbic') 创建单文件数据库
```
**任务**:
- [ ] 集成 `better-sqlite3`
- [ ] 实现 `schema.sql` 所有表
- [ ] 替换内存存储为 SQLite
- [ ] 实现 FTS5 全文搜索
- [ ] 迁移测试

### 阶段2: 向量搜索 (5-7天)
```typescript
// 目标: 可选的语义搜索
```
**任务**:
- [ ] `Embedder` 接口
- [ ] 官方 embedder 包: OpenAI/Ollama
- [ ] 混合检索策略
- [ ] 向量索引优化

### 阶段3: CLI 工具 (2-3天)
```bash
# 目标: limbic 命令行工具
limbic remember "项目用React"
limbic recall "技术栈" --limit 5
limbic stats
```

### 阶段4: 生态集成 (持续)
- LangChain 适配器
- OpenAI Assistants 集成
- VSCode/Cursor 扩展

## 🎯 今日完成标准

- [ ] GitHub 仓库创建并推送代码
- [ ] README 在 GitHub 上正常显示
- [ ] 本地 `npm run build` 成功
- [ ] 技术文章大纲完成
- [ ] 社交媒体预告文案准备好

## 🔧 故障排除

### npm 登录问题
```bash
# 如果遇到 2FA 问题，需要手机邮箱
npm login --auth-type=legacy

# 或者使用 token
npm config set //registry.npmjs.org/:_authToken YOUR_TOKEN
```

### GitHub 推送问题
```bash
# 如果提示权限错误
git remote set-url origin git@github.com:Kousoyu/limbicdb.git

# 或使用 HTTPS
git remote set-url origin https://github.com/Kousoyu/limbicdb.git
```

### TypeScript 构建问题
```bash
# 清理重建
rm -rf dist node_modules
npm install
npm run build
```

## 📞 紧急联系人/资源

1. **npm 支持**: https://npmjs.com/support
2. **GitHub 文档**: https://docs.github.com
3. **TypeScript 配置**: 项目已配置严格模式
4. **SQLite 文档**: https://github.com/JoshuaWise/better-sqlite3

---

**记住**: 今天的目标是**发布 MVP，验证市场反馈**。SQLite 可以明天开始做。

LimbicDB 的核心创新（认知原语+记忆衰减）已经完整实现。内存版足够展示这个创新点。

**立即行动 > 完美主义** 🚀