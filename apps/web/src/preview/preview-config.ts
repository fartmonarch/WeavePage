// 与后端 GeneratedComponent 的源码长度上限保持一致。
export const PREVIEW_LIMITS = {
  componentChars: 20_000,
  appChars: 10_000,
} as const

// 沙盒运行所需依赖。
export const PREVIEW_SETUP = {
  dependencies: {
    react: '19.2.8',
    'react-dom': '19.2.8',
  },
}
