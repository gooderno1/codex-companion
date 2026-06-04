const designTokenVariables = {
  "--bg-canvas": "#f8fbff",
  "--bg-veil": "rgba(255, 255, 255, 0.99)",
  "--surface-primary": "rgba(255, 255, 255, 0.99)",
  "--surface-strong": "#ffffff",
  "--surface-muted": "rgba(248, 251, 255, 0.84)",
  "--line-soft": "rgba(15, 111, 255, 0.10)",
  "--line-strong": "rgba(15, 111, 255, 0.16)",
  "--text-primary": "#111827",
  "--text-secondary": "#334155",
  "--text-tertiary": "#64748b",
  "--text-muted": "#94a3b8",
  "--accent-blue": "#0f6fff",
  "--accent-teal": "#12b8d7",
  "--accent-amber": "#d97706",
  "--accent-rose": "#dc2626",
  "--accent-green": "#16a34a",
  "--shadow-soft": "0 8px 18px rgba(15, 23, 42, 0.032)",
  "--shadow-strong": "0 12px 28px rgba(15, 23, 42, 0.042)",
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
