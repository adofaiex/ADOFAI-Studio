export type ThemeType = "dark" | "light" | "high-contrast"

export interface ThemeColors {
  background: string
  foreground: string
  border: string
  accent: string
  sidebar: string
  tabActive: string
  tabInactive: string
  statusBackground: string
  editorBackground: string
  menuBackground: string
  hover: string
}

export const themes: Record<ThemeType, ThemeColors> = {
  dark: {
    background: "#1e1e1e",
    foreground: "#ffffff",
    border: "#3c3c3c",
    accent: "#3c7dd6",
    sidebar: "#252526",
    tabActive: "#1e1e1e",
    tabInactive: "#2d2d2d",
    statusBackground: "#007acc",
    editorBackground: "#1e1e1e",
    menuBackground: "#252526",
    hover: "#2a2d2e",
  },
  light: {
    background: "#ffffff",
    foreground: "#1f2937",
    border: "#e5e7eb",
    accent: "#06b6d4",
    sidebar: "#f9fafb",
    tabActive: "#ffffff",
    tabInactive: "#f3f4f6",
    statusBackground: "#06b6d4",
    editorBackground: "#ffffff",
    menuBackground: "#f9fafb",
    hover: "#f3f4f6",
  },
  "high-contrast": {
    background: "#000000",
    foreground: "#ffffff",
    border: "#ffffff",
    accent: "#ffff00",
    sidebar: "#000000",
    tabActive: "#000000",
    tabInactive: "#000000",
    statusBackground: "#000000",
    editorBackground: "#000000",
    menuBackground: "#000000",
    hover: "#ffffff",
  },
}
