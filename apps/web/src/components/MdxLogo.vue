<script setup lang="ts">
/**
 * MDX 应用 logo —— 品牌绿圆角方块 + 白色几何 M 字
 * 用内联 SVG 而非位图，避免任何尺寸下出现栅格化模糊，也方便跟随主题色微调。
 */
defineProps<{
  /** 渲染尺寸（正方形） */
  size?: number | string
}>()
</script>

<template>
  <svg
    class="mdx-logo"
    :width="size ?? 32"
    :height="size ?? 32"
    viewBox="0 0 32 32"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="MDX"
    role="img"
  >
    <rect width="32" height="32" rx="7" fill="#07c160" />
    <path
      d="M8 23 V9 H11 L16 18 L21 9 H24 V23 H21.5 V14 L17 21 H15 L10.5 14 V23 Z"
      fill="#fff"
    />
  </svg>
</template>

<style scoped>
.mdx-logo {
  display: block;
  flex-shrink: 0;
}
</style>
