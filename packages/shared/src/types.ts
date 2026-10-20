export interface GenerateRequest {
  description: string
}

export interface GenerateResponse {
  request_id: string
  component_name: string
  summary: string
  code: string
  css: string
  preview_code: string
}
