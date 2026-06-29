import { readdir } from "node:fs/promises";
import path from "node:path";

import type { RepoMetric } from "../../shared/contracts";
import { findGitRoot, runGit } from "../utils/git";
import { emptyCodeActivity, emptyTokens, roundTo, sumTokens } from "./metrics";
import type { CodexSessionSummary } from "./codexCollector";

interface CollectGitDataArgs {
  repoRoots: string[];
  sessions: CodexSessionSummary[];
  activityWindows?: Array<{
    key: "fiveHour" | "weekLimit" | "billingMonth";
    start: Date;
    end: Date;
  }>;
  now?: Date;
}

export interface CollectedGitData {
  roots: string[];
  items: RepoMetric[];
  sessionRepoMap: Map<string, string>;
}

const IGNORED_DIRECTORIES = new Set<string>([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  "coverage",
  ".venv",
  "venv"
]);

function repoIdFor(repoPath: string): string {
  return path.resolve(repoPath).toLowerCase();
}

function deriveRemoteFullName(remoteUrl: string | null) {
  if (!remoteUrl) {
    return null;
  }

  const normalized = remoteUrl.trim().replace(/\.git$/i, "");
  const sshMatch = normalized.match(/^[^@]+@[^:]+:(.+)$/);

  if (sshMatch?.[1]) {
    return sshMatch[1].replace(/^\/+/, "");
  }

  try {
    const parsed = new URL(normalized);
    return parsed.pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
}

function parseNumstat(output: string | null) {
  let additions = 0;
  let deletions = 0;

  if (!output) {
    return { additions, deletions };
  }

  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    const [added, removed] = line.split("\t");
    if (!added || !removed || added === "-" || removed === "-") {
      continue;
    }

    additions += Number(added);
    deletions += Number(removed);
  }

  return { additions, deletions };
}

async function collectCodeActivitySince(repoPath: string, since: Date) {
  return collectCodeActivityRange(repoPath, since);
}

async function collectCodeActivityRange(
  repoPath: string,
  since: Date,
  until?: Date
) {
  const commitArgs = ["rev-list", "--count", `--since=${since.toISOString()}`];
  const logArgs = ["log", `--since=${since.toISOString()}`];

  if (until) {
    commitArgs.push(`--until=${until.toISOString()}`);
    logArgs.push(`--until=${until.toISOString()}`);
  }

  commitArgs.push("HEAD");
  logArgs.push("--numstat", "--format=tformat:");

  const [commitCountOutput, numstatOutput] = await Promise.all([
    runGit(commitArgs, repoPath),
    runGit(logArgs, repoPath)
  ]);

  const { additions, deletions } = parseNumstat(numstatOutput);
  return {
    commits: Number(commitCountOutput ?? 0),
    additions,
    deletions,
    changedLines: additions + deletions,
    net: additions - deletions
  };
}

async function collectWorkingTreeActivity(repoPath: string) {
  const output = await runGit(["diff", "--numstat", "HEAD"], repoPath);
  const { additions, deletions } = parseNumstat(output);
  return {
    commits: 0,
    additions,
    deletions,
    changedLines: additions + deletions,
    net: additions - deletions
  };
}

async function collectRecentCommits(repoPath: string) {
  const output = await runGit(
    [
      "log",
      "-n",
      "5",
      "--date=iso-strict",
      "--pretty=format:%H%x09%ad%x09%an%x09%s"
    ],
    repoPath
  );

  if (!output) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [hash, authoredAt, author, summary] = line.split("\t");
      return {
        hash,
        authoredAt,
        author,
        summary
      };
    });
}

function collectFileFootprint() {
  return [];
}

async function discoverReposUnderRoot(
  rootPath: string,
  maxDepth = 3
): Promise<string[]> {
  const discovered = new Set<string>();
  const stack: Array<{ directory: string; depth: number }> = [
    { directory: rootPath, depth: 0 }
  ];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    let entries;
    try {
      entries = await readdir(current.directory, { withFileTypes: true });
    } catch {
      continue;
    }

    const hasGitDirectory = entries.some(
      (entry) => entry.isDirectory() && entry.name === ".git"
    );
    if (hasGitDirectory) {
      discovered.add(current.directory);
      continue;
    }

    if (current.depth >= maxDepth) {
      continue;
    }

    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        !IGNORED_DIRECTORIES.has(entry.name.toLowerCase())
      ) {
        stack.push({
          directory: path.join(current.directory, entry.name),
          depth: current.depth + 1
        });
      }
    }
  }

  return [...discovered];
}

export async function collectGitData({
  repoRoots,
  sessions,
  activityWindows = [],
  now = new Date()
}: CollectGitDataArgs): Promise<CollectedGitData> {
  const sessionRepoMap = new Map<string, string>();
  const resolvedRepoPaths = new Set<string>();

  for (const session of sessions) {
    if (!session.cwd) {
      continue;
    }

    const repoPath = await findGitRoot(session.cwd);
    if (!repoPath) {
      continue;
    }

    const repoId = repoIdFor(repoPath);
    sessionRepoMap.set(session.sessionId, repoId);
    resolvedRepoPaths.add(repoPath);
  }

  const effectiveRoots = [...new Set(repoRoots.map((item) => path.resolve(item)))];
  const scannedRepoGroups = await Promise.all(
    effectiveRoots.map((rootPath) => discoverReposUnderRoot(rootPath))
  );

  for (const repoGroup of scannedRepoGroups) {
    for (const repoPath of repoGroup) {
      resolvedRepoPaths.add(repoPath);
    }
  }

  const repoItems: RepoMetric[] = [];
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfSevenDays = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const startOfNaturalWeek = new Date(startOfToday);
  const weekday = startOfNaturalWeek.getDay();
  startOfNaturalWeek.setDate(
    startOfNaturalWeek.getDate() + (weekday === 0 ? -6 : 1 - weekday)
  );
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  for (const repoPath of [...resolvedRepoPaths].sort()) {
    const repoId = repoIdFor(repoPath);
    const attributedSessions = sessions.filter(
      (session) => sessionRepoMap.get(session.sessionId) === repoId
    );
    const tokenTotal = attributedSessions.reduce(
      (total, session) => sumTokens(total, session.tokens),
      emptyTokens()
    );
    const apiCostUsd = roundTo(
      attributedSessions.reduce((sum, session) => sum + session.apiCostUsd, 0),
      6
    );
    const creditsEstimate = roundTo(
      attributedSessions.reduce((sum, session) => sum + session.creditsEstimate, 0),
      6
    );
    const lastCodexAt = attributedSessions.reduce<string | null>(
      (latest, session) =>
        !latest || (session.lastEventAt && session.lastEventAt > latest)
          ? session.lastEventAt
          : latest,
      null
    );

    const customActivityPromises = activityWindows.map((windowRange) =>
      collectCodeActivityRange(repoPath, windowRange.start, windowRange.end)
    );

    const [remoteUrl, defaultBranchOutput, currentBranch, today, yesterday, sevenDays, naturalWeek, month, workingTree, recentCommits, fileFootprint, ...customActivities] =
      await Promise.all([
        runGit(["remote", "get-url", "origin"], repoPath),
        runGit(
          ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"],
          repoPath
        ),
        runGit(["branch", "--show-current"], repoPath),
        collectCodeActivitySince(repoPath, startOfToday),
        collectCodeActivityRange(repoPath, startOfYesterday, startOfToday),
        collectCodeActivitySince(repoPath, startOfSevenDays),
        collectCodeActivitySince(repoPath, startOfNaturalWeek),
        collectCodeActivitySince(repoPath, startOfMonth),
        collectWorkingTreeActivity(repoPath),
        collectRecentCommits(repoPath),
        collectFileFootprint(),
        ...customActivityPromises
      ]);

    const customActivityMap = new Map<
      "fiveHour" | "weekLimit" | "billingMonth",
      ReturnType<typeof emptyCodeActivity>
    >();
    activityWindows.forEach((windowRange, index) => {
      customActivityMap.set(
        windowRange.key,
        customActivities[index] ?? emptyCodeActivity()
      );
    });

    repoItems.push({
      id: repoId,
      name: path.basename(repoPath),
      path: repoPath,
      fullName: deriveRemoteFullName(remoteUrl),
      remoteUrl,
      defaultBranch:
        defaultBranchOutput?.split("/").pop() ?? currentBranch ?? null,
      lastSyncedAt: now.toISOString(),
      activity: {
        today: today ?? emptyCodeActivity(),
        yesterday: yesterday ?? emptyCodeActivity(),
        sevenDays: sevenDays ?? emptyCodeActivity(),
        naturalWeek: naturalWeek ?? emptyCodeActivity(),
        month: month ?? emptyCodeActivity(),
        workingTree: workingTree ?? emptyCodeActivity(),
        fiveHour: customActivityMap.get("fiveHour") ?? emptyCodeActivity(),
        weekLimit: customActivityMap.get("weekLimit") ?? emptyCodeActivity(),
        billingMonth: customActivityMap.get("billingMonth") ?? emptyCodeActivity()
      },
      tokens: tokenTotal,
      apiCostUsd,
      creditsEstimate,
      sessionCount: attributedSessions.length,
      lastCodexAt,
      recentCommits,
      fileFootprint
    });
  }

  return {
    roots: effectiveRoots,
    items: repoItems,
    sessionRepoMap
  };
}
