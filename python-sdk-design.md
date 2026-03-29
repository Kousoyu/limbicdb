# LimbicDB Python SDK 设计

## 核心原则
- **薄封装**: 不重写核心逻辑，仅桥接 CLI
- **接口一致**: Python SDK 输出 = CLI JSON 输出  
- **轻量依赖**: 无额外依赖，确保可移植性
- **渐进演进**: CLI → HTTP API → WASM (可替换)

## API 设计

### 基础类
```python
class Memory:
    def __init__(self, path=".limbic", mode="cli"):
        self.path = path
        self.mode = mode  # cli, http, wasm
    
    def add(self, content, type="fact", strength=1.0, metadata=None):
        """Add memory to database"""
        pass
        
    def search(self, query, top_k=5):
        """Search memories by query"""
        pass
        
    def explain(self, query):
        """Explain memory retrieval decisions"""
        pass
        
    def timeline(self, query):
        """Get memory timeline for query"""
        pass
        
    def forget(self, content):
        """Remove memory from database"""
        pass
```

## 实现方案

### 方案A: CLI 桥接 (Phase 2 首选)
```python
import subprocess
import json

class Memory:
    def __init__(self, path=".limbic"):
        self.path = path

    def _run_cli(self, command, args):
        """Execute CLI command and return JSON result"""
        cmd = ["npm", "run", command, "--"] + args + ["--json"]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd="/path/to/limbicdb"  # Need to configure this
        )
        if result.returncode != 0:
            raise Exception(f"CLI error: {result.stderr}")
        return json.loads(result.stdout)

    def explain(self, query):
        return self._run_cli("explain", [query])
```

### 方案B: HTTP API 桥接 (Phase 3)
```python
import requests

class Memory:
    def __init__(self, base_url="http://localhost:8080"):
        self.base_url = base_url

    def explain(self, query):
        response = requests.post(
            f"{self.base_url}/explain",
            json={"query": query}
        )
        return response.json()
```

## 包结构
```
limbicdb-python/
├── limbicdb/
│   ├── __init__.py
│   ├── memory.py      # Core Memory class
│   └── exceptions.py  # Custom exceptions
├── pyproject.toml     # Build configuration
├── README.md          # Python-specific documentation
└── examples/
    ├── basic_usage.py
    └── langchain_integration.py
```

## LangChain 集成

### Memory Adapter
```python
from langchain.memory import BaseMemory
from limbicdb import Memory

class LimbicMemory(BaseMemory):
    def __init__(self, db_path=".limbic"):
        self.db = Memory(db_path)
    
    @property
    def memory_variables(self):
        return ["history"]
    
    def load_memory_variables(self, inputs):
        query = inputs.get("input", "")
        results = self.db.search(query)
        context = "\n".join([r["content"] for r in results])
        return {"history": context}
    
    def save_context(self, inputs, outputs):
        text = inputs.get("input", "") + " " + outputs.get("output", "")
        self.db.add(text, type="event")
```

### Explain 能力集成
```python
# After agent runs, explain the decision
def explain_agent_decision(agent_input, memory_db):
    """Explain why the agent made a particular decision"""
    explanation = memory_db.explain(agent_input)
    return explanation
```

## 输出格式一致性

### CLI JSON 输出 (当前)
```json
{
  "query": "anime",
  "candidates": [
    {
      "memory": {"content": "User likes anime", "strength": 0.5},
      "score": 0.82,
      "reasons": ["exact match: \"anime\"", "strength: 0.50"]
    }
  ],
  "conflicts": true,
  "decisionTrace": [
    "retrieved 2 total memories",
    "filtered to 2 relevant memories"
  ]
}
```

### Python SDK 输出 (必须一致)
```python
explanation = memory.explain("anime")
# explanation should have same structure as CLI JSON
```

## 开发任务清单

### Phase 2 (7-14天)
- [ ] 创建 Python 包结构
- [ ] 实现 CLI 桥接核心类
- [ ] 确保输出格式一致性  
- [ ] 创建 LangChain adapter
- [ ] 编写基础使用示例
- [ ] 测试基本功能集成

### Phase 3 (14-30天)  
- [ ] 发布到 PyPI
- [ ] 创建 HTTP API 选项
- [ ] 完善文档和示例
- [ ] 收集用户反馈

## 风险控制

### 技术风险
- **CLI 路径依赖**: 需要配置 LimbicDB 安装路径
- **性能开销**: subprocess 调用有额外开销
- **错误处理**: 需要妥善处理 CLI 错误

### 解决方案
- **路径配置**: 提供环境变量或配置参数
- **缓存优化**: 对频繁调用做简单缓存
- **异常映射**: 将 CLI 错误转换为 Python 异常