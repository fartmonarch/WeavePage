import { useState, type SubmitEvent } from 'react'
import { generateComponent, type GenerateResponse } from '@weavepage/shared'
import { lazy, Suspense } from 'react'
import './App.css'

const SandpackComponentPreview = lazy(() => import('./preview/SandpackComponentPreview'))

function App() {
  const [description, setDescription] = useState('')
  const [result, setResult] = useState<GenerateResponse | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [generationId, setGenerationId] = useState(0)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    // 阻止浏览器默认行为：提交表单后刷新页面。在 React 单页应用里通常都要阻止。
    event.preventDefault()

    // 去掉前后空格
    const prompt = description.trim()
    if (prompt.length < 3) {
      setError('请至少输入 3 个字符。')
      return
    }

    setIsLoading(true)
    setGenerationId((value) => value + 1)
    setError('')
    setResult(null)

    try {
      const response = await generateComponent({ description: prompt })
      setResult(response)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '发生未知错误。')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="workspace">
      <header className="page-header">
        <p className="eyebrow">WeavePage · V0.3</p>
        <h1>React 组件工作台</h1>
        <p>描述你想要的组件，查看模型生成的 React 组件代码。</p>
      </header>

      <form className="request-card" onSubmit={handleSubmit}>
        <label htmlFor="description">组件需求</label>
        <textarea
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="例如：一个带加载状态的提交按钮"
          minLength={3}
          maxLength={1000}
          required
          rows={5}
        />
        <div className="form-footer">
          <span>{description.length}/1000</span>
          <button type="submit" disabled={isLoading}>
            {isLoading ? '请求中…' : '发送需求'}
          </button>
        </div>
      </form>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {(isLoading || result) && (
        <section className="result-card" aria-busy={isLoading}>
          <div className="result-heading">
            <div>
              <p className="eyebrow">DeepSeek 生成结果</p>
              <h2>{result?.component_name ?? '正在生成组件'}</h2>
            </div>
            {result && <code>{result.request_id}</code>}
          </div>
          {result && <p>{result.summary}</p>}
          <Suspense fallback={<p>正在准备代码视图…</p>}>
            <SandpackComponentPreview
              key={generationId}
              code={result?.code ?? ''}
              previewCode={result?.preview_code ?? ''}
              componentName={result?.component_name ?? ''}
              bundlerUrl={import.meta.env.VITE_SANDBOX_BUNDLER_URL ?? ''}
              isGenerating={isLoading}
            />
          </Suspense>
        </section>
      )}
    </main>
  )
}

export default App
