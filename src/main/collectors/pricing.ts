import type { TokenBreakdown } from "../../shared/contracts";

export interface PricingRate {
  inputUsdPerMillion: number;
  cachedInputUsdPerMillion: number;
  outputUsdPerMillion: number;
  inputCreditsPerMillion: number | null;
  cachedInputCreditsPerMillion: number | null;
  outputCreditsPerMillion: number | null;
}

const RATE_TABLE: Record<string, PricingRate> = {
  "gpt-5.5": {
    inputUsdPerMillion: 5,
    cachedInputUsdPerMillion: 0.5,
    outputUsdPerMillion: 30,
    inputCreditsPerMillion: 125,
    cachedInputCreditsPerMillion: 12.5,
    outputCreditsPerMillion: 750
  },
  "gpt-5.4": {
    inputUsdPerMillion: 2.5,
    cachedInputUsdPerMillion: 0.25,
    outputUsdPerMillion: 15,
    inputCreditsPerMillion: 62.5,
    cachedInputCreditsPerMillion: 6.25,
    outputCreditsPerMillion: 375
  },
  "gpt-5.4-mini": {
    inputUsdPerMillion: 0.75,
    cachedInputUsdPerMillion: 0.075,
    outputUsdPerMillion: 4.5,
    inputCreditsPerMillion: 18.75,
    cachedInputCreditsPerMillion: 1.875,
    outputCreditsPerMillion: 113
  },
  "gpt-5.3-codex": {
    inputUsdPerMillion: 1.75,
    cachedInputUsdPerMillion: 0.175,
    outputUsdPerMillion: 14,
    inputCreditsPerMillion: 43.75,
    cachedInputCreditsPerMillion: 4.375,
    outputCreditsPerMillion: 350
  },
  "gpt-5.2": {
    inputUsdPerMillion: 1.75,
    cachedInputUsdPerMillion: 0.175,
    outputUsdPerMillion: 14,
    inputCreditsPerMillion: 43.75,
    cachedInputCreditsPerMillion: 4.375,
    outputCreditsPerMillion: 350
  },
  "gpt-5.2-codex": {
    inputUsdPerMillion: 1.75,
    cachedInputUsdPerMillion: 0.175,
    outputUsdPerMillion: 14,
    inputCreditsPerMillion: 43.75,
    cachedInputCreditsPerMillion: 4.375,
    outputCreditsPerMillion: 350
  },
  "gpt-5": {
    inputUsdPerMillion: 1.25,
    cachedInputUsdPerMillion: 0.125,
    outputUsdPerMillion: 10,
    inputCreditsPerMillion: null,
    cachedInputCreditsPerMillion: null,
    outputCreditsPerMillion: null
  },
  "gpt-5-codex": {
    inputUsdPerMillion: 1.25,
    cachedInputUsdPerMillion: 0.125,
    outputUsdPerMillion: 10,
    inputCreditsPerMillion: null,
    cachedInputCreditsPerMillion: null,
    outputCreditsPerMillion: null
  }
};

export const API_RATE_SOURCE =
  "OpenAI API Pricing（openai.com/api/pricing，核对日期 2026-06-02）";
export const CODEX_RATE_SOURCE =
  "OpenAI Codex rate card（help.openai.com/en/articles/20001106-codex-rate-card，核对日期 2026-06-02）";

function normalizeModel(model: string): string {
  return model.toLowerCase().replace(/\s+/g, "-");
}

export function resolvePricingRate(model: string): PricingRate | null {
  const normalized = normalizeModel(model);
  if (normalized in RATE_TABLE) {
    return RATE_TABLE[normalized];
  }

  if (normalized.startsWith("gpt-5.4")) {
    return RATE_TABLE["gpt-5.4"];
  }

  if (normalized.startsWith("gpt-5.5")) {
    return RATE_TABLE["gpt-5.5"];
  }

  if (normalized.startsWith("gpt-5.3-codex")) {
    return RATE_TABLE["gpt-5.3-codex"];
  }

  if (normalized.startsWith("gpt-5.2")) {
    return RATE_TABLE["gpt-5.2"];
  }

  if (normalized.startsWith("gpt-5")) {
    return RATE_TABLE["gpt-5"];
  }

  return null;
}

export function estimateApiCostUsd(
  model: string,
  tokens: TokenBreakdown
): number {
  const rate = resolvePricingRate(model);
  if (!rate) {
    return 0;
  }

  return (
    (tokens.input / 1_000_000) * rate.inputUsdPerMillion +
    (tokens.cachedInput / 1_000_000) * rate.cachedInputUsdPerMillion +
    (tokens.output / 1_000_000) * rate.outputUsdPerMillion
  );
}

export function estimateCodexCredits(
  model: string,
  tokens: TokenBreakdown
): number {
  const rate = resolvePricingRate(model);
  if (
    !rate ||
    rate.inputCreditsPerMillion === null ||
    rate.cachedInputCreditsPerMillion === null ||
    rate.outputCreditsPerMillion === null
  ) {
    return 0;
  }

  return (
    (tokens.input / 1_000_000) * rate.inputCreditsPerMillion +
    (tokens.cachedInput / 1_000_000) * rate.cachedInputCreditsPerMillion +
    (tokens.output / 1_000_000) * rate.outputCreditsPerMillion
  );
}
