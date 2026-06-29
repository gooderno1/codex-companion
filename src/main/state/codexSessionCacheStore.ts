import path from "node:path";

import type { CodexSessionCache } from "../collectors/codexCollector";
import { readJsonFile, writeJsonFile } from "../utils/fs";

const CODEX_SESSION_CACHE_FILE_NAME = "codex-session-cache.json";

export class CodexSessionCacheStore {
  private readonly cachePath: string;

  public constructor(userDataPath: string) {
    this.cachePath = path.join(userDataPath, CODEX_SESSION_CACHE_FILE_NAME);
  }

  public read(): Promise<CodexSessionCache | null> {
    return readJsonFile<CodexSessionCache>(this.cachePath);
  }

  public write(cache: CodexSessionCache): Promise<void> {
    return writeJsonFile(this.cachePath, cache);
  }
}
