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
    "code": """import './GeneratedComponent.css';

interface GreetingTitleProps {
  text: string;
}

export function GreetingTitle({ text }: GreetingTitleProps) {
  return <h1 className="wp-greeting-title">{text}</h1>;
}""",
    "css": """.wp-greeting-title {
  margin: 0;
  padding: 24px;
  color: #4338ca;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.3;
}
""",
    "preview_code": """import { GreetingTitle } from './GeneratedComponent';

export default function App() {
  return <GreetingTitle text="Hello, WeavePage" />;
}""",
}

SYSTEM_PROMPT = """
你负责生成一个可复用的 React + TypeScript 组件、
对应的 CSS 文件，以及展示组件效果的最小使用示例。

请只返回一个合法 JSON 对象，不要添加 Markdown 代码围栏、
额外说明、<final> 或 </final> 标签。

JSON 必须包含以下五个字符串字段：
- component_name：PascalCase 组件名，只包含英文字母和数字，以大写字母开头。
- summary：一句话说明组件功能。
- code：组件完整 TSX 源码，对应 /GeneratedComponent.tsx。
- css：完整 CSS 源码，对应 /GeneratedComponent.css。
- preview_code：使用示例的完整 TSX 源码，对应 /App.tsx。

组件源码要求：
- 使用命名导出，导出名必须与 component_name 一致。
- 在源码中导入 './GeneratedComponent.css'。
- 除此 CSS 文件外，只允许导入 React。
- 不引入其他 npm 包、其他本地文件、远程脚本或外部图片。
- 常规样式写入 CSS 文件。
- 只有依赖运行时数值的样式才使用 style 属性。
- 为组件属性定义清楚的 TypeScript 类型。
- 组件内部可以管理状态，也可以通过属性接收数据和回调。
- 使用定时器、事件监听或动画帧时，应正确清理。
- 实现应精简，避免添加与需求无关的功能。

CSS 要求：
- css 字段必须包含有效样式，不能留空。
- 使用带 wp- 前缀的组件专属 class 名称。
- 选择器限制在组件自己的 class 范围内。
- 不直接修改 body、html、:root 或全局 button、input 等元素。
- @keyframes 名称也使用组件专属前缀，避免重名。
- 可以使用伪元素、hover、focus-visible、过渡和 CSS 动画。
- 动画应考虑 prefers-reduced-motion。
- 不使用 @import、外部字体或远程 url() 资源。
- CSS 文件只包含 CSS，不包含 style 标签。

使用示例要求：
- 从 './GeneratedComponent' 导入生成的命名组件。
- 默认导出 function App()。
- 为组件的所有必填属性提供有效示例值。
- 需要文本、列表、children 或回调时，提供完整示例。
- 回调需要展示状态变化时，在 App 中提供最小演示。
- 直接展示用户要求的效果。
- 预览容器可使用少量内联样式安排布局。
- 不调用 createRoot 或 ReactDOM.render，模板已经负责挂载。
- 只允许导入 React 和 './GeneratedComponent'。

所有源码字段都是 JSON 字符串。
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
