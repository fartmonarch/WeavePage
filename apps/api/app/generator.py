import json

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


OUTPUT_EXAMPLE = {
    "component_name": "PrimaryButton",
    "summary": "一个主要操作按钮",
    "code": """export function PrimaryButton() {
  return <button type="button">继续</button>;
}""",
}

SYSTEM_PROMPT = """
你负责生成可复用的 React + TypeScript 单文件组件。

请只返回一个合法 JSON 对象，不要添加 Markdown 代码围栏或额外说明。
JSON 必须包含以下三个字符串字段：
- component_name：PascalCase 组件名
- summary：一句话说明组件功能
- code：完整的 React + TypeScript 组件源码

源码要求：
- 使用命名导出，导出名与 component_name 一致。
- 只依赖 React，不引入其他 npm 包。
- 代码适合保存为单个 .tsx 文件。
- 实现应精简，避免添加与需求无关的演示页面和功能。

code 是 JSON 字符串，源码中的引号、换行和反斜杠必须按 JSON 规则转义。

JSON 格式示例：
""" + json.dumps(OUTPUT_EXAMPLE, ensure_ascii=False)


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
                max_tokens=16384,
                extra_body={"thinking": {"type": "disabled"}},
            )
    except APITimeoutError as exc:
        raise ModelTimeoutError from exc
    except RateLimitError as exc:
        raise ModelRateLimitError from exc
    except (AuthenticationError, APIConnectionError, OpenAIError) as exc:
        raise ModelProviderError from exc

    if not response.choices:
        raise ModelOutputError("DeepSeek 没有返回 choices。")

    choice = response.choices[0]

    if choice.finish_reason == "length":
        raise ModelOutputError("输出达到 max_tokens 上限，JSON 可能被截断。")

    if choice.finish_reason == "content_filter":
        raise ModelOutputError("模型输出被内容过滤器拦截。")

    content = choice.message.content
    if not content or not content.strip():
        raise ModelOutputError("模型返回的 content 为空。")

    try:
        payload = json.loads(content)
    except json.JSONDecodeError as exc:
        print(
            f"[model-json] finish_reason={choice.finish_reason}, "
            f"reason={exc.msg}, position={exc.pos}",
            flush=True,
        )

        raise ModelOutputError(
            f"模型返回的不是有效 JSON：{exc.msg}（第 {exc.lineno} 行第 {exc.colno} 列）。"
        ) from exc

    try:
        return GeneratedComponent.model_validate(payload)
    except ValidationError as exc:
        issues = "；".join(
            f"{'.'.join(str(part) for part in error['loc']) or '根对象'}: {error['type']}"
            for error in exc.errors()
        )
        raise ModelOutputError(f"JSON 字段不符合约定：{issues}") from exc
