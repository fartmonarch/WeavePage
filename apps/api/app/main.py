from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .generator import (
    ModelConfigurationError,
    ModelOutputError,
    ModelProviderError,
    ModelRateLimitError,
    ModelTimeoutError,
    generate_component,
)
from .schemas import GenerateRequest, GenerateResponse

app = FastAPI(title="WeavePage API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest):
    try:
        generated = await generate_component(request.description)
    except ModelConfigurationError as exc:
        raise HTTPException(
            status_code=503,
            detail="服务端尚未配置 DeepSeek API Key。",
        ) from exc
    except ModelTimeoutError as exc:
        raise HTTPException(
            status_code=504,
            detail="模型请求超时，请稍后重试。",
        ) from exc
    except ModelRateLimitError as exc:
        raise HTTPException(
            status_code=429,
            detail="模型服务当前请求过多，请稍后重试。",
        ) from exc
    except ModelOutputError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"模型返回内容格式不正确：{exc}",
        ) from exc
    except ModelProviderError as exc:
        raise HTTPException(
            status_code=502,
            detail="暂时无法连接模型服务，请检查配置或稍后重试。",
        ) from exc

    return GenerateResponse(
        request_id=str(uuid4()),
        **generated.model_dump(),
    )


@app.get("/health")
async def health():
    return {"status": "ok", "service": "weavepage-api"}
