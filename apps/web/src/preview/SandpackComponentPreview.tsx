import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
} from '@codesandbox/sandpack-react'
import { PREVIEW_LIMITS, PREVIEW_SETUP } from './preview-config'

interface SandpackComponentPreviewProps {
  code: string
  previewCode: string
  componentName: string
  bundlerUrl: string
  isGenerating?: boolean
}

type WorkspaceTab = 'code' | 'preview'

function checkPreviewInput(props: SandpackComponentPreviewProps): string {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(props.componentName)) {
    return '组件名称不符合命名导出约定。'
  }
  if (!props.code?.trim() || !props.previewCode?.trim()) {
    return '缺少组件或预览入口，请重新生成。'
  }
  if (props.code.length > PREVIEW_LIMITS.componentChars) {
    return `组件源码超过 ${PREVIEW_LIMITS.componentChars} 字符上限。`
  }
  if (props.previewCode.length > PREVIEW_LIMITS.appChars) {
    return `预览入口超过 ${PREVIEW_LIMITS.appChars} 字符上限。`
  }
  if (!props.bundlerUrl) return '尚未配置本地预览 bundler。'
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

export default function SandpackComponentPreview(props: SandpackComponentPreviewProps) {
  const id = useId()
  const codeTabRef = useRef<HTMLButtonElement>(null)
  const previewTabRef = useRef<HTMLButtonElement>(null)
  const [selectedTab, setSelectedTab] = useState<WorkspaceTab>('preview')
  const isGenerating = props.isGenerating ?? false
  const complete = !isGenerating && !!props.code && !!props.previewCode && !!props.componentName
  const activeTab = complete ? selectedTab : 'code'
  const issue = complete ? checkPreviewInput(props) : ''
  const files = useMemo(
    () => ({
      '/GeneratedComponent.tsx': { code: props.code, readOnly: true },
      '/App.tsx': { code: props.previewCode, readOnly: true },
    }),
    [props.code, props.previewCode],
  )

  function selectTab(tab: WorkspaceTab) {
    // 生成期间始终停留在代码视图，完成后按初始选择自动进入预览。
    if (complete) setSelectedTab(tab)
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!complete) return
    let next: WorkspaceTab
    if (event.key === 'Home') next = 'code'
    else if (event.key === 'End') next = 'preview'
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      next = activeTab === 'code' ? 'preview' : 'code'
    } else return
    event.preventDefault()
    setSelectedTab(next)
    const target = next === 'code' ? codeTabRef : previewTabRef
    target.current?.focus()
  }

  return (
    <section className="component-workspace" aria-label="组件工作区">
      <div className="workspace-toolbar">
        <div className="workspace-tabs" role="tablist" aria-label="查看组件">
          <button
            ref={codeTabRef}
            id={`${id}-code-tab`}
            type="button"
            role="tab"
            aria-selected={activeTab === 'code'}
            aria-controls={`${id}-code-panel`}
            tabIndex={activeTab === 'code' ? 0 : -1}
            onClick={() => selectTab('code')}
            onKeyDown={handleTabKeyDown}
          >
            代码
          </button>
          <button
            ref={previewTabRef}
            id={`${id}-preview-tab`}
            type="button"
            role="tab"
            aria-selected={activeTab === 'preview'}
            aria-controls={`${id}-preview-panel`}
            tabIndex={activeTab === 'preview' ? 0 : -1}
            disabled={!complete}
            onClick={() => selectTab('preview')}
            onKeyDown={handleTabKeyDown}
          >
            即时预览
          </button>
        </div>
        {isGenerating && (
          <span className="workspace-status" role="status">
            生成中…
          </span>
        )}
      </div>
      <SandpackProvider
        key={complete ? 'preview' : 'generating'}
        template="react-ts"
        theme="light"
        files={files}
        customSetup={PREVIEW_SETUP}
        options={{
          bundlerURL: props.bundlerUrl,
          autorun: complete && !issue,
          visibleFiles: ['/GeneratedComponent.tsx', '/App.tsx'],
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
              <SandpackCodeEditor
                showReadOnly={false}
                showLineNumbers
                showInlineErrors
                showRunButton={false}
                wrapContent
              />
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
              complete && (
                <SandpackPreview showOpenInCodeSandbox={false} showRefreshButton={false} />
              )
            )}
          </div>
        </SandpackLayout>
      </SandpackProvider>
    </section>
  )
}
