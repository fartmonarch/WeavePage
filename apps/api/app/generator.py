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
    "component_name": "GreetingTitle",
    "summary": "展示传入文本的标题组件",
    "code": """export function GreetingTitle({ text }: { text: string }) {
  return <h1>{text}</h1>;
}""",
    "preview_code": """import { GreetingTitle } from './GeneratedComponent';

export default function App() {
  return <GreetingTitle text="Hello, WeavePage" />;
}""",
}

SYSTEM_PROMPT = """
你负责生成一个可复用的 React + TypeScript 单文件组件，
以及展示该组件效果的最小预览入口。

请只返回一个合法 JSON 对象，不要添加 Markdown 代码围栏、
额外说明、<final> 或 </final> 标签。

JSON 必须包含以下四个字符串字段：
- component_name：PascalCase 组件名。
- summary：一句话说明组件功能。
- code：组件的完整 TSX 源码，对应 /GeneratedComponent.tsx。
- preview_code：预览入口的完整 TSX 源码，对应 /App.tsx。

组件源码要求：
- 使用命名导出，导出名必须与 component_name 一致。
- 只依赖 React，不引入其他 npm 包。
- 所有实现放在单个文件中，不依赖额外 CSS、图片或其他文件。
- 样式使用 React 的 style 属性。
- 实现应精简，避免添加与需求无关的功能。

预览入口要求：
- 从 './GeneratedComponent' 导入生成的命名组件。
- 默认导出 function App()。
- 为组件的所有必填属性提供有效的示例值。
- 需要文本、列表、children 或回调时，在入口中提供完整示例。
- 入口应直接展示用户要求的效果。
- 不调用 createRoot 或 ReactDOM.render，模板已负责挂载。
- 只允许导入 React 和 './GeneratedComponent'。

code 和 preview_code 都是 JSON 字符串。
源码中的引号、换行和反斜杠必须按 JSON 规则转义。

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
    content = content.strip()

    # 兼容模型接口偶尔附带的结束标签。
    final_tag = "</final>"
    if content.endswith(final_tag):
        content = content[: -len(final_tag)].rstrip()
        print("[model-json] 已移除尾部 </final> 标签", flush=True)

    try:
        payload = json.loads(content)
    except json.JSONDecodeError as exc:
        start = max(0, exc.pos - 100)
        end = min(len(content), exc.pos + 150)

        print(
            f"[model-json] finish_reason={choice.finish_reason}, "
            f"reason={exc.msg}, position={exc.pos}, "
            f"content_length={len(content)}, "
            f"context={content[start:end]!r}",
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
