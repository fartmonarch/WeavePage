import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from '@codesandbox/sandpack-react'
import { PREVIEW_LIMITS, PREVIEW_SETUP } from './preview-config'

interface SandpackComponentPreviewProps {
  code: string
  css: string
  previewCode: string
  componentName: string
  bundlerUrl: string
  isGenerating?: boolean
}

type WorkspaceTab = 'code' | 'preview' | 'usage'

const WORKSPACE_TABS: { value: WorkspaceTab; label: string }[] = [
  { value: 'code', label: '代码' },
  { value: 'preview', label: '即时预览' },
  { value: 'usage', label: '接入说明' },
]

const VISIBLE_FILES = ['/GeneratedComponent.tsx', '/GeneratedComponent.css', '/App.tsx']

function checkPreviewInput(props: SandpackComponentPreviewProps): string {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(props.componentName)) {
    return '组件名称不符合命名导出约定。'
  }

  if (!props.code.trim() || !props.css.trim() || !props.previewCode.trim()) {
    return '缺少组件、CSS 或使用示例，请重新生成。'
  }

  if (props.code.length > PREVIEW_LIMITS.componentChars) {
    return `组件源码超过 ${PREVIEW_LIMITS.componentChars} 字符上限。`
  }

  if (props.css.length > PREVIEW_LIMITS.cssChars) {
    return `CSS 超过 ${PREVIEW_LIMITS.cssChars} 字符上限。`
  }

  if (props.previewCode.length > PREVIEW_LIMITS.appChars) {
    return `使用示例超过 ${PREVIEW_LIMITS.appChars} 字符上限。`
  }

  if (!props.bundlerUrl) {
    return '尚未配置本地预览 bundler。'
  }

  try {
    const url = new URL(props.bundlerUrl)

    if (!['http:', 'https:'].includes(url.protocol)) {
      return '预览地址必须使用 HTTP 或 HTTPS。'
    }

    if (url.origin === window.location.origin) {
      return '预览必须使用与主应用不同的源。'
    }
  } catch {
    return '预览 bundler 地址不是有效的绝对 URL。'
  }

  return ''
}

function buildUsageGuide(componentName: string): string {
  return `组件：${componentName}

适用项目
支持 CSS import 的 React + TypeScript 项目，例如 Vite。
预览环境使用 React ${PREVIEW_SETUP.dependencies.react}。
本组件不需要额外安装第三方 UI 库。

文件放置
在你的项目中新建 src/generated/，将三个文件分别保存到：

src/generated/GeneratedComponent.tsx
src/generated/GeneratedComponent.css
src/generated/App.tsx

展示完整示例
在自己的 src/App.tsx 中导入并渲染：

import GeneratedDemo from './generated/App'

export default function App() {
  return <GeneratedDemo />
}

复用组件
GeneratedComponent.tsx 是组件实现。
GeneratedComponent.css 是必需样式，由组件源码导入。
generated/App.tsx 是使用示例，包含示例属性和回调。

需要将组件接入自己的页面时，可以导入：

import { ${componentName} } from './generated/GeneratedComponent'

组件需要哪些属性，请参考生成的 App.tsx。

注意
组件文件和 CSS 文件应保持相邻，避免 CSS 相对导入失效。
将示例合并进已有项目时，请保留原项目的挂载入口。
页面上的预览不等于完整的 TypeScript 类型检查；
接入后仍需运行你自己项目的构建和行为检查。
`
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [status, setStatus] = useState<'idle' | 'copying' | 'done' | 'error'>('idle')

  async function handleCopy() {
    setStatus('copying')

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('当前环境不支持剪贴板 API。')
      }

      await navigator.clipboard.writeText(text)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="workspace-copy-control">
      <button
        type="button"
        className="workspace-copy-button"
        onClick={handleCopy}
        disabled={!text || status === 'copying'}
      >
        {status === 'copying' ? '正在复制…' : label}
      </button>
      <span className="workspace-copy-status" role="status">
        {status === 'done' && '已复制'}
        {status === 'error' && '复制失败，请选中内容后手动复制。'}
      </span>
    </div>
  )
}

function CurrentFileActions() {
  const { sandpack } = useSandpack()
  const { activeFile, files } = sandpack
  const code = files[activeFile]?.code ?? ''

  return (
    <div className="workspace-copybar">
      <code>{activeFile}</code>
      <CopyButton key={activeFile} text={code} label="复制当前文件" />
    </div>
  )
}

export default function SandpackComponentPreview(props: SandpackComponentPreviewProps) {
  const id = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [selectedTab, setSelectedTab] = useState<WorkspaceTab>('preview')

  const isGenerating = props.isGenerating ?? false
  const hasResult = !isGenerating && Boolean(props.componentName)
  const activeTab = hasResult ? selectedTab : 'code'
  const issue = hasResult ? checkPreviewInput(props) : ''
  const guide = buildUsageGuide(props.componentName)

  const files = useMemo(
    () => ({
      '/GeneratedComponent.tsx': {
        code: props.code,
        readOnly: true,
      },
      '/GeneratedComponent.css': {
        code: props.css,
        readOnly: true,
      },
      '/App.tsx': {
        code: props.previewCode,
        readOnly: true,
      },
    }),
    [props.code, props.css, props.previewCode],
  )

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (!hasResult) return

    let nextIndex: number

    if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = WORKSPACE_TABS.length - 1
    } else if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % WORKSPACE_TABS.length
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + WORKSPACE_TABS.length) % WORKSPACE_TABS.length
    } else {
      return
    }

    event.preventDefault()
    setSelectedTab(WORKSPACE_TABS[nextIndex].value)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <section className="component-workspace" aria-label="组件工作区">
      <div className="workspace-toolbar">
        <div className="workspace-tabs" role="tablist" aria-label="查看组件">
          {WORKSPACE_TABS.map((tab, index) => (
            <button
              key={tab.value}
              ref={(element) => {
                tabRefs.current[index] = element
              }}
              id={`${id}-${tab.value}-tab`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.value}
              aria-controls={`${id}-${tab.value}-panel`}
              tabIndex={activeTab === tab.value ? 0 : -1}
              disabled={!hasResult && tab.value !== 'code'}
              onClick={() => {
                if (hasResult) setSelectedTab(tab.value)
              }}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isGenerating && (
          <span className="workspace-status" role="status">
            生成中…
          </span>
        )}
      </div>

      <SandpackProvider
        key={hasResult ? 'ready' : 'waiting'}
        template="react-ts"
        theme="light"
        files={files}
        customSetup={PREVIEW_SETUP}
        options={{
          bundlerURL: props.bundlerUrl,
          autorun: hasResult && !issue,
          visibleFiles: VISIBLE_FILES,
          activeFile: '/GeneratedComponent.tsx',
        }}
      >
        <SandpackLayout style={{ display: 'block', border: 0, borderRadius: 0 }}>
          <div
            id={`${id}-code-panel`}
            className="workspace-panel"
            role="tabpanel"
            aria-labelledby={`${id}-code-tab`}
            hidden={activeTab !== 'code'}
          >
            {props.code ? (
              <>
                <CurrentFileActions />
                <SandpackCodeEditor
                  showTabs
                  showReadOnly={false}
                  showLineNumbers
                  showInlineErrors
                  showRunButton={false}
                  wrapContent
                />
              </>
            ) : (
              <div className="workspace-empty" role="status">
                {isGenerating ? '正在等待模型返回代码…' : '暂无代码。'}
              </div>
            )}
          </div>

          <div
            id={`${id}-preview-panel`}
            className="workspace-panel"
            role="tabpanel"
            aria-labelledby={`${id}-preview-tab`}
            hidden={activeTab !== 'preview'}
          >
            {issue ? (
              <p className="error-message workspace-error" role="alert">
                {issue}
              </p>
            ) : (
              hasResult && <SandpackPreview showOpenInCodeSandbox={false} showRefreshButton />
            )}
          </div>

          <div
            id={`${id}-usage-panel`}
            className="workspace-panel"
            role="tabpanel"
            aria-labelledby={`${id}-usage-tab`}
            hidden={activeTab !== 'usage'}
          >
            {hasResult && (
              <div className="workspace-usage">
                <CopyButton text={guide} label="复制接入说明" />
                <pre className="workspace-guide">{guide}</pre>
              </div>
            )}
          </div>
        </SandpackLayout>
      </SandpackProvider>
    </section>
  )
}
