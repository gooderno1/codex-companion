import type { UpdateInfo } from "builder-util-runtime";

import type { UpdateState } from "../shared/contracts";

export const RELEASES_URL = "https://github.com/gooderno1/codex-companion/releases";
const MAX_RELEASE_NOTES_LENGTH = 4_000;

function decodeReleaseNotesEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
}

export function sanitizeReleaseNotes(value: UpdateInfo["releaseNotes"]): string | null {
  const source = Array.isArray(value)
    ? value
        .map((item) => item.note ? `v${item.version}\n${item.note}` : `v${item.version}`)
        .join("\n\n")
    : value;

  if (typeof source !== "string" || !source.trim()) {
    return null;
  }

  const plainText = decodeReleaseNotesEntities(
    source
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return plainText ? plainText.slice(0, MAX_RELEASE_NOTES_LENGTH) : null;
}

export function releaseUrlForVersion(version: string | null): string {
  return version && /^[0-9A-Za-z.-]+$/.test(version)
    ? `${RELEASES_URL}/tag/v${version}`
    : RELEASES_URL;
}

export function normalizeUpdateError(
  error: unknown
): Pick<UpdateState, "errorCode" | "errorMessage"> {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("sha512") || message.includes("checksum")) {
    return {
      errorCode: "integrity-check-failed",
      errorMessage: "更新文件校验失败，已停止安装，请稍后重试。"
    };
  }

  if (message.includes("signature") || message.includes("publisher")) {
    return {
      errorCode: "signature-check-failed",
      errorMessage: "更新签名校验失败，已停止安装，请从 Releases 手动下载。"
    };
  }

  if (message.includes("404") || message.includes("latest.yml")) {
    return {
      errorCode: "metadata-missing",
      errorMessage: "该版本的更新文件不完整，请从 Releases 手动下载安装。"
    };
  }

  if (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("enotfound") ||
    message.includes("econn")
  ) {
    return {
      errorCode: "network-unavailable",
      errorMessage: "暂时无法连接更新服务，现有功能不受影响。"
    };
  }

  return {
    errorCode: "update-service-error",
    errorMessage: "更新服务暂时不可用，请稍后重试或打开 Releases。"
  };
}

export function downloadSizeFromInfo(info: UpdateInfo): number | null {
  const total = info.files.reduce(
    (sum, file) => sum + (typeof file.size === "number" ? file.size : 0),
    0
  );
  return total > 0 ? total : null;
}
