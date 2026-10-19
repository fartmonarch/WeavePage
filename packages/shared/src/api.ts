import type { GenerateRequest, GenerateResponse } from './types'

export async function generateComponent(request: GenerateRequest): Promise<GenerateResponse> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      detail?: string | { msg?: string }[]
    } | null

    const detail = Array.isArray(errorBody?.detail)
      ? errorBody.detail
          .map((issue) => issue.msg)
          .filter(Boolean)
          .join('；')
      : errorBody?.detail

    throw new Error(detail || `请求失败：HTTP ${response.status}`)
  }

  return (await response.json()) as GenerateResponse
}
