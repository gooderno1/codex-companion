import os from "node:os";
import path from "node:path";

import type {
  AppPreferences,
  NotificationDeliveryMode,
  NotificationPreferences,
  UpdatePreferences,
  WidgetPreferences
} from "../../shared/contracts";
import { pathExists, readJsonFile, writeJsonFile } from "../utils/fs";

const SETTINGS_FILE_NAME = "settings.json";
const DEFAULT_BILLING_MONTH_START_DAY = 1;

function resolveDefaultCodexHome(): string {
  return path.resolve(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"));
}

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

function normalizeDirectoryPath(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return path.resolve(value.trim());
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

function normalizeNotificationDeliveryMode(
  value: unknown,
  fallback: NotificationDeliveryMode
): NotificationDeliveryMode {
  return value === "balanced" ||
    value === "important" ||
    value === "quiet" ||
    value === "off"
    ? value
    : fallback;
}

function normalizeNotificationPreferences(
  value: unknown,
  fallback: NotificationPreferences
): NotificationPreferences {
  const record = value && typeof value === "object" ? value : {};
  const deliveryMode =
    "deliveryMode" in record
      ? (record as { deliveryMode?: unknown }).deliveryMode
      : undefined;

  return {
    deliveryMode: normalizeNotificationDeliveryMode(
      deliveryMode,
      fallback.deliveryMode
    )
  };
}

function defaultNotificationPreferences(): NotificationPreferences {
  return {
    deliveryMode: "balanced"
  };
}

function defaultUpdatePreferences(): UpdatePreferences {
  return {
    autoCheck: true,
    autoDownload: true,
    ignoredVersion: null,
    installOnQuit: false
  };
}

function normalizeUpdatePreferences(
  value: unknown,
  fallback: UpdatePreferences
): UpdatePreferences {
  const record = value && typeof value === "object"
    ? value as Partial<Record<keyof UpdatePreferences, unknown>>
    : {};
  const ignoredVersion = typeof record.ignoredVersion === "string" && record.ignoredVersion.trim()
    ? record.ignoredVersion.trim()
    : null;

  return {
    autoCheck: typeof record.autoCheck === "boolean" ? record.autoCheck : fallback.autoCheck,
    autoDownload:
      typeof record.autoDownload === "boolean"
        ? record.autoDownload
        : fallback.autoDownload,
    ignoredVersion,
    installOnQuit:
      typeof record.installOnQuit === "boolean"
        ? record.installOnQuit
        : fallback.installOnQuit
  };
}

export class SettingsStore {
  private readonly settingsPath: string;

  public constructor(private readonly userDataPath: string) {
    this.settingsPath = path.join(userDataPath, SETTINGS_FILE_NAME);
  }

  public async read(): Promise<AppPreferences> {
    const fallback: AppPreferences = {
      codexHome: resolveDefaultCodexHome(),
      repoRoots: await resolveDefaultRepoRoots(),
      billingMonthStartDay: DEFAULT_BILLING_MONTH_START_DAY,
      widget: defaultWidgetPreferences(),
      notifications: defaultNotificationPreferences(),
      updates: defaultUpdatePreferences()
    };

    const stored = await readJsonFile<Partial<AppPreferences>>(this.settingsPath);
    if (!stored) {
      await writeJsonFile(this.settingsPath, fallback);
      return fallback;
    }

    const merged: AppPreferences = {
      codexHome: normalizeDirectoryPath(stored.codexHome, fallback.codexHome),
      repoRoots: normalizeRepoRoots(stored.repoRoots, fallback.repoRoots),
      billingMonthStartDay: normalizeBillingMonthStartDay(
        stored.billingMonthStartDay,
        fallback.billingMonthStartDay
      ),
      widget: normalizeWidgetPreferences(stored.widget, fallback.widget),
      notifications: normalizeNotificationPreferences(
        stored.notifications,
        fallback.notifications
      ),
      updates: normalizeUpdatePreferences(stored.updates, fallback.updates)
    };

    await writeJsonFile(this.settingsPath, merged);
    return merged;
  }

  public async update(
    updater: (current: AppPreferences) => AppPreferences
  ): Promise<AppPreferences> {
    const current = await this.read();
    const defaults: AppPreferences = {
      codexHome: resolveDefaultCodexHome(),
      repoRoots: await resolveDefaultRepoRoots(),
      billingMonthStartDay: DEFAULT_BILLING_MONTH_START_DAY,
      widget: defaultWidgetPreferences(),
      notifications: defaultNotificationPreferences(),
      updates: defaultUpdatePreferences()
    };
    const next = updater(current);
    const normalized: AppPreferences = {
      codexHome: normalizeDirectoryPath(next.codexHome, defaults.codexHome),
      repoRoots: normalizeRepoRoots(next.repoRoots, defaults.repoRoots),
      billingMonthStartDay: normalizeBillingMonthStartDay(
        next.billingMonthStartDay,
        current.billingMonthStartDay
      ),
      widget: normalizeWidgetPreferences(next.widget, current.widget),
      notifications: normalizeNotificationPreferences(
        next.notifications,
        current.notifications
      ),
      updates: normalizeUpdatePreferences(next.updates, current.updates)
    };
    await writeJsonFile(this.settingsPath, normalized);
    return normalized;
  }
}
