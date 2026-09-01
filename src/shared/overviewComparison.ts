export type OverviewComparisonDisplay = "percentage" | "absolute";
export type OverviewComparisonUnit = "token" | "line";

export interface OverviewComparisonDescription {
  text: string;
  fullText: string;
}

function signedPrefix(value: number): string {
  return value > 0 ? "+" : value < 0 ? "-" : "";
}

function compactMagnitude(value: number, forceOneDecimal = false): string {
  const magnitude = Math.abs(value);
  if (magnitude >= 100_000_000) {
    return `${(magnitude / 100_000_000).toFixed(
      forceOneDecimal ? 1 : magnitude >= 1_000_000_000 ? 0 : 1
    )}亿`;
  }

  if (magnitude >= 10_000) {
    return `${(magnitude / 10_000).toFixed(
      forceOneDecimal ? 1 : magnitude >= 100_000 ? 0 : 1
    )}万`;
  }

  return magnitude.toLocaleString("zh-CN", {
    maximumFractionDigits: 1
  });
}

function fullNumber(value: number, fractionDigits = 0): string {
  return Math.abs(value).toLocaleString("zh-CN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
}

function describePercentage(
  current: number,
  previous: number,
  compareLabel: string
): OverviewComparisonDescription {
  const denominator = previous === 0 ? 1 : Math.abs(previous);
  const delta = ((current - previous) / denominator) * 100;
  const prefix = signedPrefix(delta);
  const compact = Math.abs(delta) >= 10_000
    ? `${prefix}${compactMagnitude(delta, true)}%`
    : `${prefix}${fullNumber(delta, 1)}%`;
  const full = `${prefix}${fullNumber(delta, 1)}%`;

  return {
    text: `较${compareLabel} ${compact}`,
    fullText: `较${compareLabel} ${full}`
  };
}

function describeAbsolute(
  current: number,
  previous: number,
  compareLabel: string,
  unit: OverviewComparisonUnit
): OverviewComparisonDescription {
  const delta = current - previous;
  if (delta === 0) {
    const text = `较${compareLabel} 持平`;
    return { text, fullText: text };
  }

  const prefix = signedPrefix(delta);
  const unitLabel = unit === "token" ? "tok" : "行";
  return {
    text: `较${compareLabel} ${prefix}${compactMagnitude(delta)} ${unitLabel}`,
    fullText: `较${compareLabel} ${prefix}${fullNumber(delta)} ${unitLabel}`
  };
}

export function describeOverviewComparison(args: {
  current: number | null;
  previous: number | null;
  compareLabel: string;
  display: OverviewComparisonDisplay;
  unit: OverviewComparisonUnit;
}): OverviewComparisonDescription {
  if (args.current === null || args.previous === null) {
    return {
      text: "数据待补齐",
      fullText: "数据待补齐"
    };
  }

  return args.display === "absolute"
    ? describeAbsolute(args.current, args.previous, args.compareLabel, args.unit)
    : describePercentage(args.current, args.previous, args.compareLabel);
}
