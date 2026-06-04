#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const TOKEN_FILE = path.join(ROOT, "src", "renderer", "design-tokens.ts");
const STYLE_FILE = path.join(ROOT, "src", "renderer", "styles.css");

const REQUIRED_TOKENS = {
  "--bg-canvas": "#f7faff",
  "--surface-strong": "#ffffff",
  "--text-primary": "#101828",
  "--text-secondary": "#344054",
  "--text-tertiary": "#667085",
  "--text-muted": "#8a97a8",
  "--accent-blue": "#0b6ff2",
  "--accent-teal": "#12b8d7",
  "--accent-green": "#10a35b",
  "--accent-amber": "#d88a1f",
  "--accent-rose": "#d04444",
  "--radius-card": "18px",
  "--radius-pill": "999px",
  "--space-1": "4px",
  "--space-2": "8px",
  "--space-3": "12px",
  "--space-7": "24px"
};

const LOCAL_COMPONENT_VARIABLES = new Set([
  "--app-scale",
  "--quota-accent",
  "--quota-accent-end",
  "--quota-progress"
]);

function parseTokenVariables(source) {
  const tokens = new Map();
  const tokenPattern = /^\s*"(?<name>--[^"]+)":\s*"(?<rawValue>(?:\\.|[^"])*)",?\s*$/gm;

  for (const match of source.matchAll(tokenPattern)) {
    const { name, rawValue } = match.groups;
    tokens.set(name, JSON.parse(`"${rawValue}"`));
  }

  return tokens;
}

function parseCssVariableReferences(source) {
  return new Set([...source.matchAll(/var\((--[a-z0-9-]+)/gi)].map((match) => match[1]));
}

function formatList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

const [tokenSource, styleSource] = await Promise.all([
  readFile(TOKEN_FILE, "utf8"),
  readFile(STYLE_FILE, "utf8")
]);

const tokens = parseTokenVariables(tokenSource);
const cssReferences = parseCssVariableReferences(styleSource);
const errors = [];

for (const [token, expectedValue] of Object.entries(REQUIRED_TOKENS)) {
  if (!tokens.has(token)) {
    errors.push(`${token} 缺失。`);
    continue;
  }

  const actualValue = tokens.get(token);
  if (actualValue !== expectedValue) {
    errors.push(`${token} 应为 ${expectedValue}，当前为 ${actualValue}。`);
  }
}

const missingReferences = [...cssReferences]
  .filter((token) => !tokens.has(token) && !LOCAL_COMPONENT_VARIABLES.has(token))
  .sort();
if (missingReferences.length > 0) {
  errors.push(`styles.css 引用了未定义 token：\n${formatList(missingReferences)}`);
}

if (!tokenSource.includes("applyDesignTokens();") && !tokenSource.includes("export function applyDesignTokens")) {
  errors.push("design-tokens.ts 必须导出 applyDesignTokens。");
}

if (errors.length > 0) {
  console.error("设计 token 校验失败：");
  console.error(formatList(errors));
  process.exitCode = 1;
} else {
  console.log(
    `设计 token 校验通过：${tokens.size} 个 token，styles.css 使用 ${cssReferences.size} 个 token。`
  );
}
