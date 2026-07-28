import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { SYSTEM_NOTIFICATION_CLICK_PAGE } = require(
  "../dist-electron/main/notifications.js"
);
const mainSource = await readFile(
  new URL("../src/main/index.ts", import.meta.url),
  "utf8"
);

assert.equal(
  SYSTEM_NOTIFICATION_CLICK_PAGE,
  "notifications",
  "Windows 系统通知必须进入独立通知页"
);
assert.match(
  mainSource,
  /activeSystemNotifications\.set\(item\.key, notification\)/,
  "系统通知对象必须保活，确保后台点击回调可靠"
);
assert.match(
  mainSource,
  /openPage\(SYSTEM_NOTIFICATION_CLICK_PAGE\)/,
  "系统通知点击必须使用通知页路由"
);
assert.doesNotMatch(
  mainSource,
  /notification\.(?:on|once)\("click"[\s\S]{0,180}openPage\(item\.page\)/,
  "系统通知点击不能再直接跳到关联业务页面"
);

console.log("通知跳转合同校验通过：系统通知点击进入通知页，通知对象在等待点击期间保持存活。");
