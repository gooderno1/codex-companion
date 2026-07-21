import type { UpdateTrustMode } from "../shared/contracts";

export interface UpdateCapabilities {
  canAutoInstall: boolean;
  canInstallOnQuit: boolean;
  trustMode: UpdateTrustMode;
}

export function resolveUpdateCapabilities({
  supported,
  trustedPublisherConfigured,
  allowUnsignedInstall
}: {
  supported: boolean;
  trustedPublisherConfigured: boolean;
  allowUnsignedInstall: boolean;
}): UpdateCapabilities {
  if (!supported) {
    return {
      canAutoInstall: false,
      canInstallOnQuit: false,
      trustMode: "unsupported"
    };
  }

  if (trustedPublisherConfigured) {
    return {
      canAutoInstall: true,
      canInstallOnQuit: true,
      trustMode: "trusted-publisher"
    };
  }

  return {
    canAutoInstall: allowUnsignedInstall,
    canInstallOnQuit: false,
    trustMode: "unsigned-temporary"
  };
}
