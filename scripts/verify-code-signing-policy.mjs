import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function read(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

const [readme, policy, releaseTemplate, workflow, security, contributing] =
  await Promise.all([
    read("README.md"),
    read("CODE_SIGNING_POLICY.md"),
    read(".github/RELEASE_TEMPLATE.md"),
    read(".github/workflows/package-windows.yml"),
    read("SECURITY.md"),
    read("CONTRIBUTING.md")
  ]);
const packageJson = JSON.parse(await read("package.json"));

assert.match(readme, /^## Code signing policy$/m);
assert.match(readme, /CODE_SIGNING_POLICY\.md/);
assert.match(policy, /Free code signing provided by \[SignPath\.io\]/);
assert.match(policy, /certificate by \[SignPath Foundation\]/);
assert.match(policy, /Authors \/ Committers/);
assert.match(policy, /Reviewers/);
assert.match(policy, /Approvers/);
assert.match(policy, /PRIVACY\.md/);
assert.match(policy, /多因素认证（MFA）/);
assert.match(policy, /人工批准/);
assert.match(releaseTemplate, /^## Code signing policy$/m);
assert.match(workflow, /Code signing policy/);
assert.match(workflow, /CODE_SIGNING_POLICY\.md/);
assert.match(security, /CODE_SIGNING_POLICY\.md/);
assert.match(contributing, /代码签名敏感文件/);

assert.equal(packageJson.build.productName, "Codex Companion");
assert.equal(packageJson.build.afterPack, "scripts/after-pack-windows.cjs");
assert.equal(packageJson.build.win.signAndEditExecutable, false);
assert.match(await read("scripts/after-pack-windows.cjs"), /ProductName: productName/);
assert.match(await read("scripts/after-pack-windows.cjs"), /ProductVersion: packageJson\.version/);

console.log("代码签名政策入口、角色、审批、隐私、发布模板和 Windows 元数据配置校验通过。");
