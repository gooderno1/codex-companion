import type { CodeActivity, TokenBreakdown } from "../../shared/contracts";

export function emptyTokens(): TokenBreakdown {
  return {
    input: 0,
    cachedInput: 0,
    output: 0,
    reasoningOutput: 0,
    total: 0
  };
}

export function sumTokens(
  left: TokenBreakdown,
  right: TokenBreakdown
): TokenBreakdown {
  return {
    input: left.input + right.input,
    cachedInput: left.cachedInput + right.cachedInput,
    output: left.output + right.output,
    reasoningOutput: left.reasoningOutput + right.reasoningOutput,
    total: left.total + right.total
  };
}

export function emptyCodeActivity(): CodeActivity {
  return {
    commits: 0,
    additions: 0,
    deletions: 0,
    changedLines: 0,
    net: 0
  };
}

export function sumCodeActivity(
  left: CodeActivity,
  right: CodeActivity
): CodeActivity {
  return {
    commits: left.commits + right.commits,
    additions: left.additions + right.additions,
    deletions: left.deletions + right.deletions,
    changedLines: left.changedLines + right.changedLines,
    net: left.net + right.net
  };
}

export function roundTo(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
