from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    description: str = Field(min_length=3, max_length=1000)


# GeneratedComponent 描述模型必须生成的内容
class GeneratedComponent(BaseModel):
    component_name: str = Field(min_length=1, max_length=80)
    summary: str = Field(min_length=1, max_length=500)
    code: str = Field(min_length=1, max_length=20000)
    preview_code: str = Field(min_length=1, max_length=10000)


# GenerateResponse 描述我们自己的后端 API 返回给前端的内容
class GenerateResponse(BaseModel):
    request_id: str
    component_name: str
    summary: str
    code: str
    preview_code: str
