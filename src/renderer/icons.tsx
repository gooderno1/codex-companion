export type IconName =
  | "overview"
  | "ledger"
  | "repo"
  | "settings"
  | "refresh"
  | "status"
  | "clock"
  | "token"
  | "calendar"
  | "month"
  | "code"
  | "cost"
  | "session"
  | "bell"
  | "maximize"
  | "close";

export function Glyph({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  switch (name) {
    case "overview":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4 11.5 12 5l8 6.5" />
          <path {...common} d="M6.5 10.5V20h11v-9.5" />
          <path {...common} d="M10 20v-5h4v5" />
        </svg>
      );
    case "ledger":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M6 4.5h10.5A2.5 2.5 0 0 1 19 7v12.5H7.5A2.5 2.5 0 0 1 5 17V6.5a2 2 0 0 1 2-2Z" />
          <path {...common} d="M8.5 8.5h6M8.5 12h6M8.5 15.5h4" />
          <path {...common} d="M16 4.5v5l-1.8-1.1-1.8 1.1v-5" />
        </svg>
      );
    case "repo":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect {...common} x="4.5" y="5" width="15" height="14" rx="3" />
          <path {...common} d="m10 9-3 3 3 3M14 9l3 3-3 3" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            {...common}
            d="M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M3 12h3M18 12h3M4.9 19.1 7 17M17 7l2.1-2.1"
          />
          <circle {...common} cx="12" cy="12" r="3.5" />
        </svg>
      );
    case "refresh":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M20 12a8 8 0 1 1-2.3-5.7" />
          <path {...common} d="M20 4v6h-6" />
        </svg>
      );
    case "status":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
          <path {...common} d="M12 8v4l3 2" />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle {...common} cx="12" cy="12" r="8" />
          <path {...common} d="M12 8v5l3 2" />
        </svg>
      );
    case "token":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <ellipse {...common} cx="12" cy="6.5" rx="6" ry="2.7" />
          <path {...common} d="M6 6.5v9c0 1.5 2.7 2.7 6 2.7s6-1.2 6-2.7v-9" />
          <path {...common} d="M6 10.8c0 1.5 2.7 2.7 6 2.7s6-1.2 6-2.7M6 15c0 1.5 2.7 2.7 6 2.7s6-1.2 6-2.7" />
        </svg>
      );
    case "calendar":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M5 5h14v15H5zM8 3v4M16 3v4M5 9h14" />
          <path {...common} d="M8.5 13h2M13.5 13h2M8.5 16.5h2M13.5 16.5h2" />
        </svg>
      );
    case "month":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M5 5h14v15H5zM8 3v4M16 3v4M5 9h14" />
          <path {...common} d="M9 13h6M9 17h4" />
        </svg>
      );
    case "code":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" />
        </svg>
      );
    case "cost":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M5 8h14v11H5zM8 8V6.5A2.5 2.5 0 0 1 10.5 4h3A2.5 2.5 0 0 1 16 6.5V8" />
          <path {...common} d="M9 13h6M12 10v6" />
        </svg>
      );
    case "session":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M5 6h14v10H8l-3 3z" />
          <path {...common} d="M9 10h6M9 13h4" />
        </svg>
      );
    case "bell":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M7 10a5 5 0 0 1 10 0c0 4 1.5 5.5 2.5 6.5h-15C5.5 15.5 7 14 7 10Z" />
          <path {...common} d="M10 19a2.2 2.2 0 0 0 4 0" />
          <path {...common} d="M12 4V3" />
        </svg>
      );
    case "maximize":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4" />
          <path {...common} d="M9 4 4 9M15 4l5 5M20 15l-5 5M4 15l5 5" />
        </svg>
      );
    case "close":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M6 6l12 12M18 6 6 18" />
        </svg>
      );
    default:
      return null;
  }
}

export function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <defs>
          <linearGradient id="brandMarkGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent-blue)" />
            <stop offset="100%" stopColor="var(--accent-teal)" />
          </linearGradient>
        </defs>
        <path
          d="M43 8 55 15v11"
          fill="none"
          stroke="url(#brandMarkGradient)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M43 56H22L8 48V16l14-8h21"
          fill="none"
          stroke="var(--accent-blue)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M39 22 31 18 22 23v18l9 5 8-4"
          fill="none"
          stroke="var(--accent-teal)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="55" cy="28" r="4.5" fill="#ffffff" stroke="var(--accent-teal)" strokeWidth="3" />
        <circle cx="44" cy="8" r="4" fill="#ffffff" stroke="var(--accent-blue)" strokeWidth="3" />
        <circle cx="44" cy="56" r="4" fill="#ffffff" stroke="var(--accent-blue)" strokeWidth="3" />
        <circle cx="31" cy="32" r="3.5" fill="var(--text-primary)" />
      </svg>
    </div>
  );
}
