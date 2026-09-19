import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
const { estimateApiCostUsd, estimateCodexCredits, resolvePricingRate, PRICING_CATALOG_VERSION, PRICING_CATALOG_HISTORY } = require("../dist-electron/main/collectors/pricing.js");
const { DashboardService } = require("../dist-electron/main/collectors/dashboardCollector.js");
const catalog = JSON.parse(readFileSync(new URL("../src/main/collectors/pricing-catalogs/2026-09-19.json", import.meta.url)));
const sample = { input: 1000000, cachedInput: 800000, output: 100000, reasoningOutput: 50000, total: 1100000 };
for (const [model,usd,credits] of [
  ["gpt-6-astra",7.8,195],["gpt-5.6-sol",3.12,78],["gpt-5.6",3.12,78],
  ["gpt-5.6-terra",1.76,44],["gpt-5.6-luna",.176,4.4],
  ["gpt-daybreak-blue-latest",3.12,78],["gpt-5.6-cyber",11,275],["gpt-daybreak-red-latest",11,275]
]) {
  assert.ok(Math.abs(estimateApiCostUsd(model,sample)-usd)<1e-10,model);
  assert.ok(Math.abs(estimateCodexCredits(model,sample)-credits)<1e-10,model);
}
for (const model of ["gpt-rosalind-research","gpt-6","gpt-5.6-pro","gpt-5.6-cyber-pro","gpt-daybreak-red-latest-2026-09-19","toString","__proto__"]) {
  assert.equal(resolvePricingRate(model),null,model);
  assert.equal(estimateApiCostUsd(model,sample),null);
  assert.equal(estimateCodexCredits(model,sample),null);
}
assert.equal(catalog.pending.find(x=>x.modelId==="gpt-rosalind-research").effectiveFrom,"2026-10-05");
assert.equal(catalog.effectiveFrom,null,"首次核对日期不能伪装成历史生效日");
assert.equal(catalog.rules["gpt-5.6-sol"].promotion.expiresAt,null,"优惠至少持续日期不能当自动涨价日期");
assert.equal(catalog.rules["gpt-6-astra"].apiFastMultiplier,2);
assert.equal(catalog.rules["gpt-6-astra"].codexFastMultiplier,2.5);
assert.equal(catalog.rules["gpt-6-astra"].longContext.threshold,272000);
assert.equal(catalog.rules["gpt-6-astra"].longContext.scope,"request");
assert.equal(catalog.rules["gpt-5.6-cyber"].longContext,null);
for (const source of catalog.sources) assert.equal(source.evidenceHash,createHash("sha256").update(source.evidence).digest("hex"));
const cache = {generatedAt:new Date().toISOString(),quotaDisplayVersion:2,projectAttributionVersion:1,pricingCatalogVersion:PRICING_CATALOG_VERSION,overview:{limitWindows:[]}};
assert.equal(await new DashboardService({}, {read:async()=>({...cache,pricingCatalogVersion:"old"})}).getCachedSnapshot(),null);
assert.equal(await new DashboardService({}, {read:async()=>({...cache,pricingCatalogVersion:undefined})}).getCachedSnapshot(),null);
assert.equal(PRICING_CATALOG_HISTORY[0].rates["gpt-6-astra"].inputCreditsPerMillion,null);
for (const [model,cost] of [["gpt-5.1",1.35],["gpt-5.1-codex",1.35],["gpt-5.1-codex-max",1.35],["gpt-5.1-codex-mini",.27],["codex-mini-latest",1.2]]) {
  assert.ok(Math.abs(estimateApiCostUsd(model,sample)-cost)<1e-10,model);
  assert.equal(estimateCodexCredits(model,sample),null,"旧 API 模型不能猜测 credits");
}
// 注入采集配置失败，验证失败回退也不会返回旧价格；不读取真实用户会话。
const old = {...cache,pricingCatalogVersion:"old",sourceHealth:{refreshHistory:[]}};
const service = new DashboardService({read:async()=>({get codexHome(){throw new Error("synthetic collection failure");}})},{read:async()=>old});
await assert.rejects(service.getSnapshot(true),/synthetic collection failure/);
console.log("定价目录回归通过：独立 USD/credits、精确别名、未知/未来价格、促销历史语义、来源哈希与启动/失败旧缓存拒用。");
