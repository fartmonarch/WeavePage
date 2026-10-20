import { Sandpack } from '@codesandbox/sandpack-react'

interface SandpackComponentPreviewProps {
  code: string
  componentName: string
  bundlerUrl: string
}

const componentNamePattern = /^[A-Z][A-Za-z0-9]*$/

export default function SandpackComponentPreview({
  code,
  componentName,
  bundlerUrl,
}: SandpackComponentPreviewProps) {
  if (!bundlerUrl) {
    return <p role="alert">尚未配置本地预览 bundler。</p>
  }

  if (!componentNamePattern.test(componentName)) {
    return <p role="alert">组件名称不符合命名导出约定，无法预览。</p>
  }

  const files = {
    '/GeneratedComponent.tsx': {
      code,
      active: true,
      readOnly: true,
    },
    '/App.tsx': {
      code: [
        `import { ${componentName} } from './GeneratedComponent'`,
        '',
        'export default function App() {',
        `  return <${componentName} />`,
        '}',
      ].join('\n'),
      hidden: true,
    },
  }

  return (
    <Sandpack
      template="react-ts"
      files={files}
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
