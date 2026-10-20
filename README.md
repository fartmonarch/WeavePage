# WeavePage

织页是一个 React 组件生成工作台。当前 V0.3 支持输入自然语言需求，
由后端调用 DeepSeek，返回经过 JSON 解析和 Pydantic 校验的组件、CSS 与使用示例，
并在 Sandpack 中预览。本轮功能验收通过，证据来源为开发者反馈，详见开发记录。

## 当前能力与限制

- React + TypeScript 工作台和 FastAPI 后端。
- 使用 deepseek-flash 生成 React + TypeScript 组件、独立 CSS 和使用示例。
- API Key 仅由后端读取。
- 展示加载状态、生成结果和错误信息。
- 支持 Sandpack 三文件预览、只读文件查看、复制当前文件和最小接入说明。
- 当前生成范围仅允许 React 和普通 CSS；隔离和资源限制按已验证范围描述。
- 工作台构建不等于生成源码的完整类型与行为验证。
- 检索、多轮修改、版本保存和 ZIP 导出按后续版本实现。

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

预览还需要保持现有本地 Sandpack bundler 运行。Web 通过环境变量
`VITE_SANDBOX_BUNDLER_URL` 读取其地址；沿用已有配置，预览地址应与主应用不同源。
当前仓库尚未记录 bundler 的具体部署和启动命令，见 V0.3 开发记录中的复现限制。

## 接口

- GET /health：健康检查。
- POST /api/generate：提交 description，返回 request_id、
  component_name、summary、code、css 和 preview_code。

组件约定为命名导出，源码导入同目录的 `GeneratedComponent.css`，只依赖 React。
`preview_code` 对应 Sandpack 的 `App.tsx` 使用示例。Web 构建不会对作为字符串返回的
模型生成源码执行完整的 TypeScript 类型和行为检查。

- [开发命令与依赖管理](docs/development/COMMANDS_AND_DEPENDENCIES.md)
- [格式化命令](docs/代码自动格式化.md)
- [V0.3 开发记录与已知限制](docs/development/V0.3_REVIEW.md)
- [V0.2 开发记录与待优化项](docs/development/V0.2_REVIEW.md)
