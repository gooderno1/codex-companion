import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { CODEX_SESSION_CACHE_VERSION, parseSessionFile, type CodexSessionSummary, type CodexTokenEvent, type CodexSessionCacheStoreLike } from "../collectors/codexCollector";

// 含派生成本。解析规则或定价变化必须提升版本，重新构建统计索引。
const INDEX_VERSION = 100 + CODEX_SESSION_CACHE_VERSION;
async function discover(directory: string): Promise<string[]> {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const groups = await Promise.all(entries.map(entry => entry.isDirectory() ? discover(path.join(directory, entry.name)) : Promise.resolve(entry.isFile() && entry.name.endsWith(".jsonl") ? [path.join(directory, entry.name)] : [])));
  return groups.flat();
}

export class ActivityIndex {
  private db: DatabaseSync | null = null;
  private pending: Promise<{ parsedFiles: number; reusedFiles: number }> | null = null;
  constructor(private directory: string, readonly codexHome: string, private seedCache?: CodexSessionCacheStoreLike) {}
  private async open() {
    if (this.db) return this.db;
    await mkdir(this.directory, { recursive: true });
    const key = createHash("sha256").update(path.resolve(this.codexHome)).digest("hex").slice(0, 16);
    const db = new DatabaseSync(path.join(this.directory, `activity-index-${key}.sqlite`));
    db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=3000;");
    if (Number(db.prepare("PRAGMA user_version").get()?.user_version) !== INDEX_VERSION) {
      db.exec("BEGIN; DROP TABLE IF EXISTS events; DROP TABLE IF EXISTS files; COMMIT;");
    }
    db.exec(`CREATE TABLE IF NOT EXISTS files (path TEXT PRIMARY KEY, size INTEGER NOT NULL, mtime REAL NOT NULL, session TEXT);
      CREATE TABLE IF NOT EXISTS events (file TEXT NOT NULL, seq INTEGER NOT NULL, at INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(file,seq));
      CREATE INDEX IF NOT EXISTS events_at ON events(at);
      PRAGMA user_version=${INDEX_VERSION};`);
    this.db = db;
    return db;
  }
  refresh() {
    if (!this.pending) {
      const task = this.sync();
      this.pending = task;
      void task.finally(() => { this.pending = null; }).catch(() => {});
    }
    return this.pending;
  }
  private async sync() {
    const db = await this.open();
    // 根目录不可访问时不能把旧索引误删为“空数据”。
    await stat(this.codexHome);
    const files = (await Promise.all([discover(path.join(this.codexHome, "sessions")), discover(path.join(this.codexHome, "archived_sessions"))])).flat();
    const saved = new Map((db.prepare("SELECT path, size, mtime FROM files").all() as unknown as Array<{ path: string; size: number; mtime: number }>).map(row => [row.path, row]));
    const seed = saved.size === 0 ? await this.seedCache?.read() : null;
    const insertEvent = db.prepare("INSERT INTO events(file,seq,at,payload) VALUES(?,?,?,?)");
    let parsedFiles = 0, reusedFiles = 0;
    for (const file of files) {
      const before = await stat(file), previous = saved.get(file);
      saved.delete(file);
      if (previous?.size === before.size && previous.mtime === before.mtimeMs) { reusedFiles++; continue; }
      const cached = seed?.version === CODEX_SESSION_CACHE_VERSION ? seed.entries[file] : undefined;
      const reuse = cached?.size === before.size && cached.mtimeMs === before.mtimeMs;
      const parsed = reuse ? cached.result : await parseSessionFile(file);
      const after = await stat(file);
      // 活跃文件在读取期间变化，下次必须继续更新，不能永久缓存不完整尾部。
      const stable = before.size === after.size && before.mtimeMs === after.mtimeMs;
      db.exec("BEGIN");
      try {
        db.prepare("DELETE FROM events WHERE file=?").run(file);
        db.prepare("INSERT OR REPLACE INTO files(path,size,mtime,session) VALUES(?,?,?,?)").run(file, stable ? after.size : -1, after.mtimeMs, parsed.session ? JSON.stringify(parsed.session) : null);
        parsed.events.forEach((event, seq) => { const at = Date.parse(event.timestamp); if (Number.isFinite(at)) insertEvent.run(file, seq, at, JSON.stringify(event)); });
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
      if (reuse) reusedFiles++; else parsedFiles++;
    }
    db.exec("BEGIN");
    try {
      for (const file of saved.keys()) { db.prepare("DELETE FROM events WHERE file=?").run(file); db.prepare("DELETE FROM files WHERE path=?").run(file); }
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    return { parsedFiles, reusedFiles };
  }
  async query(range: { startAt: string | null; endAt: string }) {
    const db = await this.open();
    const events = db.prepare("SELECT payload FROM events WHERE at>=? AND at<? ORDER BY at").all(range.startAt ? Date.parse(range.startAt) : 0, Date.parse(range.endAt)).map(row => JSON.parse(String(row.payload)) as CodexTokenEvent);
    const sessions = db.prepare("SELECT session FROM files WHERE session IS NOT NULL").all().map(row => JSON.parse(String(row.session)) as CodexSessionSummary);
    const first = db.prepare("SELECT at FROM events WHERE at<=? ORDER BY at LIMIT 1").get(Date.now());
    const last = db.prepare("SELECT at FROM events WHERE at<=? ORDER BY at DESC LIMIT 1").get(Date.now());
    return { events, sessions, sessionFilesScanned: Number(db.prepare("SELECT COUNT(*) AS n FROM files").get()!.n), archivedFilesScanned: 0,
      coverage: { firstEventAt: first ? new Date(Number(first.at)).toISOString() : null, lastEventAt: last ? new Date(Number(last.at)).toISOString() : null, files: Number(db.prepare("SELECT COUNT(*) AS n FROM files").get()!.n) } };
  }
  close() { this.db?.close(); this.db = null; }
}
