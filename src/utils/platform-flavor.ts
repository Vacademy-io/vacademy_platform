import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { flavorConfig } from "../../flavor.config";

export interface PlatformFlavorInfo {
  platform: "web" | "android" | "ios" | "electron";
  isNative: boolean;
  flavorConfig: {
    appName: string;
    domain: string;
    subdomain: string;
  } | null;
  appId: string | null;
}

/**
 * Get the current platform and flavor information
 */
export const getPlatformFlavorInfo = async (): Promise<PlatformFlavorInfo> => {
  const platform = Capacitor.getPlatform();
  const isNative = platform === "android" || platform === "ios";

  let appId: string | null = null;
  let flavorConfigData = null;

  if (isNative) {
    try {
      // Get app info from Capacitor
      const appInfo = await App.getInfo();
      appId = appInfo.id;

      // Find the corresponding flavor config
      flavorConfigData = flavorConfig[appId] || null;

      console.log(
        `[Platform Flavor] Detected native platform: ${platform}, appId: ${appId}`,
        flavorConfigData
      );
    } catch (error) {
      console.error("[Platform Flavor] Error getting app info:", error);
    }
  }

  return {
    platform: platform as "web" | "android" | "ios" | "electron",
    isNative,
    flavorConfig: flavorConfigData,
    appId,
  };
};

/**
 * Get domain and subdomain based on platform and flavor
 */
export const getDomainAndSubdomain = async (): Promise<{
  domain: string;
  subdomain: string | null;
}> => {
  const platformInfo = await getPlatformFlavorInfo();

  // For native apps, use the flavor config
  if (platformInfo.isNative && platformInfo.flavorConfig) {
    const { domain, subdomain } = platformInfo.flavorConfig;
    console.log(
      `[Platform Flavor] Using flavor config - domain: ${domain}, subdomain: ${subdomain}`
    );
    return { domain, subdomain };
  }

  // For web/electron, use the current hostname
  return getCurrentDomainInfoFromLocation();
};

/**
 * Helper function to get domain and subdomain from current location (for web/electron)
 */
export const getCurrentDomainInfoFromLocation = () => {
  const hostname = window.location.hostname;
  const parts = hostname.split(".");

  // Special handling for localhost subdomains
  if (hostname.includes("localhost")) {
    if (parts.length >= 2 && parts[0] !== "localhost") {
      // e.g., pp.localhost -> subdomain: pp, domain: localhost
      const subdomain = parts[0];
      const domain = parts.slice(1).join(".");
      return { domain, subdomain };
    } else {
      // e.g., localhost -> subdomain: null, domain: localhost
      return { domain: "localhost", subdomain: null };
    }
  }

  // Standard domain handling
  if (parts.length >= 3) {
    // e.g., code-circle.vacademy.io -> subdomain: code-circle, domain: vacademy.io
    const subdomain = parts[0];
    const domain = parts.slice(1).join(".");
    return { domain, subdomain };
  } else if (parts.length === 2) {
    // e.g., vacademy.io -> subdomain: null, domain: vacademy.io
    const domain = hostname;
    return { domain, subdomain: null };
  }

  // Fallback for other cases
  return { domain: hostname, subdomain: null };
};
