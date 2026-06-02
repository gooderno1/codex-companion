import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await readFile(targetPath, { encoding: "utf8" });
    return true;
  } catch {
    try {
      await readdir(targetPath);
      return true;
    } catch {
      return false;
    }
  }
}

export async function ensureDirectory(targetPath: string): Promise<void> {
  await mkdir(targetPath, { recursive: true });
}

export async function readJsonFile<T>(targetPath: string): Promise<T | null> {
  try {
    const content = await readFile(targetPath, { encoding: "utf8" });
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function writeJsonFile(
  targetPath: string,
  payload: unknown
): Promise<void> {
  await ensureDirectory(path.dirname(targetPath));
  await writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8"
  });
}

export async function walkFiles(
  rootPath: string,
  options: {
    maxDepth?: number;
    include?: (filePath: string) => boolean;
    ignoreDirectories?: Set<string>;
  } = {}
): Promise<string[]> {
  const results: string[] = [];
  const maxDepth = options.maxDepth ?? Number.POSITIVE_INFINITY;
  const ignoreDirectories = options.ignoreDirectories ?? new Set<string>();
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

    for (const entry of entries) {
      const fullPath = path.join(current.directory, entry.name);

      if (entry.isDirectory()) {
        if (
          current.depth < maxDepth &&
          !ignoreDirectories.has(entry.name.toLowerCase())
        ) {
          stack.push({ directory: fullPath, depth: current.depth + 1 });
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (options.include && !options.include(fullPath)) {
        continue;
      }

      results.push(fullPath);
    }
  }

  return results;
}
