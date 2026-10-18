export interface GenerateRequest {
    description: string
}

export interface GenerateResponse {
    request_id: string
    mode: 'mock'
    component_name: string
    summary: string
    code: string
}