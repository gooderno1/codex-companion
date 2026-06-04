const designTokenVariables = {
  "--bg-canvas": "#f7faff",
  "--bg-veil": "rgba(255, 255, 255, 0.985)",
  "--surface-primary": "rgba(255, 255, 255, 0.985)",
  "--surface-strong": "#ffffff",
  "--surface-muted": "rgba(247, 250, 255, 0.86)",
  "--line-soft": "rgba(37, 99, 235, 0.10)",
  "--line-strong": "rgba(37, 99, 235, 0.16)",
  "--text-primary": "#101828",
  "--text-secondary": "#344054",
  "--text-tertiary": "#667085",
  "--text-muted": "#8a97a8",
  "--accent-blue": "#0b6ff2",
  "--accent-teal": "#12b8d7",
  "--accent-amber": "#d88a1f",
  "--accent-rose": "#d04444",
  "--accent-green": "#10a35b",
  "--shadow-soft": "0 8px 18px rgba(16, 24, 40, 0.035)",
  "--shadow-strong": "0 12px 28px rgba(16, 24, 40, 0.045)",
  "--radius-shell": "18px",
  "--radius-panel": "18px",
  "--radius-card": "18px",
  "--radius-pill": "999px",
  "--space-1": "4px",
  "--space-2": "8px",
  "--space-3": "12px",
  "--space-4": "14px",
  "--space-5": "18px",
  "--space-6": "20px",
  "--space-7": "24px",
  "--space-8": "28px",
  "--space-10": "36px",
  "--font-sans": "\"Segoe UI Variable Display\", \"Microsoft YaHei UI\", \"PingFang SC\", sans-serif",
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
