from openai import (
    APIConnectionError,
    APITimeoutError,
    AsyncOpenAI,
    AuthenticationError,
    OpenAIError,
    RateLimitError,
)
from pydantic import ValidationError

from .schemas import GeneratedComponent
from .settings import settings


class ModelConfigurationError(Exception):
    pass


class ModelTimeoutError(Exception):
    pass


class ModelRateLimitError(Exception):
    pass


class ModelProviderError(Exception):
    pass


class ModelOutputError(Exception):
    pass


# 要求模型以 JSON 格式输出
SYSTEM_PROMPT = """
你负责生成可复用的 React + TypeScript 单文件组件。

请只返回 JSON 对象，不要添加 Markdown 代码围栏或额外说明。
JSON 必须包含以下三个字符串字段：
- component_name：PascalCase 组件名
- summary：一句话说明组件功能
- code：完整的 React + TypeScript 组件源码

源码要求：
- 使用命名导出，导出名与 component_name 一致。
- 只依赖 React，不引入其他 npm 包。
- 代码适合保存为单个 .tsx 文件。

JSON 格式示例：
{"
    component_name":"PrimaryButton",
    "summary":"一个主要操作按钮",
    "code":"export function PrimaryButton() { return <button>继续</button>; }
"}
"""


async def generate_component(description: str) -> GeneratedComponent:
    api_key = settings.deepseek_api_key.get_secret_value().strip()
    if not api_key:
        raise ModelConfigurationError

    try:
        async with AsyncOpenAI(
            api_key=api_key,
            base_url=settings.deepseek_base_url,
            timeout=settings.request_timeout_seconds,
            max_retries=0,
        ) as client:
            response = await client.chat.completions.create(
                model=settings.deepseek_model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": description},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
                max_tokens=4096,
            )
    except APITimeoutError as exc:
        raise ModelTimeoutError from exc
    except RateLimitError as exc:
        raise ModelRateLimitError from exc
    except (AuthenticationError, APIConnectionError, OpenAIError) as exc:
        raise ModelProviderError from exc

    if not response.choices:
        raise ModelOutputError

    content = response.choices[0].message.content
    if not content or not content.strip():
        raise ModelOutputError
    # 再检查 JSON 是否包含正确的字段和类型
    try:
        return GeneratedComponent.model_validate_json(content)
    except ValidationError as exc:
        raise ModelOutputError from exc
