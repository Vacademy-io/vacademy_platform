interface FlavorConfig {
  appName: string;
  domain: string;
  subdomain: string;
}

interface FlavorConfigs {
  [key: string]: FlavorConfig;
}

export const flavorConfig: FlavorConfigs = {
  // iOS bundle identifiers (must match Xcode PRODUCT_BUNDLE_IDENTIFIER)
  "io.vacademy.student.app": {
    appName: "SSDC Horizon",
    domain: "vacademy.io",
    subdomain: "ssdc",
  },
  "io.fivesep.student.app": {
    appName: "iThinkers by Fivesep",
    domain: "ithinkersolympiad.com",
    subdomain: "practice",
  },
  // Android app IDs (must match applicationId in build.gradle)
  "com.sevencs.app": {
    appName: "The 7Cs",
    domain: "vacademy.io",
    subdomain: "7cs",
  },
  "com.fivesep.app": {
    appName: "iThinkers by Fivesep",
    domain: "vacademy.io",
    subdomain: "fivesep",
  },
};
