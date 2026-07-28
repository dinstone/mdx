// 纯对象配置（不引入 'vitest/config'，避免 apps/web 未链接 vitest 时报错）
export default {
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}
