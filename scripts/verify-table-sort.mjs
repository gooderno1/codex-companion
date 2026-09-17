import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { nextTableSort, sortTableRows } = require("../dist-electron/shared/tableSort.js");
const rows = Array.from({ length: 60 }, (_, i) => ({ id: `row-${i}`, token: (60 - i) * 10_001, name: `任务 ${60 - i}` }));
const original = structuredClone(rows);
const sorted = direction => sortTableRows(rows, { key: "token", direction }, (row, key) => row[key], row => row.id);
assert.deepEqual(sorted("asc").slice(0, 25).map(row => row.token), Array.from({ length: 25 }, (_, i) => (i + 1) * 10_001), "排序包含第二、三页数据，比较原始 Token");
assert.equal(sorted("asc").slice(0, 8)[0].id, "row-59", "账本先对全部数据排序再取前 8 项");
assert.equal(sorted("desc")[0].token, 600_060);
assert.deepEqual(rows, original, "排序不改写快照数组");
assert.equal(sortTableRows(rows, { key: "name", direction: "asc" }, (row, key) => row[key], row => row.id)[0].name, "任务 1");
const missing = [{ id: "z", value: null }, { id: "a", value: 0 }, { id: "c", value: 2 }, { id: "b", value: 2 }, { id: "x", value: NaN }];
for (const direction of ["asc", "desc"]) {
  const result = sortTableRows(missing, { key: "value", direction }, row => row.value, row => row.id);
  assert.deepEqual(result.slice(-2).map(row => row.id), ["x", "z"], "缺失值始终置后");
  assert.deepEqual(result.filter(row => row.value === 2).map(row => row.id), ["b", "c"], "同值按稳定键排序");
  assert.equal(result.slice(0, 3).some(row => row.value === 0), true, "零为有效数值");
}
assert.deepEqual(nextTableSort({ key: "recent", direction: "desc" }, "token"), { key: "token", direction: "asc" });
assert.deepEqual(nextTableSort({ key: "token", direction: "asc" }, "token"), { key: "token", direction: "desc" });
assert.deepEqual(nextTableSort({ key: "token", direction: "desc" }, "token"), { key: "token", direction: "asc" });
console.log("表格排序通过：跨页原始数值、先排序后截取、名称、零 / 缺失值、稳定同值及快照不变。");
