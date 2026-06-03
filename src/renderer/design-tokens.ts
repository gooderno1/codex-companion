const designTokenVariables = {
  "--bg-canvas": "#f3efe8",
  "--bg-veil": "rgba(247, 244, 237, 0.82)",
  "--surface-primary": "rgba(255, 252, 246, 0.86)",
  "--surface-strong": "rgba(255, 255, 255, 0.94)",
  "--surface-muted": "rgba(255, 249, 240, 0.72)",
  "--line-soft": "rgba(33, 43, 62, 0.10)",
  "--line-strong": "rgba(27, 88, 124, 0.24)",
  "--text-primary": "#172033",
  "--text-secondary": "#5d677d",
  "--text-tertiary": "#8d96a8",
  "--accent-blue": "#2c7fb8",
  "--accent-teal": "#149a9b",
  "--accent-amber": "#d4842f",
  "--accent-rose": "#d66761",
  "--accent-green": "#0f9f79",
  "--shadow-soft": "0 18px 50px rgba(23, 32, 51, 0.08)",
  "--shadow-strong": "0 26px 70px rgba(23, 32, 51, 0.12)",
  "--radius-shell": "30px",
  "--radius-panel": "24px",
  "--radius-card": "20px",
  "--radius-pill": "999px",
  "--space-1": "4px",
  "--space-2": "8px",
  "--space-3": "12px",
  "--space-4": "16px",
  "--space-5": "20px",
  "--space-6": "24px",
  "--space-7": "28px",
  "--space-8": "32px",
  "--space-10": "40px",
  "--font-sans": "\"Bahnschrift\", \"Segoe UI Variable Display\", \"Microsoft YaHei UI\", \"PingFang SC\", sans-serif",
  "--font-mono": "\"Cascadia Mono\", \"JetBrains Mono\", \"Consolas\", monospace"
} as const;

export const designTokens = {
  color: {
    canvas: designTokenVariables["--bg-canvas"],
    surface: designTokenVariables["--surface-primary"],
    text: designTokenVariables["--text-primary"],
    accentBlue: designTokenVariables["--accent-blue"],
    accentTeal: designTokenVariables["--accent-teal"],
    accentAmber: designTokenVariables["--accent-amber"],
    accentRose: designTokenVariables["--accent-rose"],
    accentGreen: designTokenVariables["--accent-green"]
  },
  radius: {
    shell: designTokenVariables["--radius-shell"],
    panel: designTokenVariables["--radius-panel"],
    card: designTokenVariables["--radius-card"],
    pill: designTokenVariables["--radius-pill"]
  },
  font: {
    sans: designTokenVariables["--font-sans"],
    mono: designTokenVariables["--font-mono"]
  }
} as const;

export function applyDesignTokens(root: HTMLElement = document.documentElement) {
  for (const [token, value] of Object.entries(designTokenVariables)) {
    root.style.setProperty(token, value);
  }
}
