import type { TokenBreakdown } from "./contracts";

export interface QuotaEstimationRequest {
  startAt: string | null;
  endAt: string;
  catalogVersion?: string;
  priceMode?: "snapshot" | "historical";
  force?: boolean;
}
export interface EstimationSlice {
  key: string;
  tokens: TokenBreakdown;
  costUsd: number | null;
  unpricedTokens: number;
  unpricedEvents: number;
  events: number;
}
export interface EstimationMonth extends EstimationSlice {
  activeDays: number;
  partial: boolean;
  models: EstimationSlice[];
  days: EstimationSlice[];
}
export interface EstimationSample {
  startAt: string;
  endAt: string;
  fromPercent: number;
  toPercent: number;
  deltaPercent: number;
  costUsd: number;
  tokens: number;
  unpricedTokens: number;
  capacityUsd: number;
  alignmentLowUsd: number;
  alignmentHighUsd: number;
}
export interface EstimationWindow {
  id: string;
  resetsAt: string;
  startAt: string;
  endAt: string;
  plan: string | null;
  pool: "codex" | "legacy";
  capacityUsd: number | null;
  p10Usd: number | null;
  p90Usd: number | null;
  costUsd: number;
  deltaPercent: number;
  evidence: "insufficient" | "exploratory" | "moderate";
  changeDetected: boolean;
  boundary: string;
  samples: EstimationSample[];
  excluded: Record<string, number>;
}
export interface EstimationCatalog {
  version: string;
  verifiedAt: string;
  historicalAvailable: boolean;
  sources: string[];
  rates: Array<{ model: string; input: number; cached: number; output: number }>;
}
export interface QuotaEstimationResponse {
  generatedAt: string;
  range: { startAt: string | null; endAt: string };
  catalogVersion: string;
  priceMode: "snapshot" | "historical";
  catalogs: EstimationCatalog[];
  summary: EstimationSlice;
  months: EstimationMonth[];
  windows: EstimationWindow[];
  coverage: { firstEventAt: string | null; lastEventAt: string | null; files: number; observations: number };
  warnings: string[];
  exclusions: Record<string, number>;
  performance: { parsedFiles: number; reusedFiles: number; indexMs: number; queryMs: number };
}
