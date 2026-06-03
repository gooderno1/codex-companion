const designTokenVariables = {
  "--bg-canvas": "#f6f9ff",
  "--bg-veil": "rgba(255, 255, 255, 0.88)",
  "--surface-primary": "rgba(255, 255, 255, 0.88)",
  "--surface-strong": "rgba(255, 255, 255, 0.96)",
  "--surface-muted": "rgba(248, 251, 255, 0.76)",
  "--line-soft": "rgba(37, 99, 235, 0.10)",
  "--line-strong": "rgba(37, 99, 235, 0.22)",
  "--text-primary": "#1f2937",
  "--text-secondary": "#475569",
  "--text-tertiary": "#94a3b8",
  "--accent-blue": "#2563eb",
  "--accent-teal": "#06b6d4",
  "--accent-amber": "#d97706",
  "--accent-rose": "#dc2626",
  "--accent-green": "#16a34a",
  "--shadow-soft": "0 16px 40px rgba(15, 23, 42, 0.08)",
  "--shadow-strong": "0 22px 56px rgba(15, 23, 42, 0.10)",
  "--radius-shell": "24px",
  "--radius-panel": "20px",
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
