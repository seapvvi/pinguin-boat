import type { ThemeConfig } from '@pinguin/shared';

export function generateThemeCSSVariables(theme: ThemeConfig): string {
  const c = theme.colors;
  return `
    --bg-primary: ${c.background};
    --bg-surface: ${c.surface};
    --bg-surface-alt: ${c.surfaceAlt};
    --bg-sidebar: ${c.sidebar};
    --bg-sidebar-active: ${c.sidebarActive};
    --bg-header: ${c.header};
    --border-color: ${c.border};
    --text-primary: ${c.text};
    --text-secondary: ${c.textSecondary};
    --accent: ${c.accent};
    --accent-hover: ${c.accentHover};
    --success: ${c.success};
    --warning: ${c.warning};
    --error: ${c.error};
    --info: ${c.info};
    --radius: 0px;
    --radius-sm: 0px;
    --radius-md: 0px;
    --radius-lg: 0px;
    --radius-xl: 0px;
  `;
}

export function applyTheme(theme: ThemeConfig): void {
  const root = document.documentElement;
  const vars = generateThemeCSSVariables(theme);
  const existing = document.getElementById('theme-variables');
  if (existing) existing.remove();
  const style = document.createElement('style');
  style.id = 'theme-variables';
  style.textContent = `:root { ${vars} }`;
  document.head.appendChild(style);
}
