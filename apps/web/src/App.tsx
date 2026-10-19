import { useState, type FormEvent } from 'react'
import { generateComponent, type GenerateResponse } from '@weavepage/shared'
import './App.css'

function App() {
  const [description, setDescription] = useState('')
  const [result, setResult] = useState<GenerateResponse | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const prompt = description.trim()
    if (prompt.length < 3) {
      setError('请至少输入 3 个字符。')
      return
    }

    setIsLoading(true)
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
        <p className="eyebrow">WeavePage · V0.1</p>
        <h1>React 组件工作台</h1>
        <p>描述你想要的组件，查看 API 返回的模拟结果。</p>
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

      {result && (
        <section className="result-card" aria-live="polite">
          <div className="result-heading">
            <div>
              <p className="eyebrow">模拟响应 · 尚未调用模型</p>
              <h2>{result.component_name}</h2>
            </div>
            <code>{result.request_id}</code>
          </div>
          <p>{result.summary}</p>
          <pre>
            <code>{result.code}</code>
          </pre>
        </section>
      )}
    </main>
  )
}

export default App
