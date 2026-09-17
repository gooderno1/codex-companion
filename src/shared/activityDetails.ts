import type { CodeActivity, TokenBreakdown } from "./contracts";

export interface ActivityDetailsRequest {
  startAt: string | null;
  endAt: string;
  force?: boolean;
}
export interface ActivitySlice {
  key: string;
  tokens: TokenBreakdown;
  apiCostUsd: number;
  events: number;
  priced: boolean;
}
export interface ActivityTotals {
  tokens: TokenBreakdown;
  apiCostUsd: number;
  events: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
  models: ActivitySlice[];
  days: ActivitySlice[];
}
export interface ActivitySession extends ActivityTotals {
  name: string | null;
  sessionId: string;
  projectId: string;
  cwd: string | null;
  startedAt: string | null;
}
export interface ActivityProject extends ActivityTotals {
  id: string;
  name: string;
  path: string | null;
  rootPaths: string[];
  sessions: number;
  code: CodeActivity | null;
}
export interface ActivityDetailsResponse {
  generatedAt: string;
  range: { startAt: string | null; endAt: string };
  coverage: { firstEventAt: string | null; lastEventAt: string | null; files: number };
  warnings?: string[];
  performance?: { parsedFiles: number; reusedFiles: number; indexMs: number; queryMs: number };
  projects: ActivityProject[];
  sessions: ActivitySession[];
}

export const UNATTRIBUTED_PROJECT = "__unattributed__";

export interface ActivityCodeResponse { repositories: Array<{ path: string; code: CodeActivity | null }> }
