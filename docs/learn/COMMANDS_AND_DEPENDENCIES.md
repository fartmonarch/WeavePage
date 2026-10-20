# 开发命令与依赖管理

核对日期：2026-10-21。本文按当前仓库的脚本和配置解释命令。

**`pnpm --filter @weavepage/web lint` 是执行前端代码检查。给前端添加依赖要使用 `pnpm --filter @weavepage/web add 包名`。**

## 1. 先分清项目、依赖声明和安装环境

| 范围                        | 配置与锁文件                                        | 本地安装位置               | 本项目使用的工具 |
| --------------------------- | --------------------------------------------------- | -------------------------- | ---------------- |
| 根目录公共开发工具          | 根 `package.json`、根 `pnpm-lock.yaml`              | pnpm 管理的 `node_modules` | pnpm             |
| Web 应用 `apps/web`         | `apps/web/package.json`、根 `pnpm-lock.yaml`        | pnpm 管理的 `node_modules` | pnpm             |
| TS 共享包 `packages/shared` | `packages/shared/package.json`、根 `pnpm-lock.yaml` | pnpm 管理的 `node_modules` | pnpm             |
| Python API `apps/api`       | `apps/api/pyproject.toml`、`apps/api/uv.lock`       | `apps/api/.venv`           | uv               |

`package.json` / `pyproject.toml` 声明项目需要什么依赖及版本范围；锁文件记录解析后的具体版本和相关信息；安装目录才是本机实际使用的包。

这三个层次需要对应。只改依赖声明，不一定已经更新锁文件和本地环境。

`apps/api` 在目录上与 `apps/web` 并列，但本项目仍由 uv 管理 Python 依赖。给 Python 后端添加依赖时，使用后端的 uv 命令。

## 2. 为什么把 version 改成 0.3.0

在 `apps/api/pyproject.toml` 中：

```toml
[project]
name = "api"
version = "0.3.0"
```

这里表示 **API 项目自身的版本**。它不会自动升级 Python、FastAPI、React 或其他依赖，也不会自动实现新功能或发布项目。

本项目用 `0.3.0` 对应 V0.3 阶段。当前约定让下面三处保持一致：

- `pyproject.toml` 中的项目版本。
- `main.py` 中 `FastAPI(..., version="0.3.0")` 的接口文档版本。
- `uv.lock` 中名为 `api` 的项目条目的版本，由 uv 更新。

注意：`uv.lock` 顶部的 `version = 1` 是锁文件格式版本，不能为了项目升级把它改成 `0.3.0`。

## 3. uv lock、uv sync 和 uv run 各做什么

下面这组命令在 **后端目录**执行：

```powershell
cd D:\Code\WeavePage\apps\api

uv lock
uv sync --locked
uv run ruff check app
```

| 命令                    | 实际职责                                         | 主要影响                         |
| ----------------------- | ------------------------------------------------ | -------------------------------- |
| `uv lock`               | 根据 `pyproject.toml` 解析依赖，创建或更新锁文件 | `uv.lock`；本身不负责安装依赖    |
| `uv sync --locked`      | 检查锁文件是否与项目一致，再同步 Python 环境     | `.venv` 中的安装包；不更新锁文件 |
| `uv run ruff check app` | 准备项目环境，并在其中运行 Ruff 检查 `app` 目录  | 输出 Python 静态检查结果         |

修改项目版本后执行 `uv lock`，是为了同步锁文件里的项目元数据。有现有锁文件时，uv 会优先保留已锁定的依赖版本；它不等同于主动升级全部依赖。

`--locked` 表示：如果锁文件需要更新，就报错，避免在这一步悄悄重新锁定。发现不同步时，应先确认 `pyproject.toml` 的修改，再执行 `uv lock`。

`uv sync` 默认按选中的依赖集合精确同步环境，可能移除不在该集合里的安装包。当前 `dev` 组默认参与同步，因此其中的 Ruff 也会安装。

`uv run` 让命令使用该项目的 Python 环境，不需要先手动激活 `.venv`。默认情况下，它还会按需更新锁文件和同步环境。因此上述三个命令存在部分自动化上的重叠；收尾时分开写，是为了分别观察“锁定、安装、检查”三个步骤。

如果希望运行检查时也明确禁止更新锁文件，可以使用：

```powershell
uv run --locked ruff check app
```

Ruff 在本项目启用了 `E`、`F`、`I` 规则，主要检查相关代码规范、未定义名称和导入顺序等。`ruff check app` 没有 `--fix`，不会自动修复源码；也不是运行接口测试、类型检查或格式化。

`app` 是相对于当前终端目录的路径。不要在仓库根目录直接照抄 `uv run ruff check app`，因为那里没有这个 `app` 目录。

## 4. 前端这组命令各做什么

以下命令在 **仓库根目录**执行：

```powershell
cd D:\Code\WeavePage

pnpm exec prettier --write apps/web/src/preview/SandpackComponentPreview.tsx apps/web/src/preview/preview-config.ts apps/web/src/App.tsx apps/web/src/App.css packages/shared/src/types.ts
pnpm --filter @weavepage/web lint
pnpm build:web
pnpm dev:web
```

| 命令                                | 实际执行                                                     | 主要影响                                                |
| ----------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| `pnpm exec prettier --write ...`    | 使用项目已安装的 Prettier，格式化列出的文件                  | 会写回这些源码文件                                      |
| `pnpm --filter @weavepage/web lint` | 选择 Web 包，执行其 `lint` 脚本，即 `eslint .`               | 输出 ESLint 检查结果；当前脚本没有 `--fix`              |
| `pnpm build:web`                    | 执行根脚本，再调用 Web 的 `build`，即 `tsc -b && vite build` | 检查工作台 TS 项目，并在 `apps/web/dist` 生成构建产物等 |
| `pnpm dev:web`                      | 执行根脚本，再调用 Web 的 `dev`，即 `vite`                   | 启动开发服务器，终端会持续运行                          |

Prettier 主要处理格式；ESLint 检查配置规则能发现的代码问题；构建检查工作台类型与打包；开发服务器供浏览器访问。这几步职责不同。

**工作台构建通过，不代表接口返回字符串里的 TSX 已经通过类型检查或行为检查。** 生成结果还需要在 Sandpack 中观察，并在实际消费项目中验证。

`pnpm exec` 用来执行已安装的工具。这里 Prettier 已经声明在根目录 `devDependencies` 中，此命令不会把它新增为 Web 的依赖。

文件路径中的扩展名正常写 `.tsx`，不要把聊天内容中的转义字符复制成 `\.tsx`。上述命令每条都是一行，PowerShell 不使用末尾反斜杠作为续行标记。

## 5. 拆开理解 --filter 和 lint

```text
pnpm --filter @weavepage/web lint
     └─选择目标包──────────┘ └─执行它的脚本
```

`@weavepage/web` 来自 `apps/web/package.json` 的 `name` 字段：

```json
{
  "name": "@weavepage/web",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint ."
  }
}
```

下面两种写法等价：

```powershell
pnpm --filter @weavepage/web lint
pnpm --filter @weavepage/web run lint
```

`--filter` 只决定对哪个包执行后面的操作。后面是 `lint` 就执行检查脚本，后面是 `add` 才添加依赖。

根目录也定义了快捷脚本，因此：

```text
pnpm build:web
→ pnpm --filter @weavepage/web build
→ 在 apps/web 执行 tsc -b && vite build

pnpm dev:web
→ pnpm --filter @weavepage/web dev
→ 在 apps/web 执行 vite
```

## 6. 给前端添加、恢复和移除依赖

以下是按需要使用的示例，本次文档更新没有执行这些安装命令。

在仓库根目录，为 Web 添加运行依赖，例如图标库：

```powershell
cd D:\Code\WeavePage
pnpm --filter @weavepage/web add lucide-react
```

它会把声明写入 `apps/web/package.json` 的 `dependencies`，更新根 `pnpm-lock.yaml`，并安装依赖。

为 Web 添加开发工具，例如测试工具：

```powershell
pnpm --filter @weavepage/web add -D vitest
```

`-D` 将依赖写入 `devDependencies`，用于开发、检查或构建。`devDependencies` 也需要按用途声明，不能据此判断一个包是否会出现在前端最终产物中。

其他常见操作：

| 目的                         | 在仓库根目录执行                                   |
| ---------------------------- | -------------------------------------------------- |
| 给共享包添加依赖             | `pnpm --filter @weavepage/shared add zod`          |
| 给根目录添加公共开发工具     | `pnpm add -Dw prettier`                            |
| 移除 Web 依赖                | `pnpm --filter @weavepage/web remove lucide-react` |
| 根据现有声明和锁文件恢复安装 | `pnpm install --frozen-lockfile`                   |

`-w` 明确选择 workspace 根目录。像根目录的 Prettier，可以服务多个包；应用实际导入的依赖应声明在对应应用中。

`add` 用于新增依赖声明；`install --frozen-lockfile` 用于按已有记录安装，锁文件不同步时会失败。

## 7. 给后端添加、恢复和移除依赖

在后端目录，为应用添加运行依赖，例如 HTTP 客户端：

```powershell
cd D:\Code\WeavePage\apps\api
uv add httpx
```

默认情况下，`uv add` 会更新 `pyproject.toml`、`uv.lock`，并同步项目环境，通常不需要紧接着再手动执行一遍 `uv lock` 和 `uv sync`。

添加开发工具，例如 Ruff：

```powershell
uv add --dev ruff
```

它会记录在 `[dependency-groups].dev` 中。当前项目已声明 Ruff，这里是命令用法示例。

其他常见操作：

| 目的                   | 在 `apps/api` 执行     |
| ---------------------- | ---------------------- |
| 移除运行依赖           | `uv remove httpx`      |
| 移除开发依赖           | `uv remove --dev ruff` |
| 根据现有锁文件恢复环境 | `uv sync --locked`     |
| 检查锁文件是否过期     | `uv lock --check`      |

本项目的正式依赖使用 `uv add` / `uv remove` 维护，以便同时记录声明和锁文件。只向虚拟环境安装包，不能代替项目依赖声明。

## 8. 工作台依赖与 Sandpack 预览依赖是两套环境

例如在仓库根目录执行：

```powershell
pnpm --filter @weavepage/web add motion
```

这会让 **WeavePage 工作台源码**能够导入 `motion`，不会自动把它安装到 Sandpack 的虚拟项目里。

Sandpack 的运行依赖由预览模板及 `apps/web/src/preview/preview-config.ts` 中的 `PREVIEW_SETUP.dependencies` 等配置决定。当前生成范围只有 React 和普通 CSS。

以后允许生成组件使用第三方包时，需要一起处理生成约束、预览依赖配置、版本兼容性和用户接入说明。仅给 Web 安装包不能完成这个功能。

## 9. 平时应该选哪些命令

| 场景                                   | 建议操作                                                             |
| -------------------------------------- | -------------------------------------------------------------------- |
| 只修改源码、继续开发                   | 运行对应开发服务，按改动执行检查                                     |
| 手动改了 `pyproject.toml` 的版本或依赖 | `uv lock`，再 `uv sync --locked`                                     |
| 新增前端依赖                           | 对目标包执行 `pnpm --filter ... add ...`                             |
| 新增后端依赖                           | 在 `apps/api` 执行 `uv add ...`                                      |
| 拉取了别人更新的依赖和锁文件           | 根目录 `pnpm install --frozen-lockfile`；后端目录 `uv sync --locked` |
| 前端功能收尾                           | 格式化涉及文件，运行 lint、构建，再检查页面行为                      |
| 后端功能收尾                           | Ruff 检查，再按修改范围检查实际接口行为                              |

日常启动 API 和 Web 需要两个终端；Sandpack 的现有本地 bundler 也需保持运行。开发服务器占用终端是正常行为，使用 `Ctrl+C` 停止。

依赖变更时，应一起提交相应的声明文件与锁文件。`node_modules`、`.venv` 和构建产物继续按 `.gitignore` 排除。

## 官方参考

- [uv：锁定和同步](https://docs.astral.sh/uv/concepts/projects/sync/)
- [uv：项目依赖管理](https://docs.astral.sh/uv/concepts/projects/dependencies/)
- [pnpm：选择 workspace 包](https://pnpm.io/filtering)
- [pnpm：添加依赖](https://pnpm.io/cli/add)
- [pnpm：执行本地工具](https://pnpm.io/cli/exec)

本项目的 pnpm 版本以根 `package.json` 的 `packageManager` 字段为准，当前为 `pnpm@11.25.0`。官方在线文档可能面向更新版本；本文只使用当前项目涉及的基础命令。
