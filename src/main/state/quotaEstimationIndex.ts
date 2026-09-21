import { createHash } from "node:crypto";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseSessionFile, type CodexTokenEvent, type QuotaObservation } from "../collectors/codexCollector";

// 原始数据格式版本；价格目录改变不升级此版本。解析契约改变时需明确迁移。
const RAW_INDEX_VERSION = 1;
export type EstimationEvent = Pick<CodexTokenEvent, "sessionId" | "timestamp" | "model" | "tokens">;
async function discover(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return (await Promise.all(entries.map(entry => entry.isDirectory() ? discover(path.join(root, entry.name)) : Promise.resolve(entry.isFile() && entry.name.endsWith(".jsonl") ? [path.join(root, entry.name)] : [])))).flat();
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}
export class QuotaEstimationIndex {
  private db: DatabaseSync | null = null;
  constructor(private directory: string, readonly codexHome: string) {}
  private async open() {
    if (this.db) return this.db;
    await mkdir(this.directory, { recursive: true });
    const key = createHash("sha256").update(path.resolve(this.codexHome)).digest("hex").slice(0, 16);
    const db = new DatabaseSync(path.join(this.directory, `quota-estimation-${key}.sqlite`));
    db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;");
    if (Number(db.prepare("PRAGMA user_version").get()?.user_version) !== RAW_INDEX_VERSION) db.exec("DROP TABLE IF EXISTS usage; DROP TABLE IF EXISTS observations; DROP TABLE IF EXISTS files;");
    db.exec(`CREATE TABLE IF NOT EXISTS files (path TEXT PRIMARY KEY, size INTEGER NOT NULL, mtime REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS usage (file TEXT NOT NULL, seq INTEGER NOT NULL, at INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(file, seq));
      CREATE TABLE IF NOT EXISTS observations (file TEXT NOT NULL, seq INTEGER NOT NULL, at INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(file, seq));
      CREATE INDEX IF NOT EXISTS usage_at ON usage(at);
      CREATE INDEX IF NOT EXISTS observations_at ON observations(at);
      PRAGMA user_version=${RAW_INDEX_VERSION};`);
    this.db = db;
    return db;
  }
  async refresh() {
    const db = await this.open();
    await stat(this.codexHome); // 根目录不可读时保留旧索引，不伪装成空数据。
    const files = (await Promise.all([discover(path.join(this.codexHome, "sessions")), discover(path.join(this.codexHome, "archived_sessions"))])).flat();
    const saved = new Map((db.prepare("SELECT * FROM files").all() as unknown as Array<{ path: string; size: number; mtime: number }>).map(item => [item.path, item]));
    const usageInsert = db.prepare("INSERT INTO usage VALUES(?,?,?,?)"), observationInsert = db.prepare("INSERT INTO observations VALUES(?,?,?,?)");
    let parsedFiles = 0, reusedFiles = 0;
    for (const file of files) {
      const before = await stat(file), previous = saved.get(file);
      saved.delete(file);
      if (previous?.size === before.size && previous.mtime === before.mtimeMs) { reusedFiles++; continue; }
      const parsed = await parseSessionFile(file), after = await stat(file);
      const stable = before.size === after.size && before.mtimeMs === after.mtimeMs;
      db.exec("BEGIN");
      try {
        db.prepare("DELETE FROM usage WHERE file=?").run(file);
        db.prepare("DELETE FROM observations WHERE file=?").run(file);
        parsed.events.forEach(({ sessionId, timestamp, model, tokens }, seq) => {
          const at = Date.parse(timestamp);
          if (Number.isFinite(at)) usageInsert.run(file, seq, at, JSON.stringify({ sessionId, timestamp, model, tokens }));
        });
        parsed.quotaObservations.forEach((observation, seq) => {
          const at = Date.parse(observation.timestamp);
          if (Number.isFinite(at)) observationInsert.run(file, seq, at, JSON.stringify(observation));
        });
        db.prepare("INSERT OR REPLACE INTO files VALUES(?,?,?)").run(file, stable ? after.size : -1, after.mtimeMs);
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
      parsedFiles++;
    }
    db.exec("BEGIN");
    try {
      for (const file of saved.keys()) {
        db.prepare("DELETE FROM usage WHERE file=?").run(file);
        db.prepare("DELETE FROM observations WHERE file=?").run(file);
        db.prepare("DELETE FROM files WHERE path=?").run(file);
      }
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    return { parsedFiles, reusedFiles };
  }
  async query(start: number, end: number) {
    const db = await this.open();
    const events = db.prepare("SELECT payload FROM usage WHERE at>=? AND at<? ORDER BY at").all(start, end).map(row => JSON.parse(String(row.payload)) as EstimationEvent);
    const observations = db.prepare("SELECT payload FROM observations WHERE at>=? AND at<? ORDER BY at").all(start, end).map(row => JSON.parse(String(row.payload)) as QuotaObservation);
    const first = db.prepare("SELECT at FROM usage WHERE at<? ORDER BY at LIMIT 1").get(end);
    const last = db.prepare("SELECT at FROM usage WHERE at<? ORDER BY at DESC LIMIT 1").get(end);
    return { events, observations, coverage: { firstEventAt: first ? new Date(Number(first.at)).toISOString() : null, lastEventAt: last ? new Date(Number(last.at)).toISOString() : null,
      files: Number(db.prepare("SELECT COUNT(*) AS n FROM files").get()!.n), observations: observations.length } };
  }
  close() { this.db?.close(); this.db = null; }
}
