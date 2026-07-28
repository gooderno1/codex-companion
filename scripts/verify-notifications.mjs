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
  /openNotification\(item\.key\)/,
  "系统通知点击必须携带目标通知 key"
);
assert.doesNotMatch(
  mainSource,
  /notification\.(?:on|once)\("click"[\s\S]{0,180}openPage\(item\.page\)/,
  "系统通知点击不能再直接跳到关联业务页面"
);

const rendererSource = await readFile(
  new URL("../src/renderer/App.tsx", import.meta.url),
  "utf8"
);
assert.match(
  rendererSource,
  /openNotification\(item\.key\)/,
  "顶部单条通知的查看详情必须打开对应通知"
);
assert.match(
  rendererSource,
  /targetKey=\{notificationKey\}/,
  "通知页必须接收深链接中的目标通知 key"
);
assert.match(
  rendererSource,
  /targetKey \?\? notifications\[0\]\?\.key \?\? null/,
  "通知页必须选中深链接指定的通知"
);

console.log("通知跳转合同校验通过：系统通知与顶部单条详情均携带通知 key，并选中对应详情。");
