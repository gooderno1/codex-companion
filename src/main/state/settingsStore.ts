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
      repoRoots:
        stored.repoRoots?.filter((item): item is string => Boolean(item)) ??
        fallback.repoRoots,
      billingMonthStartDay:
        typeof stored.billingMonthStartDay === "number"
          ? Math.max(1, Math.min(31, Math.trunc(stored.billingMonthStartDay)))
          : fallback.billingMonthStartDay,
      widget: {
        ...fallback.widget,
        ...stored.widget
      }
    };

    await writeJsonFile(this.settingsPath, merged);
    return merged;
  }

  public async update(
    updater: (current: AppPreferences) => AppPreferences
  ): Promise<AppPreferences> {
    const current = await this.read();
    const next = updater(current);
    await writeJsonFile(this.settingsPath, next);
    return next;
  }
}
