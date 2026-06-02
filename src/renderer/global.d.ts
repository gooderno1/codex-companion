import type { CodexCompanionApi } from "../shared/contracts";

declare global {
  interface Window {
    codexCompanion: CodexCompanionApi;
  }
}

export {};
