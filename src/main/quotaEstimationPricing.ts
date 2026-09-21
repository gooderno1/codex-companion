import type { TokenBreakdown } from "../shared/contracts";
import type { EstimationCatalog } from "../shared/quotaEstimation";
import { PRICING_CATALOG_HISTORY, PRICING_CATALOG_VERSION, type PricingRate } from "./collectors/pricing";

interface Catalog {
  catalogVersion: string;
  verifiedAt?: string;
  effectiveFrom: string | null;
  effectiveTo?: string | null;
  effectiveTimeBasis: string;
  rates: Record<string, PricingRate>;
  aliases?: Record<string, string>;
  sources?: Array<{ url: string }>;
}
const catalogs: readonly Catalog[] = PRICING_CATALOG_HISTORY;
export const defaultEstimationCatalog = PRICING_CATALOG_VERSION;
export function estimationCatalog(version = defaultEstimationCatalog): Catalog {
  const result = catalogs.find(item => item.catalogVersion === version);
  if (!result) throw new Error("价格快照不存在，请重新选择。");
  return result;
}
export function estimationCatalogs(): EstimationCatalog[] {
  return catalogs.map(item => ({ version: item.catalogVersion, verifiedAt: item.verifiedAt ?? item.catalogVersion,
    historicalAvailable: item.effectiveTimeBasis === "official" && Boolean(item.effectiveFrom),
    sources: [...new Set(item.sources?.map(source => source.url) ?? [])],
    rates: Object.entries(item.rates).map(([model, rate]) => ({ model, input: rate.inputUsdPerMillion, cached: rate.cachedInputUsdPerMillion, output: rate.outputUsdPerMillion })) }));
}
/** 标准短上下文快照估值，不把核对日当作价格生效日。 */
export function priceEstimation(model: string, tokens: TokenBreakdown, at: string, version: string, mode: "snapshot" | "historical"): number | null {
  const catalog = mode === "snapshot" ? estimationCatalog(version) : [...catalogs].reverse().find(item =>
    item.effectiveTimeBasis === "official" && item.effectiveFrom && Date.parse(item.effectiveFrom) <= Date.parse(at) &&
    (!item.effectiveTo || Date.parse(at) < Date.parse(item.effectiveTo)));
  if (!catalog || Object.values(tokens).some(value => !Number.isFinite(value) || value < 0) || tokens.cachedInput > tokens.input || tokens.reasoningOutput > tokens.output) return null;
  const name = model.trim().toLowerCase().replace(/\s+/g, "-");
  const normalized = catalog.aliases && Object.hasOwn(catalog.aliases, name) ? catalog.aliases[name] : name;
  const base = normalized.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  const rate = Object.hasOwn(catalog.rates, normalized) ? catalog.rates[normalized] : Object.hasOwn(catalog.rates, base) ? catalog.rates[base] : null;
  return rate ? ((tokens.input - tokens.cachedInput) * rate.inputUsdPerMillion + tokens.cachedInput * rate.cachedInputUsdPerMillion + tokens.output * rate.outputUsdPerMillion) / 1_000_000 : null;
}
