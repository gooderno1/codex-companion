#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const { matchingPreviousPeriodEnd } = require(
  path.join(process.cwd(), "dist-electron/main/utils/time.js")
);

function iso(value) {
  return value.toISOString();
}

assert.equal(
  iso(
    matchingPreviousPeriodEnd(
      new Date("2026-09-01T00:00:00.000Z"),
      new Date("2026-09-01T15:30:00.000Z"),
      new Date("2026-08-31T00:00:00.000Z"),
      new Date("2026-09-01T00:00:00.000Z")
    )
  ),
  "2026-08-31T15:30:00.000Z",
  "昨日同期应保留当前日已经过时长"
);

assert.equal(
  iso(
    matchingPreviousPeriodEnd(
      new Date("2026-09-07T00:00:00.000Z"),
      new Date("2026-09-09T10:15:00.000Z"),
      new Date("2026-08-31T00:00:00.000Z"),
      new Date("2026-09-07T00:00:00.000Z")
    )
  ),
  "2026-09-02T10:15:00.000Z",
  "上周同期应落到相同星期和时刻"
);

assert.equal(
  iso(
    matchingPreviousPeriodEnd(
      new Date("2026-03-01T00:00:00.000Z"),
      new Date("2026-03-31T12:00:00.000Z"),
      new Date("2026-02-01T00:00:00.000Z"),
      new Date("2026-03-01T00:00:00.000Z")
    )
  ),
  "2026-03-01T00:00:00.000Z",
  "上月天数较少时应封顶到上月周期末"
);

assert.equal(
  iso(
    matchingPreviousPeriodEnd(
      new Date("2026-09-01T12:00:00.000Z"),
      new Date("2026-09-01T11:00:00.000Z"),
      new Date("2026-08-25T12:00:00.000Z"),
      new Date("2026-09-01T12:00:00.000Z")
    )
  ),
  "2026-08-25T12:00:00.000Z",
  "异常的负进度不得越过上一周期起点"
);

console.log("总览日、周、额度周与月度同期边界校验通过。");
