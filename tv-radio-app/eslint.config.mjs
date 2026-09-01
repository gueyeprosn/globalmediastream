import nextConfig from 'eslint-config-next'

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ['archive/**', 'docs/**', '*.config.*'],
  },
]

export default eslintConfig
