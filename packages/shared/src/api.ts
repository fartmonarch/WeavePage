import type { GenerateRequest, GenerateResponse } from './types'

export async function generateComponent(
    request: GenerateRequest,
): Promise<GenerateResponse> {
    const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || `请求失败：HTTP ${response.status}`)
    }

    return (await response.json()) as GenerateResponse
}