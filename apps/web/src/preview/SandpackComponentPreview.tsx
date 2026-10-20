import { Sandpack } from '@codesandbox/sandpack-react'

interface SandpackComponentPreviewProps {
  code: string
  previewCode: string
  componentName: string
  bundlerUrl: string
}

const componentNamePattern = /^[A-Z][A-Za-z0-9]*$/

export default function SandpackComponentPreview({
  code,
  previewCode,
  componentName,
  bundlerUrl,
}: SandpackComponentPreviewProps) {
  if (!bundlerUrl) {
    return <p role="alert">尚未配置本地预览 bundler。</p>
  }

  if (!componentNamePattern.test(componentName)) {
    return <p role="alert">组件名称不符合命名导出约定，无法预览。</p>
  }

  if (!previewCode?.trim()) {
    return <p role="alert">缺少预览入口，请重新生成组件。</p>
  }

  return (
    <Sandpack
      template="react-ts"
      theme="light"
      files={{
        '/GeneratedComponent.tsx': {
          code,
          active: true,
          readOnly: true,
        },
        '/App.tsx': {
          code: previewCode,
          readOnly: true,
        },
      }}
      customSetup={{
        dependencies: {
          react: '19.2.8',
          'react-dom': '19.2.8',
        },
      }}
      options={{
        bundlerURL: bundlerUrl,
        showNavigator: false,
        showLineNumbers: true,
        showInlineErrors: true,
      }}
    />
  )
}
