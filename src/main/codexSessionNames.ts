import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { DatabaseSync } from "node:sqlite";

/** 只读取 Codex 保存的会话名称；title 可能含首条任务正文，不能用作名称回退。 */
export async function readCodexSessionNames(codexHome: string): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const timestamps = new Map<string, number>();
  try {
    const lines = readline.createInterface({ input: createReadStream(path.join(codexHome, "session_index.jsonl"), { encoding: "utf8" }), crlfDelay: Infinity });
    for await (const line of lines) {
      try {
        const row = JSON.parse(line);
        if (typeof row.id !== "string" || typeof row.thread_name !== "string" || !row.thread_name.trim()) continue;
        const timestamp = typeof row.updated_at === "string" ? Date.parse(row.updated_at) : 0;
        const at = Number.isFinite(timestamp) ? timestamp : 0;
        if (at >= (timestamps.get(row.id) ?? -Infinity)) {
          names.set(row.id, row.thread_name.trim());
          timestamps.set(row.id, at);
        }
      } catch { /* 忽略损坏或写入未完成的单行，其余名称仍可使用。 */ }
    }
  } catch { /* 旧版或尚未生成名称索引时继续读本机数据库。 */ }

  let db: DatabaseSync | undefined;
  try {
    const files = (await readdir(codexHome)).filter(name => /^state_\d+\.sqlite$/.test(name)).sort((a, b) => Number(b.match(/\d+/)![0]) - Number(a.match(/\d+/)![0]));
    if (files[0]) {
      db = new DatabaseSync(path.join(codexHome, files[0]), { readOnly: true });
      db.exec("PRAGMA busy_timeout=1000");
      for (const row of db.prepare("SELECT id, name FROM threads WHERE name IS NOT NULL AND length(trim(name)) > 0").all()) {
        const name = typeof row.name === "string" ? row.name.trim() : "";
        if (typeof row.id === "string" && name) names.set(row.id, name);
      }
    }
  } catch { /* 旧 schema 不含 name 或数据库暂不可读时保留名称索引结果。 */ }
  finally { db?.close(); }
  return names;
}
