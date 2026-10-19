# WeavePage

织页是一个 React 组件生成工作台。当前 V0.2 支持输入自然语言需求，
由后端调用 DeepSeek，返回经过 JSON 解析和 Pydantic 校验的组件名、摘要与源码。

## 当前能力与限制

- React + TypeScript 工作台和 FastAPI 后端。
- 使用 deepseek-flash 生成单文件 React 组件。
- API Key 仅由后端读取。
- 展示加载状态、生成结果和错误信息。
- 当前校验数据格式，尚未编译或运行生成源码。
- 检索、隔离预览、多轮修改和保存导出按后续版本实现。

## 启动 API

需要 Python 3.13+ 和 uv。在仓库根目录执行：

```powershell
cd apps/api
uv sync --locked
```

首次运行时，将 .env.example 复制为 .env，填入 DeepSeek API Key。
已有 .env 时保留现有配置，不要覆盖。

```powershell
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

接口文档：http://127.0.0.1:8000/docs

## 启动 Web

另开终端，在仓库根目录执行。pnpm 版本见 package.json：

```powershell
pnpm install --frozen-lockfile
pnpm dev:web
```

浏览器访问终端显示的本地地址。

## 接口

- GET /health：健康检查。
- POST /api/generate：提交 description，返回 request_id、
  component_name、summary 和 code。

当前组件约定为命名导出，只依赖 React。
Web 构建不会检查作为字符串返回的模型生成源码。

[V0.2 开发记录与待优化项](docs/development/V0.2_REVIEW.md)
