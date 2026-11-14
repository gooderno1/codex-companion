export interface HistoricalRate {
  inputUsdPerMillion: number | null;
  cachedInputUsdPerMillion: number | null;
  outputUsdPerMillion: number | null;
  inputCreditsPerMillion: number | null;
  cachedInputCreditsPerMillion: number | null;
  outputCreditsPerMillion: number | null;
}

export type RuleValue = string | number | boolean | null | undefined | RuleValue[] | { [key: string]: RuleValue };

export interface PricingHistorySnapshot {
  date: string;
  rates: Record<string, HistoricalRate>;
  rules: Record<string, Record<string, RuleValue>>;
  aliases: Record<string, string>;
  pending: ({ modelId: string } & Record<string, RuleValue>)[];
  billingRules: Record<string, RuleValue>;
}

export interface RuleChange {
  key: string;
  before?: RuleValue;
  after?: RuleValue;
}

function changes(before: Record<string, RuleValue>, after: Record<string, RuleValue>): RuleChange[] {
  const result: RuleChange[] = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      result.push({ key, before: before[key], after: after[key] });
    }
  }
  return result;
}

export function modelHistory(snapshots: PricingHistorySnapshot[], model: string) {
  const prices: { date: string; rate?: HistoricalRate; retained: boolean }[] = [];
  const rules: { date: string; changes: RuleChange[] }[] = [];
  let previousRate: HistoricalRate | undefined;
  let previousRetained = false;
  let previousRules: Record<string, RuleValue> = {};
  for (const snapshot of snapshots) {
    const aliases = Object.keys(snapshot.aliases).filter(key => snapshot.aliases[key] === model);
    const current = { ...snapshot.rules[model] };
    const pending = snapshot.pending.filter(item => item.modelId === model);
    if (aliases.length) current.aliases = aliases;
    if (pending.length) current.pending = pending;
    for (const key of ["retainedCreditRates", "retainedAliases"]) {
      const ids = key === "retainedCreditRates" ? [model] : aliases;
      const entries = snapshot.billingRules[key];
      if (Array.isArray(entries)) {
        const matches = entries.filter(item => item && typeof item === "object" && "modelId" in item && ids.includes(String(item.modelId)));
        if (matches.length) current[key] = matches;
      }
    }
    const diff = changes(previousRules, current);
    if (diff.length) rules.push({ date: snapshot.date, changes: diff });
    const rate = snapshot.rates[model];
    const retained = Boolean(current.retainedCreditRates);
    if (JSON.stringify(previousRate) !== JSON.stringify(rate) || retained !== previousRetained) {
      prices.push({ date: snapshot.date, rate, retained });
    }
    previousRules = current;
    previousRate = rate;
    previousRetained = retained;
  }
  return { prices: prices.reverse(), rules: rules.reverse() };
}

export function commonRuleHistory(snapshots: PricingHistorySnapshot[]) {
  const history: { date: string; changes: RuleChange[] }[] = [];
  let previous = {};
  for (const snapshot of snapshots) {
    const common = Object.fromEntries(Object.entries(snapshot.billingRules)
      .filter(([key]) => key !== "retainedCreditRates" && key !== "retainedAliases"));
    const diff = changes(previous, common);
    if (diff.length) history.push({ date: snapshot.date, changes: diff });
    previous = common;
  }
  return history.reverse();
}
