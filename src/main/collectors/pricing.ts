import type { TokenBreakdown } from "../../shared/contracts";
import catalog from "./pricing-catalogs/2026-09-19.json";
import previousCatalog from "./pricing-catalogs/2026-09-17.json";

export interface PricingRate {
  inputUsdPerMillion: number;
  cachedInputUsdPerMillion: number;
  outputUsdPerMillion: number;
  inputCreditsPerMillion: number | null;
  cachedInputCreditsPerMillion: number | null;
  outputCreditsPerMillion: number | null;
}

const RATE_TABLE: Record<string, PricingRate> = catalog.rates;
const ALIASES: Record<string, string> = catalog.aliases;
export const PRICING_CATALOG_VERSION = catalog.catalogVersion;
// 随应用保留旧快照供审计；当前界面仅按当前快照重估。
export const PRICING_CATALOG_HISTORY = [previousCatalog, catalog] as const;

export const API_RATE_SOURCE =
  "OpenAI API 标准短上下文价快照重估（developers.openai.com/api/docs/pricing；2026-09-19；不含缓存写入、长上下文、服务档位与地区调整；非历史账单）";
export const CODEX_RATE_SOURCE =
  "OpenAI Codex 标准 credits 快照重估（learn.chatgpt.com/docs/pricing；2026-09-19；旧模型保留 2026-06-02 rate card；非套餐实付）";

function normalizeModel(model: string): string {
  return model.trim().toLowerCase().replace(/\s+/g, "-");
}

export function resolvePricingRate(model: string): PricingRate | null {
  const name = normalizeModel(model);
  const normalized = Object.hasOwn(ALIASES, name) ? ALIASES[name] : name;
  if (Object.hasOwn(RATE_TABLE, normalized)) {
    return RATE_TABLE[normalized];
  }

  // 只接受已知模型的日期快照，避免新型号、mini 或 pro 被套用到其他模型。
  const baseModel = normalized.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  return Object.hasOwn(RATE_TABLE, baseModel) ? RATE_TABLE[baseModel] : null;
}

export function estimateApiCostUsd(
  model: string,
  tokens: TokenBreakdown
): number | null {
  const rate = resolvePricingRate(model);
  if (!rate) {
    return null;
  }

  return (
    (Math.max(0, tokens.input - tokens.cachedInput) / 1_000_000) * rate.inputUsdPerMillion +
    (tokens.cachedInput / 1_000_000) * rate.cachedInputUsdPerMillion +
    (tokens.output / 1_000_000) * rate.outputUsdPerMillion
  );
}

export function estimateCodexCredits(
  model: string,
  tokens: TokenBreakdown
): number | null {
  const rate = resolvePricingRate(model);
  if (
    !rate ||
    rate.inputCreditsPerMillion === null ||
    rate.cachedInputCreditsPerMillion === null ||
    rate.outputCreditsPerMillion === null
  ) {
    return null;
  }

  return (
    (Math.max(0, tokens.input - tokens.cachedInput) / 1_000_000) * rate.inputCreditsPerMillion +
    (tokens.cachedInput / 1_000_000) * rate.cachedInputCreditsPerMillion +
    (tokens.output / 1_000_000) * rate.outputCreditsPerMillion
  );
}
