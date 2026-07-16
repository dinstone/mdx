<script setup lang="ts">
defineProps<{
  isDark: boolean
  isDesktop: boolean
  sidebarVisible: boolean
}>()

defineEmits<{
  toggleDark: []
  toggleSidebar: []
  openStorage: []

  openTheme: []
  copyHtml: []
  copyWechat: []
}>()
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <div class="logo">
        <img src="/logo.png" width="32" height="32" alt="logo" />
        <div class="logo-info">
          <span class="logo-text">MD.X=Edit + Preview + Publish</span>
          <span class="logo-subtitle"> Markdown 公众号排版神器</span>
        </div>
      </div>
    </div>

    <div class="header-actions">
      <button
        class="btn-sidebar-toggle"
        :title="sidebarVisible ? '隐藏工作区' : '显示工作区'"
        @click="$emit('toggleSidebar')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect v-if="sidebarVisible" x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line v-if="sidebarVisible" x1="9" y1="3" x2="9" y2="21" />
          <line v-if="!sidebarVisible" x1="3" y1="3" x2="21" y2="3" />
          <line v-if="!sidebarVisible" x1="3" y1="9" x2="21" y2="9" />
          <line v-if="!sidebarVisible" x1="3" y1="15" x2="21" y2="15" />
          <line v-if="!sidebarVisible" x1="3" y1="21" x2="21" y2="21" />
        </svg>
      </button>

      <button
        class="btn-icon-only"
        :title="isDark ? '切换到亮色模式' : '切换到暗色模式'"
        @click="$emit('toggleDark')"
      >
        <svg v-if="isDark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </button>

      <button v-if="!isDesktop" class="btn-secondary" @click="$emit('openStorage')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
        <span>工作区切换</span>
      </button>

      <button class="btn-secondary" @click="$emit('openTheme')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="2" x2="12" y2="22" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span>主题管理</span>
      </button>

      <button class="btn-secondary" @click="$emit('copyHtml')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
        <span>复制 HTML</span>
      </button>

      <button class="btn-primary" @click="$emit('copyWechat')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
        <span>复制到公众号</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  height: 72px;
  border-radius: 0;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-bottom: var(--border-width) solid var(--glass-border);
  box-shadow: var(--glass-shadow);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  position: sticky;
  top: 0;
  z-index: 100;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.btn-sidebar-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: var(--border-width) solid var(--border-light);
  border-radius: var(--radius-pill);
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-sidebar-toggle:hover {
  background: var(--bg-hover);
  color: var(--accent-primary);
  border-color: var(--accent-primary);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: transform 0.2s ease;
  color: var(--text-primary);
}

.logo:hover {
  transform: translateY(-1px);
}

.logo-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.logo-text {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.5px;
}

.logo-subtitle {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-hover);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-weight: 500;
  letter-spacing: 0.5px;
}

.btn-icon-only {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: var(--border-width) solid var(--border-light);
  border-radius: var(--radius-pill);
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-icon-only:hover {
  background: var(--bg-hover);
  color: var(--accent-primary);
  border-color: var(--accent-primary);
  transform: translateY(-1px);
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  background: var(--accent-gradient) !important;
  color: #ffffff !important;
  border: none;
  border-radius: var(--radius-pill);
  font-size: 14px;
  font-weight: 600;
  box-shadow: var(--shadow-md);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  letter-spacing: 0.3px;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.btn-primary:active {
  transform: translateY(1px);
  box-shadow: var(--shadow-sm);
}

.btn-secondary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: transparent;
  color: var(--text-secondary);
  border: var(--border-width) solid var(--border-light);
  border-radius: var(--radius-pill);
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
}

.btn-secondary:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.btn-secondary svg,
.btn-primary svg {
  width: 18px;
  height: 18px;
}

@media (max-width: 768px) {
  .app-header {
    height: 56px;
    border-radius: 0;
    padding: 0 12px;
  }

  .logo svg,
  .logo img {
    width: 32px;
    height: 32px;
  }

  .logo-text {
    font-size: 16px;
  }

  .logo-subtitle {
    display: none;
  }

  .btn-primary span,
  .btn-secondary span {
    display: none;
  }

  .btn-primary,
  .btn-secondary {
    padding: 8px 12px;
  }

  .btn-icon-only {
    width: 36px;
    height: 36px;
  }

  .header-actions .btn-secondary {
    display: none;
  }
}
</style>
