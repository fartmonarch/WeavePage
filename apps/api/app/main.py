from typing import Literal
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    description: str = Field(min_length=3, max_length=1000)


class GenerateResponse(BaseModel):
    request_id: str
    mode: Literal["mock"]
    component_name: str
    summary: str
    code: str


app = FastAPI(title="WeavePage API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/generate", response_model=GenerateResponse)
async def generate_component(request: GenerateRequest):
    return GenerateResponse(
        request_id=str(uuid4()),
        mode="mock",
        component_name="GeneratedButton",
        summary=(f"已收到你的需求：{request.description}。当前返回模拟结果，还没有调用模型。"),
        code="""export function GeneratedButton() {
                return (
                    <button type="button">
                        示例组件
                    </button>
                        ) ;
                }""",
    )


@app.get("/health")
async def health():
    return {"status": "ok", "service": "weavepage-api"}
