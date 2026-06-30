import os from "node:os";
import path from "node:path";

import type { AppPreferences, WidgetPreferences } from "../../shared/contracts";
import { pathExists, readJsonFile, writeJsonFile } from "../utils/fs";

const SETTINGS_FILE_NAME = "settings.json";
const DEFAULT_BILLING_MONTH_START_DAY = 1;

function defaultWidgetPreferences(): WidgetPreferences {
  return {
    preset: "signal-bar",
    locked: false,
    clickThrough: false,
    opacity: 0.94,
    privacyMode: false,
    visible: false,
    bounds: null
  };
}

async function resolveDefaultRepoRoots(): Promise<string[]> {
  const home = os.homedir();
  const envRoots = process.env.CODEX_COMPANION_REPO_ROOTS
    ?.split(";")
    .map((item) => item.trim())
    .filter(Boolean);

  const candidates = [
    ...(envRoots ?? []),
    path.join(home, "Documents", "Codex"),
    path.join(home, "Documents", "Projects"),
    path.join(home, "source"),
    path.join(home, "projects"),
    path.join(home, "code"),
    path.join(home, "Code")
  ];

  const resolved: string[] = [];

  for (const candidate of candidates) {
    if (!resolved.includes(candidate) && (await pathExists(candidate))) {
      resolved.push(candidate);
    }
  }

  return resolved;
}

function normalizeRepoRoots(
  repoRoots: unknown,
  fallback: string[]
): string[] {
  if (!Array.isArray(repoRoots)) {
    return fallback;
  }

  const resolved: string[] = [];
  for (const item of repoRoots) {
    if (typeof item !== "string") {
      continue;
    }

    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = path.resolve(trimmed);
    if (!resolved.includes(normalized)) {
      resolved.push(normalized);
    }
  }

  return resolved.length > 0 ? resolved : fallback;
}

function normalizeBillingMonthStartDay(value: unknown, fallback: number) {
  return typeof value === "number"
    ? Math.max(1, Math.min(31, Math.trunc(value)))
    : fallback;
}

function normalizeWidgetPreferences(
  value: unknown,
  fallback: WidgetPreferences
): WidgetPreferences {
  return {
    ...fallback,
    ...(value && typeof value === "object" ? value : {})
  };
}

export class SettingsStore {
  private readonly settingsPath: string;

  public constructor(private readonly userDataPath: string) {
    this.settingsPath = path.join(userDataPath, SETTINGS_FILE_NAME);
  }

  public async read(): Promise<AppPreferences> {
    const fallback: AppPreferences = {
      repoRoots: await resolveDefaultRepoRoots(),
      billingMonthStartDay: DEFAULT_BILLING_MONTH_START_DAY,
      widget: defaultWidgetPreferences()
    };

    const stored = await readJsonFile<Partial<AppPreferences>>(this.settingsPath);
    if (!stored) {
      await writeJsonFile(this.settingsPath, fallback);
      return fallback;
    }

    const merged: AppPreferences = {
      repoRoots: normalizeRepoRoots(stored.repoRoots, fallback.repoRoots),
      billingMonthStartDay: normalizeBillingMonthStartDay(
        stored.billingMonthStartDay,
        fallback.billingMonthStartDay
      ),
      widget: normalizeWidgetPreferences(stored.widget, fallback.widget)
    };

    await writeJsonFile(this.settingsPath, merged);
    return merged;
  }

  public async update(
    updater: (current: AppPreferences) => AppPreferences
  ): Promise<AppPreferences> {
    const current = await this.read();
    const defaults: AppPreferences = {
      repoRoots: await resolveDefaultRepoRoots(),
      billingMonthStartDay: DEFAULT_BILLING_MONTH_START_DAY,
      widget: defaultWidgetPreferences()
    };
    const next = updater(current);
    const normalized: AppPreferences = {
      repoRoots: normalizeRepoRoots(next.repoRoots, defaults.repoRoots),
      billingMonthStartDay: normalizeBillingMonthStartDay(
        next.billingMonthStartDay,
        current.billingMonthStartDay
      ),
      widget: normalizeWidgetPreferences(next.widget, current.widget)
    };
    await writeJsonFile(this.settingsPath, normalized);
    return normalized;
  }
}
