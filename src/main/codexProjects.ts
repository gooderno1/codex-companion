import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { UNATTRIBUTED_PROJECT } from "../shared/activityDetails";

export interface CodexProject { id: string; name: string; rootPaths: string[] }
export interface CodexProjectCatalog {
  projects: CodexProject[];
  assignments: Map<string, string>;
  projectless: Set<string>;
  hints: Map<string, string>;
  warnings: string[];
}
export const normalizeProjectPath = (value: string) => value.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
export function containsProjectPath(root: string, value: string) {
  const a = normalizeProjectPath(root), b = normalizeProjectPath(value);
  return b === a || b.startsWith(`${a}/`);
}
export function projectForSession(catalog: CodexProjectCatalog, session: { sessionId: string; cwd: string | null }): string {
  const explicit = catalog.assignments.get(session.sessionId);
  if (explicit) return catalog.projects.some(p => p.id === explicit) ? explicit : UNATTRIBUTED_PROJECT;
  if (catalog.projectless.has(session.sessionId)) return UNATTRIBUTED_PROJECT;
  const cwd = catalog.hints.get(session.sessionId) ?? session.cwd;
  if (!cwd) return UNATTRIBUTED_PROJECT;
  const matches = catalog.projects.flatMap(project => project.rootPaths.filter(root => containsProjectPath(root, cwd)).map(root => ({ id: project.id, length: normalizeProjectPath(root).length }))).sort((a, b) => b.length - a.length);
  if (matches[1] && matches[0].length === matches[1].length && matches[0].id !== matches[1].id) return UNATTRIBUTED_PROJECT;
  return matches[0]?.id ?? UNATTRIBUTED_PROJECT;
}

/** 只读 Codex 项目和归属元数据；不读取会话正文。 */
export async function readCodexProjects(codexHome: string): Promise<CodexProjectCatalog> {
  const catalog: CodexProjectCatalog = { projects: [], assignments: new Map(), projectless: new Set(), hints: new Map(), warnings: [] };
  const projects = new Map<string, CodexProject>();
  const aliases = new Map<string, string>();
  try {
    const state = JSON.parse(await readFile(path.join(codexHome, ".codex-global-state.json"), "utf8"));
    for (const value of Object.values(state["local-projects"] ?? {}) as CodexProject[]) {
      if (typeof value.id === "string" && typeof value.name === "string" && Array.isArray(value.rootPaths)) projects.set(value.id, { id: value.id, name: value.name, rootPaths: value.rootPaths.filter(root => typeof root === "string") });
    }
    if (state["local-projects"] === undefined) {
      for (const root of state["electron-saved-workspace-roots"] ?? []) {
        if (typeof root !== "string") continue;
        const label = state["electron-workspace-root-labels"]?.[root];
        const id = `legacy-root:${normalizeProjectPath(root)}`;
        projects.set(id, { id, name: typeof label === "string" ? label : path.basename(root), rootPaths: [root] });
      }
    }
    for (const [host, mapping] of Object.entries(state["app-server-project-id-by-legacy-project-id-by-host"] ?? {})) {
      if (normalizeProjectPath(host) !== normalizeProjectPath(`local:${path.resolve(codexHome)}`)) continue;
      for (const [legacy, current] of Object.entries(mapping as Record<string, string>)) if (typeof current === "string") aliases.set(current, legacy);
    }
    for (const [id, value] of Object.entries(state["thread-project-assignments"] ?? {}) as Array<[string, { projectKind: string; projectId: string }]>) {
      if (value.projectKind === "local") catalog.assignments.set(id, aliases.get(value.projectId) ?? value.projectId);
    }
    catalog.projectless = new Set((state["projectless-thread-ids"] ?? []).filter((id: unknown) => typeof id === "string"));
    for (const [id, root] of Object.entries(state["thread-workspace-root-hints"] ?? {})) if (typeof root === "string") catalog.hints.set(id, root);
  } catch { catalog.warnings.push("Codex 桌面项目元数据不可读，尝试项目数据库。"); }
  let db: DatabaseSync | undefined;
  try {
    const files = (await readdir(codexHome)).filter(name => /^state_\d+\.sqlite$/.test(name)).sort((a, b) => Number(b.match(/\d+/)![0]) - Number(a.match(/\d+/)![0]));
    if (files[0]) {
      db = new DatabaseSync(path.join(codexHome, files[0]), { readOnly: true });
      db.exec("PRAGMA busy_timeout=1000; BEGIN");
      const rows = db.prepare("SELECT id, name FROM projects ORDER BY position").all() as unknown as Array<{ id: string; name: string }>;
      const roots = db.prepare("SELECT project_id, path FROM project_roots ORDER BY position").all() as unknown as Array<{ project_id: string; path: string }>;
      const threads = db.prepare("SELECT id, project_id FROM threads WHERE project_id IS NOT NULL").all() as unknown as Array<{ id: string; project_id: string }>;
      // 数据库项目表是迁移后的权威列表；避免重新引入已删除的旧项目。
      projects.clear();
      for (const row of rows) {
        const id = aliases.get(row.id) ?? row.id;
        projects.set(id, { id, name: row.name, rootPaths: roots.filter(root => root.project_id === row.id).map(root => root.path) });
      }
      for (const row of threads) catalog.assignments.set(row.id, aliases.get(row.project_id) ?? row.project_id);
      db.exec("COMMIT");
    }
  } catch { catalog.warnings.push("Codex 项目数据库暂不可读，使用桌面保存的项目清单。"); }
  finally { db?.close(); }
  catalog.projects = [...projects.values()];
  return catalog;
}
