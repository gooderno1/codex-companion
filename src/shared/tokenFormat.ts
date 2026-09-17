/** 与总览相同的自动单位：整数 / 万 / 亿；只格式化，不改变底层统计。 */
export function formatCompactToken(value: number | null): string {
  if (value === null) return "未观测";
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(value >= 1_000_000_000 ? 0 : 1)} 亿`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(value >= 100_000 ? 0 : 1)} 万`;
  return Math.round(value).toLocaleString("zh-CN");
}

export function exactTokenLabel(value: number): string {
  return `${value.toLocaleString("zh-CN", { maximumFractionDigits: 0 })} Token`;
}
